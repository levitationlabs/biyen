package fossbilling

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"

	"github.com/ente/museum/ente"
	"github.com/ente/museum/pkg/repo"
	"github.com/ente/museum/pkg/utils/crypto"
	emailUtil "github.com/ente/museum/pkg/utils/email"
)

type memState struct {
	mu       sync.Mutex
	users    map[int64]ente.User
	byHash   map[string]int64
	subs     map[int64]ente.Subscription
	encKey   []byte
	hashKey  []byte
}

func newMemState(encKey, hashKey []byte) *memState {
	return &memState{
		users:   make(map[int64]ente.User),
		byHash:  make(map[string]int64),
		subs:    make(map[int64]ente.Subscription),
		encKey:  encKey,
		hashKey: hashKey,
	}
}

func (m *memState) seedUser(id int64, rawEmail string, sub ente.Subscription) error {
	normalized := emailUtil.NormalizeEmail(rawEmail)
	hash, err := crypto.GetHash(normalized, m.hashKey)
	if err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.users[id] = ente.User{ID: id, Email: normalized, Hash: hash}
	m.byHash[hash] = id
	sub.UserID = id
	m.subs[id] = sub
	return nil
}

type memConnector struct {
	state *memState
}

func (c *memConnector) Connect(context.Context) (driver.Conn, error) {
	return &memConn{state: c.state}, nil
}

func (c *memConnector) Driver() driver.Driver { return nil }

type memConn struct{ state *memState }

func (c *memConn) Prepare(string) (driver.Stmt, error) { return nil, errors.New("not implemented") }
func (c *memConn) Close() error                        { return nil }
func (c *memConn) Begin() (driver.Tx, error)           { return nil, errors.New("not implemented") }

func (c *memConn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	c.state.mu.Lock()
	defer c.state.mu.Unlock()
	if strings.Contains(query, "FROM users WHERE user_id = $1") {
		return c.queryUserByID(args[0].Value.(int64))
	}
	if strings.Contains(query, "FROM users WHERE email_hash = $1") {
		return c.queryUserByHash(args[0].Value.(string))
	}
	if strings.Contains(query, "FROM subscriptions WHERE user_id = $1") {
		return c.querySubByUserID(args[0].Value.(int64))
	}
	if strings.Contains(query, "FROM subscriptions WHERE original_transaction_id = $1") {
		return c.querySubByTxn(args[0].Value.(string), args[1].Value.(string))
	}
	return nil, errors.New("unexpected query: " + query)
}

func (c *memConn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	c.state.mu.Lock()
	defer c.state.mu.Unlock()
	if !strings.Contains(query, "UPDATE subscriptions") {
		return nil, errors.New("unexpected exec: " + query)
	}
	subID := args[0].Value.(int64)
	for uid, s := range c.state.subs {
		if s.ID != subID {
			continue
		}
		var attrs ente.SubscriptionAttributes
		_ = json.Unmarshal(args[6].Value.([]byte), &attrs)
		s.Storage = args[1].Value.(int64)
		s.OriginalTransactionID = args[2].Value.(string)
		s.ExpiryTime = args[3].Value.(int64)
		s.ProductID = args[4].Value.(string)
		s.PaymentProvider = ente.PaymentProvider(args[5].Value.(string))
		s.Attributes = attrs
		s.UpgradedAt = args[7].Value.(int64)
		c.state.subs[uid] = s
		return driver.RowsAffected(1), nil
	}
	return driver.RowsAffected(0), nil
}

func (c *memConn) queryUserByID(id int64) (driver.Rows, error) {
	u, ok := c.state.users[id]
	if !ok {
		return &memRows{}, nil
	}
	enc, err := crypto.Encrypt(u.Email, c.state.encKey)
	if err != nil {
		return nil, err
	}
	return &memRows{
		cols: []string{"user_id", "encrypted_email", "email_decryption_nonce", "email_hash", "family_admin_id", "creation_time", "is_two_factor_enabled", "email_mfa"},
		data: [][]driver.Value{{u.ID, enc.Cipher, enc.Nonce, u.Hash, nil, int64(1), false, false}},
	}, nil
}

func (c *memConn) queryUserByHash(hash string) (driver.Rows, error) {
	uid, ok := c.state.byHash[hash]
	if !ok {
		return &memRows{}, nil
	}
	return &memRows{
		cols: []string{"user_id"},
		data: [][]driver.Value{{uid}},
	}, nil
}

func (c *memConn) querySubByUserID(uid int64) (driver.Rows, error) {
	s, ok := c.state.subs[uid]
	if !ok {
		return &memRows{}, nil
	}
	return subRows(s)
}

func (c *memConn) querySubByTxn(txnID, provider string) (driver.Rows, error) {
	for _, s := range c.state.subs {
		if s.OriginalTransactionID == txnID && string(s.PaymentProvider) == provider {
			return subRows(s)
		}
	}
	return &memRows{}, nil
}

func subRows(s ente.Subscription) (driver.Rows, error) {
	attrBytes, err := json.Marshal(s.Attributes)
	if err != nil {
		return nil, err
	}
	return &memRows{
		cols: []string{"subscription_id", "user_id", "product_id", "storage", "original_transaction_id", "expiry_time", "payment_provider", "attributes"},
		data: [][]driver.Value{{s.ID, s.UserID, s.ProductID, s.Storage, s.OriginalTransactionID, s.ExpiryTime, string(s.PaymentProvider), attrBytes}},
	}, nil
}

type memRows struct {
	cols []string
	data [][]driver.Value
	idx  int
}

func (r *memRows) Columns() []string { return r.cols }
func (r *memRows) Close() error      { return nil }
func (r *memRows) Next(dest []driver.Value) error {
	if r.idx >= len(r.data) {
		return io.EOF
	}
	copy(dest, r.data[r.idx])
	r.idx++
	return nil
}

func openTestRepos(encKey, hashKey []byte) (*memState, *repo.UserRepository, *repo.BillingRepository) {
	state := newMemState(encKey, hashKey)
	db := sql.OpenDB(&memConnector{state: state})
	userRepo := &repo.UserRepository{DB: db, SecretEncryptionKey: encKey, HashingKey: hashKey}
	billingRepo := &repo.BillingRepository{DB: db}
	return state, userRepo, billingRepo
}

func newMockFOSSBillingServer(secret string, fn func(path string, req map[string]any) map[string]any) *httptest.Server {
	peerChannel, _ := NewChannel(DefaultAppID, secret)
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var env Envelope
		_ = json.NewDecoder(r.Body).Decode(&env)
		decrypted, err := peerChannel.Open(env)
		if err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}
		respMap := fn(r.URL.Path, decrypted)
		respEnv, _ := peerChannel.Seal(respMap)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"result": respEnv})
	}))
}
