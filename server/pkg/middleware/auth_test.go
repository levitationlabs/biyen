package middleware

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/ente/museum/ente"
	"github.com/ente/museum/ente/jwt"
	"github.com/ente/museum/internal/testutil"
	usercontroller "github.com/ente/museum/pkg/controller/user"
	"github.com/ente/museum/pkg/repo"
	"github.com/ente/museum/pkg/utils/auth"
	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/patrickmn/go-cache"
	"github.com/stretchr/testify/require"
)

type authRouteTestTokens struct {
	auth    string
	photos  string
	locker  string
	family  string
	payment string
}

func TestAppScopedRoutes(t *testing.T) {
	router, tokens, _ := setupAuthRouteTest(t)

	tests := []struct {
		name       string
		path       string
		token      string
		clientPkg  string
		wantStatus int
	}{
		{
			name:       "auth token can access auth route",
			path:       "/authenticator/entity/diff?sinceTime=0&limit=1",
			token:      tokens.auth,
			clientPkg:  "io.ente.auth",
			wantStatus: http.StatusNoContent,
		},
		{
			name:       "photos token cannot access auth route",
			path:       "/authenticator/entity/diff?sinceTime=0&limit=1",
			token:      tokens.photos,
			clientPkg:  "io.ente.photos",
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "locker token cannot access auth route",
			path:       "/authenticator/entity/diff?sinceTime=0&limit=1",
			token:      tokens.locker,
			clientPkg:  "io.ente.locker",
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "photos token with auth header remains invalid",
			path:       "/authenticator/entity/diff?sinceTime=0&limit=1",
			token:      tokens.photos,
			clientPkg:  "io.ente.auth",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "auth token cannot access storage route",
			path:       "/collections/v2",
			token:      tokens.auth,
			clientPkg:  "io.ente.auth",
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "auth token cannot access user entity route",
			path:       "/user-entity/entity/diff?type=contact&sinceTime=0&limit=1",
			token:      tokens.auth,
			clientPkg:  "io.ente.auth",
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "auth token cannot access contact route",
			path:       "/contacts/diff?sinceTime=0&limit=1",
			token:      tokens.auth,
			clientPkg:  "io.ente.auth",
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "auth token cannot access contact attachment route",
			path:       "/attachments/profile_picture/ua_test",
			token:      tokens.auth,
			clientPkg:  "io.ente.auth",
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "photos token can access storage route",
			path:       "/collections/v2",
			token:      tokens.photos,
			clientPkg:  "io.ente.photos",
			wantStatus: http.StatusNoContent,
		},
		{
			name:       "photos token can access user or JWT route",
			path:       "/family/test",
			token:      tokens.photos,
			clientPkg:  "io.ente.photos",
			wantStatus: http.StatusNoContent,
		},
		{
			name:       "family JWT can access user or JWT route",
			path:       "/family/test",
			token:      tokens.family,
			clientPkg:  "io.ente.photos",
			wantStatus: http.StatusNoContent,
		},
		{
			name:       "wrong scope JWT cannot access user or JWT route",
			path:       "/family/test",
			token:      tokens.payment,
			clientPkg:  "io.ente.photos",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "malformed JWT cannot access user or JWT route",
			path:       "/family/test",
			token:      "not.a.jwt",
			clientPkg:  "io.ente.photos",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "locker token can access storage route",
			path:       "/collections/v2",
			token:      tokens.locker,
			clientPkg:  "io.ente.locker",
			wantStatus: http.StatusNoContent,
		},
		{
			name:       "auth token with photos header remains invalid",
			path:       "/collections/v2",
			token:      tokens.auth,
			clientPkg:  "io.ente.photos",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "auth token still blocked when header changes after token auth",
			path:       "/files/download/123",
			token:      tokens.auth,
			clientPkg:  "io.ente.auth",
			wantStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := performAuthRouteRequest(router, tt.path, tt.token, tt.clientPkg)
			if recorder.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d; body=%s", recorder.Code, tt.wantStatus, recorder.Body.String())
			}
		})
	}
}

