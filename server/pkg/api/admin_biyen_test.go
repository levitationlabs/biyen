package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/ente/museum/ente"
	"github.com/ente/museum/internal/testutil"
	usercontroller "github.com/ente/museum/pkg/controller/user"
	"github.com/ente/museum/pkg/repo"
	"github.com/ente/museum/pkg/utils/auth"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/patrickmn/go-cache"
	"github.com/stretchr/testify/require"
)

func getBiyenTestDB(t *testing.T) *sql.DB {
	t.Helper()
	if os.Getenv("ENV") == "test" && os.Getenv("PGDATABASE") != "" {
		return testutil.RequireTestDB(t)
	}
	db, err := sql.Open("postgres", "host=localhost port=5432 user=pguser password=pgpass dbname=ente_db sslmode=disable")
	if err != nil {
		t.Skipf("cannot open local test db: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Skipf("cannot connect to local test db: %v", err)
	}
	return db
}

func TestSuspendAndUnsuspendUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := getBiyenTestDB(t)

	nowMicro := time.Now().UnixMicro()
	adminEmailHash := fmt.Sprintf("admin_hash_%d", nowMicro)
	targetEmailHash := fmt.Sprintf("target_hash_%d", nowMicro)

	var adminID, targetUserID int64
	err := db.QueryRow(`INSERT INTO users(email_hash, creation_time) VALUES($1, $2) RETURNING user_id`, adminEmailHash, nowMicro).Scan(&adminID)
	require.NoError(t, err)
	err = db.QueryRow(`INSERT INTO users(email_hash, creation_time) VALUES($1, $2) RETURNING user_id`, targetEmailHash, nowMicro).Scan(&targetUserID)
	require.NoError(t, err)

	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM tokens WHERE user_id IN ($1, $2)`, adminID, targetUserID)
		_, _ = db.Exec(`DELETE FROM users WHERE user_id IN ($1, $2)`, adminID, targetUserID)
	})

	freshToken := fmt.Sprintf("fresh_admin_token_%d", nowMicro)
	freshHash := auth.HashToken(freshToken)
	_, err = db.Exec(`INSERT INTO tokens(user_id, token_hash, creation_time, app) VALUES($1, $2, $3, $4)`,
		adminID, freshHash[:], time.Now().UnixMicro(), ente.Photos)
	require.NoError(t, err)

	oldToken := fmt.Sprintf("old_admin_token_%d", nowMicro)
	oldHash := auth.HashToken(oldToken)
	_, err = db.Exec(`INSERT INTO tokens(user_id, token_hash, creation_time, app) VALUES($1, $2, $3, $4)`,
		adminID, oldHash[:], time.Now().Add(-15*time.Minute).UnixMicro(), ente.Photos)
	require.NoError(t, err)

	userToken := fmt.Sprintf("target_active_token_%d", nowMicro)
	userHash := auth.HashToken(userToken)
	_, err = db.Exec(`INSERT INTO tokens(user_id, token_hash, creation_time, app) VALUES($1, $2, $3, $4)`,
		targetUserID, userHash[:], time.Now().UnixMicro(), ente.Photos)
	require.NoError(t, err)

	userAuthRepo := &repo.UserAuthRepository{DB: db}
	userRepo := &repo.UserRepository{DB: db}
	authCache := cache.New(time.Minute, time.Minute)
	userController := &usercontroller.UserController{
		UserAuthRepo: userAuthRepo,
		UserRepo:     userRepo,
		Cache:        authCache,
	}

	h := &AdminHandler{
		UserAuthRepo:   userAuthRepo,
		UserRepo:       userRepo,
		UserController: userController,
	}

	router := gin.New()
	router.POST("/admin/user/suspend", h.SuspendUser)
	router.POST("/admin/user/unsuspend", h.UnsuspendUser)

	// 1. Old admin token should fail
	suspendPayload := fmt.Sprintf(`{"userID":%d,"reason":"Violating community guidelines"}`, targetUserID)
	reqOld := httptest.NewRequest(http.MethodPost, "/admin/user/suspend", strings.NewReader(suspendPayload))
	reqOld.Header.Set("X-Auth-Token", oldToken)
	reqOld.Header.Set("Content-Type", "application/json")
	respOld := httptest.NewRecorder()
	router.ServeHTTP(respOld, reqOld)
	require.Equal(t, http.StatusBadRequest, respOld.Code)
	require.Contains(t, respOld.Body.String(), "Token is too old")

	// 2. Fresh token succeeds in suspending user
	reqFresh := httptest.NewRequest(http.MethodPost, "/admin/user/suspend", strings.NewReader(suspendPayload))
	reqFresh.Header.Set("X-Auth-Token", freshToken)
	reqFresh.Header.Set("Content-Type", "application/json")
	respFresh := httptest.NewRecorder()
	router.ServeHTTP(respFresh, reqFresh)
	require.Equal(t, http.StatusOK, respFresh.Code)

	// Verify database update
	var isSuspended bool
	var suspendReason string
	err = db.QueryRow(`SELECT is_suspended, suspend_reason FROM users WHERE user_id = $1`, targetUserID).Scan(&isSuspended, &suspendReason)
	require.NoError(t, err)
	require.True(t, isSuspended)
	require.Equal(t, "Violating community guidelines", suspendReason)

	// Verify target user's active tokens were deleted
	var activeTokensCount int
	err = db.QueryRow(`SELECT count(*) FROM tokens WHERE user_id = $1 AND is_deleted = false`, targetUserID).Scan(&activeTokensCount)
	require.NoError(t, err)
	require.Equal(t, 0, activeTokensCount)

	// 3. Unsuspend target user
	unsuspendPayload := fmt.Sprintf(`{"userID":%d}`, targetUserID)
	reqUnsuspend := httptest.NewRequest(http.MethodPost, "/admin/user/unsuspend", strings.NewReader(unsuspendPayload))
	reqUnsuspend.Header.Set("X-Auth-Token", freshToken)
	reqUnsuspend.Header.Set("Content-Type", "application/json")
	respUnsuspend := httptest.NewRecorder()
	router.ServeHTTP(respUnsuspend, reqUnsuspend)
	require.Equal(t, http.StatusOK, respUnsuspend.Code)

	err = db.QueryRow(`SELECT is_suspended, suspend_reason FROM users WHERE user_id = $1`, targetUserID).Scan(&isSuspended, &suspendReason)
	require.NoError(t, err)
	require.False(t, isSuspended)
	require.Equal(t, "", suspendReason)
}

func TestAbuseReportsAndDisableShare(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := getBiyenTestDB(t)

	nowMicro := time.Now().UnixMicro()
	ownerEmailHash := fmt.Sprintf("owner_hash_%d", nowMicro)
	var ownerID int64
	err := db.QueryRow(`INSERT INTO users(email_hash, creation_time) VALUES($1, $2) RETURNING user_id`, ownerEmailHash, nowMicro).Scan(&ownerID)
	require.NoError(t, err)

	// Create collection
	var collectionID int64
	err = db.QueryRow(`INSERT INTO collections(owner_id, name, encrypted_key, key_decryption_nonce, type, attributes, updation_time)
		VALUES($1, 'Test Album', 'enc_key', 'nonce', 'album', '{}', $2) RETURNING collection_id`, ownerID, nowMicro).Scan(&collectionID)
	require.NoError(t, err)

	// Create public_collection_token
	var shareID int64
	tokenStr := fmt.Sprintf("share_token_%d", nowMicro)
	err = db.QueryRow(`INSERT INTO public_collection_tokens(collection_id, access_token, is_disabled)
		VALUES($1, $2, FALSE) RETURNING id`, collectionID, tokenStr).Scan(&shareID)
	require.NoError(t, err)

	// Create public_abuse_report
	_, err = db.Exec(`INSERT INTO public_abuse_report(share_id, ip, user_agent, url, reason, details)
		VALUES($1, '127.0.0.1', 'Mozilla/5.0 Test', 'https://biyen.levitation.web.id/share/test', 'Inappropriate content', '{"comment":"spam"}')`,
		shareID)
	require.NoError(t, err)

	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM public_abuse_report WHERE share_id = $1`, shareID)
		_, _ = db.Exec(`DELETE FROM public_collection_tokens WHERE id = $1`, shareID)
		_, _ = db.Exec(`DELETE FROM collections WHERE collection_id = $1`, collectionID)
		_, _ = db.Exec(`DELETE FROM users WHERE user_id = $1`, ownerID)
	})

	h := &AdminHandler{
		UserRepo: &repo.UserRepository{DB: db},
	}

	router := gin.New()
	router.GET("/admin/abuse-reports", h.GetAbuseReports)
	router.POST("/admin/collection/disable-share", h.DisableSharedCollection)

	// 1. Get abuse reports
	reqGet := httptest.NewRequest(http.MethodGet, "/admin/abuse-reports", nil)
	respGet := httptest.NewRecorder()
	router.ServeHTTP(respGet, reqGet)
	require.Equal(t, http.StatusOK, respGet.Code)

	var reportsResponse struct {
		Reports []AbuseReportItem `json:"reports"`
	}
	err = json.Unmarshal(respGet.Body.Bytes(), &reportsResponse)
	require.NoError(t, err)
	require.NotEmpty(t, reportsResponse.Reports)

	var found bool
	for _, r := range reportsResponse.Reports {
		if r.ShareID == shareID {
			found = true
			require.Equal(t, "Inappropriate content", r.Reason)
			require.False(t, r.IsDisabled)
			break
		}
	}
	require.True(t, found, "Expected inserted abuse report to be returned")

	// 2. Disable shared collection
	disablePayload := fmt.Sprintf(`{"shareID":%d}`, shareID)
	reqDisable := httptest.NewRequest(http.MethodPost, "/admin/collection/disable-share", strings.NewReader(disablePayload))
	reqDisable.Header.Set("Content-Type", "application/json")
	respDisable := httptest.NewRecorder()
	router.ServeHTTP(respDisable, reqDisable)
	require.Equal(t, http.StatusOK, respDisable.Code)

	// Verify is_disabled in DB
	var isDisabled bool
	err = db.QueryRow(`SELECT is_disabled FROM public_collection_tokens WHERE id = $1`, shareID).Scan(&isDisabled)
	require.NoError(t, err)
	require.True(t, isDisabled)

	// Verify GetAbuseReports reflects disabled status
	respGet2 := httptest.NewRecorder()
	router.ServeHTTP(respGet2, reqGet)
	require.Equal(t, http.StatusOK, respGet2.Code)
	var reportsResponse2 struct {
		Reports []AbuseReportItem `json:"reports"`
	}
	err = json.Unmarshal(respGet2.Body.Bytes(), &reportsResponse2)
	require.NoError(t, err)
	for _, r := range reportsResponse2.Reports {
		if r.ShareID == shareID {
			require.True(t, r.IsDisabled)
			break
		}
	}
}