func TestSessionBoundJWTAuthentication(t *testing.T) {
	router, tokens, userController := setupAuthRouteTest(t)

	unboundJWT, err := userController.GetJWTToken(91001, jwt.FAMILIES)
	if err != nil {
		t.Fatalf("failed to create unbound JWT: %v", err)
	}
	if recorder := performAuthRouteRequest(router, "/family/test", unboundJWT, "io.ente.photos"); recorder.Code != http.StatusUnauthorized {
		t.Fatalf("unbound JWT status = %d, want %d; body=%s", recorder.Code, http.StatusUnauthorized, recorder.Body.String())
	}

	mismatchedJWT, err := userController.GetSessionJWTToken(91002, jwt.FAMILIES, tokens.auth, ente.Auth)
	if err != nil {
		t.Fatalf("failed to create mismatched session JWT: %v", err)
	}
	if recorder := performAuthRouteRequest(router, "/family/test", mismatchedJWT, "io.ente.photos"); recorder.Code != http.StatusUnauthorized {
		t.Fatalf("mismatched session JWT status = %d, want %d; body=%s", recorder.Code, http.StatusUnauthorized, recorder.Body.String())
	}

	boundJWT, err := userController.GetSessionJWTToken(91001, jwt.FAMILIES, tokens.auth, ente.Auth)
	if err != nil {
		t.Fatalf("failed to create session-bound JWT: %v", err)
	}
	if recorder := performAuthRouteRequest(router, "/family/test", boundJWT, "io.ente.photos"); recorder.Code != http.StatusNoContent {
		t.Fatalf("active session JWT status = %d, want %d; body=%s", recorder.Code, http.StatusNoContent, recorder.Body.String())
	}

	if err := userController.TerminateSession(91001, tokens.auth); err != nil {
		t.Fatalf("terminate origin session: %v", err)
	}
	if recorder := performAuthRouteRequest(router, "/family/test", boundJWT, "io.ente.photos"); recorder.Code != http.StatusUnauthorized {
		t.Fatalf("revoked session JWT status = %d, want %d; body=%s", recorder.Code, http.StatusUnauthorized, recorder.Body.String())
	}
}

func setupAuthRouteTest(t *testing.T) (*gin.Engine, authRouteTestTokens, *usercontroller.UserController) {
	t.Helper()

	testutil.WithServerRoot(t)
	db := testutil.RequireTestDB(t)
	testutil.ResetTables(t, db)
	t.Cleanup(func() {
		testutil.ResetTables(t, db)
	})

	userID := testutil.InsertUser(t, db, testutil.UserFixture{
		UserID:       91001,
		Email:        "auth-route-test@ente.com",
		CreationTime: 1,
	})
	userAuthRepo := &repo.UserAuthRepository{DB: db}
	tokens := authRouteTestTokens{
		auth:   "auth-route-test-auth-token",
		photos: "auth-route-test-photos-token",
		locker: "auth-route-test-locker-token",
	}
	authCache := cache.New(time.Minute, time.Minute)
	userController := &usercontroller.UserController{
		UserAuthRepo: userAuthRepo,
		Cache:        authCache,
		JwtSecret:    []byte("auth-route-test-jwt-secret"),
	}
	addTokenForTest(t, userAuthRepo, userID, ente.Auth, tokens.auth)
	addTokenForTest(t, userAuthRepo, userID, ente.Photos, tokens.photos)
	addTokenForTest(t, userAuthRepo, userID, ente.Locker, tokens.locker)
	var err error
	tokens.family, err = userController.GetSessionJWTToken(userID, jwt.FAMILIES, tokens.auth, ente.Auth)
	if err != nil {
		t.Fatalf("failed to create family JWT: %v", err)
	}
	tokens.payment, err = userController.GetSessionJWTToken(userID, jwt.PAYMENT, tokens.auth, ente.Auth)
	if err != nil {
		t.Fatalf("failed to create payment JWT: %v", err)
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	authMiddleware := &AuthMiddleware{
		UserAuthRepo:   userAuthRepo,
		Cache:          authCache,
		UserController: userController,
	}
	privateAPI := router.Group("/")
	privateAPI.Use(authMiddleware.TokenAuthMiddleware(nil))
	authenticatorAPI := privateAPI.Group("/authenticator")
	authenticatorAPI.Use(RequireAuthApp())
	authenticatorAPI.GET("/entity/diff", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	familyAPI := router.Group("/")
	familyAPI.Use(authMiddleware.TokenOrJWTAuthMiddleware(jwt.FAMILIES))
	familyAPI.GET("/family/test", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	storageAPI := privateAPI.Group("/")
	storageAPI.Use(RejectAuthApp())
	storageAPI.GET("/collections/v2", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	storageAPI.GET("/user-entity/entity/diff", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	storageAPI.GET("/contacts/diff", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	storageAPI.GET("/attachments/:type/:attachmentID", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	headerMutatingStorageAPI := privateAPI.Group("/")
	headerMutatingStorageAPI.Use(func(c *gin.Context) {
		c.Request.Header.Set("X-Client-Package", "io.ente.photos")
		c.Next()
	}, RejectAuthApp())
	headerMutatingStorageAPI.GET("/files/download/:fileID", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	return router, tokens, userController
}

func addTokenForTest(t *testing.T, userAuthRepo *repo.UserAuthRepository, userID int64, app ente.App, token string) {
	t.Helper()
	if err := userAuthRepo.AddToken(userID, app, token, "127.0.0.1", "auth-route-test"); err != nil {
		t.Fatalf("failed to add %s token: %v", app, err)
	}
}

func performAuthRouteRequest(router *gin.Engine, path string, token string, clientPkg string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.Header.Set("X-Auth-Token", token)
	req.Header.Set("X-Client-Package", clientPkg)
	router.ServeHTTP(recorder, req)
	return recorder
}

func TestSuspendedUserTokenAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var db *sql.DB
	if os.Getenv("ENV") == "test" && os.Getenv("PGDATABASE") != "" {
		db = testutil.RequireTestDB(t)
	} else {
		var err error
		db, err = sql.Open("postgres", "host=localhost port=5432 user=pguser password=pgpass dbname=ente_db sslmode=disable")
		if err != nil {
			t.Skipf("cannot open local test db: %v", err)
		}
		if err := db.Ping(); err != nil {
			t.Skipf("cannot connect to local test db: %v", err)
		}
	}

	nowMicro := time.Now().UnixMicro()
	var userID int64
	err := db.QueryRow(`INSERT INTO users(email_hash, creation_time, is_suspended) VALUES($1, $2, FALSE) RETURNING user_id`,
		fmt.Sprintf("middleware_test_%d", nowMicro), nowMicro).Scan(&userID)
	require.NoError(t, err)

	userToken := fmt.Sprintf("test_token_%d", nowMicro)
	tokenHash := auth.HashToken(userToken)
	_, err = db.Exec(`INSERT INTO tokens(user_id, token_hash, creation_time, app) VALUES($1, $2, $3, $4)`,
		userID, tokenHash[:], nowMicro, ente.Photos)
	require.NoError(t, err)

	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM tokens WHERE user_id = $1`, userID)
		_, _ = db.Exec(`DELETE FROM users WHERE user_id = $1`, userID)
	})

	userAuthRepo := &repo.UserAuthRepository{DB: db}
	authCache := cache.New(time.Minute, time.Minute)
	userController := &usercontroller.UserController{
		UserAuthRepo: userAuthRepo,
		Cache:        authCache,
	}
	authMiddleware := &AuthMiddleware{
		UserAuthRepo:   userAuthRepo,
		Cache:          authCache,
		UserController: userController,
	}

	router := gin.New()
	router.Use(authMiddleware.TokenAuthMiddleware(nil))
	router.GET("/test-protected", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	// 1. User is not suspended -> 200 OK
	reqActive := httptest.NewRequest(http.MethodGet, "/test-protected", nil)
	reqActive.Header.Set("X-Auth-Token", userToken)
	reqActive.Header.Set("X-Client-Package", "io.ente.photos")
	respActive := httptest.NewRecorder()
	router.ServeHTTP(respActive, reqActive)
	require.Equal(t, http.StatusOK, respActive.Code)

	// 2. Suspend user in DB and clear cache
	_, err = db.Exec(`UPDATE users SET is_suspended = TRUE, suspend_reason = 'Suspicious activity' WHERE user_id = $1`, userID)
	require.NoError(t, err)
	authCache.Delete(ente.SuspendedUserCachePrefix + strconv.FormatInt(userID, 10))

	// 3. Request should return 403 Forbidden with exact payload
	reqSuspended := httptest.NewRequest(http.MethodGet, "/test-protected", nil)
	reqSuspended.Header.Set("X-Auth-Token", userToken)
	reqSuspended.Header.Set("X-Client-Package", "io.ente.photos")
	respSuspended := httptest.NewRecorder()
	router.ServeHTTP(respSuspended, reqSuspended)
	require.Equal(t, http.StatusForbidden, respSuspended.Code)

	var errResp map[string]string
	err = json.Unmarshal(respSuspended.Body.Bytes(), &errResp)
	require.NoError(t, err)
	require.Equal(t, "account_suspended", errResp["error"])
	require.Equal(t, "Akun Anda ditangguhkan sementara. Hubungi bantuan untuk memulihkan akses sebelum masa aktif langganan berakhir.", errResp["message"])
}

