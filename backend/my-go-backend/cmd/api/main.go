package main

import (
	"database/sql"
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/adaptor"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

var (
	jwtSecret  []byte
	db         *sql.DB
	storageDir = "./git-data"
)

// User يُعرف هيكل المستخدم لاستخدامه في المسارات الداخلية
type User struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
}

type CreateRepoRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	IsPrivate   bool   `json:"is_private"`
	AddReadme   bool   `json:"add_readme"`
	Gitignore   string `json:"gitignore"`
	License     string `json:"license"`
}

type Repository struct {
	ID          int    `json:"id"`
	Owner       string `json:"owner"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsPrivate   bool   `json:"is_private"`
	AddReadme   bool   `json:"add_readme"`
	Gitignore   string `json:"gitignore"`
	License     string `json:"license"`
}

// دالة افتراضية لاستدعاء RegisterRoutes إذا لم تكن معرفة في حزمة خارجية
var RegisterRoutes = func(router fiber.Router, db *sql.DB, secret []byte) {
	// يتم وضع مسارات auth الخاصة بك هنا
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("تنبيه: لم يتم العثور على ملف .env، سيتم الاعتماد على متغيرات البيئة بالنظام")
	}

	jwtSecret = []byte(getEnv("JWT_SECRET", "super-secret-gitport-key-2026"))

	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		log.Fatal("خطأ: لم يتم ضبط متغيّر DATABASE_URL في البيئة أو ملف .env")
	}

	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("فشل الاتصال بقاعدة البيانات: %v", err)
	}
	defer db.Close()

	if err = db.Ping(); err != nil {
		log.Fatalf("قاعدة البيانات لا تستجيب: %v", err)
	}

	createUsersTableQuery := `
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
    );`
	if _, err := db.Exec(createUsersTableQuery); err != nil {
		log.Fatalf("فشل إنشاء جدول المستخدمين: %v", err)
	}

	createReposTableQuery := `
    CREATE TABLE IF NOT EXISTS repositories (
        id SERIAL PRIMARY KEY,
        owner VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_private BOOLEAN DEFAULT FALSE,
        add_readme BOOLEAN DEFAULT FALSE,
        gitignore VARCHAR(50) DEFAULT 'None',
        license VARCHAR(50) DEFAULT 'None',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(owner, name)
    );`
	if _, err := db.Exec(createReposTableQuery); err != nil {
		log.Fatalf("فشل إنشاء جدول المستودعات: %v", err)
	}

	if err := os.MkdirAll(storageDir, 0755); err != nil {
		log.Fatalf("فشل إنشاء مجلد المستودعات: %v", err)
	}

	app := fiber.New(fiber.Config{
		BodyLimit: 100 * 1024 * 1024,
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-Requested-With",
		AllowMethods:     "GET, POST, HEAD, PUT, DELETE, PATCH, OPTIONS",
		AllowCredentials: false,
	}))

	app.Options("*", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	app.Use(logger.New())

	api := app.Group("/api/v1")

	// ربط مسارات التسجيل والدخول
	RegisterRoutes(api, db, jwtSecret)

	api.Get("/repositories", func(c *fiber.Ctx) error {
		rows, err := db.Query(`SELECT id, owner, name, COALESCE(description, ''), is_private, add_readme, COALESCE(gitignore, 'None'), COALESCE(license, 'None') FROM repositories ORDER BY id DESC`)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "خطأ في جلب المستودعات"})
		}
		defer rows.Close()

		repos := []Repository{}
		for rows.Next() {
			var r Repository
			if err := rows.Scan(&r.ID, &r.Owner, &r.Name, &r.Description, &r.IsPrivate, &r.AddReadme, &r.Gitignore, &r.License); err != nil {
				continue
			}
			repos = append(repos, r)
		}

		return c.Status(fiber.StatusOK).JSON(repos)
	})

	api.Get("/repositories/:owner/:repo", func(c *fiber.Ctx) error {
		owner := c.Params("owner")
		repoName := c.Params("repo")

		var r Repository
		query := `SELECT id, owner, name, COALESCE(description, ''), is_private, add_readme, COALESCE(gitignore, 'None'), COALESCE(license, 'None')
                  FROM repositories WHERE LOWER(owner) = LOWER($1) AND LOWER(name) = LOWER($2)`

		err := db.QueryRow(query, owner, repoName).Scan(
			&r.ID, &r.Owner, &r.Name, &r.Description, &r.IsPrivate, &r.AddReadme, &r.Gitignore, &r.License,
		)

		if err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "المستودع غير موجود"})
		}

		return c.Status(fiber.StatusOK).JSON(r)
	})

	api.Get("/repositories/:owner/:repo/files", func(c *fiber.Ctx) error {
		owner := c.Params("owner")
		repoName := strings.TrimSuffix(c.Params("repo"), ".git")
		repoPath := filepath.Join(storageDir, owner, repoName+".git")

		if _, err := os.Stat(repoPath); os.IsNotExist(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "المستودع غير موجود"})
		}

		var output []byte
		var err error
		for _, branch := range []string{"main", "master"} {
			cmd := exec.Command("git", "ls-tree", "-r", "--name-only", branch)
			cmd.Dir = repoPath
			output, err = cmd.Output()
			if err == nil && len(output) > 0 {
				break
			}
		}

		if err != nil || len(output) == 0 {
			return c.Status(fiber.StatusOK).JSON(fiber.Map{
				"has_commits": false,
				"files":       []string{},
			})
		}

		fileLines := strings.Split(strings.TrimSpace(string(output)), "\n")
		var files []string
		for _, line := range fileLines {
			if trimmed := strings.TrimSpace(line); trimmed != "" {
				files = append(files, trimmed)
			}
		}

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"has_commits": true,
			"files":       files,
		})
	})

	api.Get("/repositories/:owner/:repo/file-content", func(c *fiber.Ctx) error {
		owner := c.Params("owner")
		repoName := strings.TrimSuffix(c.Params("repo"), ".git")
		filePath := filepath.Clean(c.Query("path"))

		if filePath == "" || filePath == "." || strings.HasPrefix(filePath, "..") {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "مسار الملف غير صالحة"})
		}

		repoPath := filepath.Join(storageDir, owner, repoName+".git")
		if _, err := os.Stat(repoPath); os.IsNotExist(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "المستودع غير موجود"})
		}

		var output []byte
		var err error
		for _, branch := range []string{"main", "master"} {
			cmd := exec.Command("git", "show", fmt.Sprintf("%s:%s", branch, filePath))
			cmd.Dir = repoPath
			output, err = cmd.Output()
			if err == nil {
				break
			}
		}

		if err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "عذراً، لم يتم العثور على الملف"})
		}

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"path":    filePath,
			"content": string(output),
		})
	})

	secured := api.Group("/", authMiddleware())

	secured.Get("/me", func(c *fiber.Ctx) error {
		username, ok := c.Locals("username").(string)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "غير مصرح"})
		}

		var user User
		query := `SELECT id, username FROM users WHERE username = $1`
		err := db.QueryRow(query, username).Scan(&user.ID, &user.Username)
		if err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"exists": false,
				"error":  "الحساب غير موجود",
			})
		}

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"exists": true,
			"user": fiber.Map{
				"id":       user.ID,
				"username": user.Username,
			},
		})
	})

	secured.Post("/repositories", func(c *fiber.Ctx) error {
		username := c.Locals("username").(string)

		var req CreateRepoRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "البيانات غير صالحة"})
		}

		repoName := strings.TrimSpace(req.Name)
		if repoName == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "اسم المستودع مطلوب"})
		}

		var repoID int
		insertQuery := `
            INSERT INTO repositories (owner, name, description, is_private, add_readme, gitignore, license)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id;
        `

		err := db.QueryRow(
			insertQuery,
			username,
			repoName,
			req.Description,
			req.IsPrivate,
			req.AddReadme,
			req.Gitignore,
			req.License,
		).Scan(&repoID)

		if err != nil {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "المستودع بهذا الاسم موجود بالفعل لديك",
			})
		}

		repoPath := filepath.Join(storageDir, username, repoName+".git")
		if err := os.MkdirAll(repoPath, 0755); err == nil {
			cmd := exec.Command("git", "init", "--bare", "--initial-branch=main", repoPath)
			if err := cmd.Run(); err != nil {
				cmdFallback := exec.Command("git", "init", "--bare", repoPath)
				_ = cmdFallback.Run()
				_ = exec.Command("git", "-C", repoPath, "symbolic-ref", "HEAD", "refs/heads/main").Run()
			}
		}

		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"message": "تم إنشاء المستودع بنجاح",
			"repository": fiber.Map{
				"id":          repoID,
				"owner":       username,
				"name":        repoName,
				"description": req.Description,
				"is_private":  req.IsPrivate,
			},
		})
	})

	secured.Delete("/repositories/:owner/:repo", func(c *fiber.Ctx) error {
		currentUsername := c.Locals("username").(string)
		owner := c.Params("owner")
		repoName := c.Params("repo")

		if !strings.EqualFold(owner, currentUsername) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "غير مصرح لك بحذف مستودع لا يخصك"})
		}

		deleteQuery := `DELETE FROM repositories WHERE LOWER(owner) = LOWER($1) AND LOWER(name) = LOWER($2)`
		result, err := db.Exec(deleteQuery, owner, repoName)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "خطأ أثناء حذف المستودع"})
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil || rowsAffected == 0 {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "المستودع غير موجود"})
		}

		repoPath := filepath.Join(storageDir, owner, repoName+".git")
		_ = os.RemoveAll(repoPath)

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"message": "تم حذف المستودع بنجاح",
		})
	})

	secured.Post("/repositories/:owner/:repo/save-file", func(c *fiber.Ctx) error {
		currentUsername := c.Locals("username").(string)
		owner := c.Params("owner")
		repoName := strings.TrimSuffix(c.Params("repo"), ".git")

		if !strings.EqualFold(owner, currentUsername) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "غير مصرح لك للتعديل على هذا المستودع"})
		}

		var req struct {
			Path    string `json:"path"`
			Content string `json:"content"`
			Message string `json:"message"`
		}

		if err := c.BodyParser(&req); err != nil || req.Path == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "بيانات الطلب غير صالحة"})
		}

		cleanPath := filepath.Clean(req.Path)
		if cleanPath == "." || strings.HasPrefix(cleanPath, "..") {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "مسار الملف غير آمن"})
		}

		bareRepoPath := filepath.Join(storageDir, owner, repoName+".git")
		if _, err := os.Stat(bareRepoPath); os.IsNotExist(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "المستودع غير موجود"})
		}

		tmpDir, err := os.MkdirTemp("", "gitport-edit-*")
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "فشل إنشاء بيئة العمل المؤقتة"})
		}
		defer os.RemoveAll(tmpDir)

		cloneCmd := exec.Command("git", "clone", bareRepoPath, tmpDir)
		if err := cloneCmd.Run(); err != nil {
			initCmd := exec.Command("git", "init")
			initCmd.Dir = tmpDir
			_ = initCmd.Run()

			_ = exec.Command("git", "-C", tmpDir, "checkout", "-b", "main").Run()
			remoteCmd := exec.Command("git", "remote", "add", "origin", bareRepoPath)
			remoteCmd.Dir = tmpDir
			_ = remoteCmd.Run()
		} else {
			checkBranch := exec.Command("git", "-C", tmpDir, "checkout", "main")
			if err := checkBranch.Run(); err != nil {
				_ = exec.Command("git", "-C", tmpDir, "checkout", "-b", "main").Run()
			}
		}

		fullFilePath := filepath.Join(tmpDir, cleanPath)
		dir := filepath.Dir(fullFilePath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "فشل إنشاء مجلدات الملف"})
		}

		if err := os.WriteFile(fullFilePath, []byte(req.Content), 0644); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "فشل حفظ الملف على القرص"})
		}

		_ = exec.Command("git", "-C", tmpDir, "config", "user.name", currentUsername).Run()
		_ = exec.Command("git", "-C", tmpDir, "config", "user.email", fmt.Sprintf("%s@gitport.local", currentUsername)).Run()

		if err := exec.Command("git", "-C", tmpDir, "add", cleanPath).Run(); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "فشل إضافة الملف لـ Git"})
		}

		commitMsg := req.Message
		if commitMsg == "" {
			commitMsg = fmt.Sprintf("Update %s via GitPort Web", cleanPath)
		}

		cmdCommit := exec.Command("git", "-C", tmpDir, "commit", "-m", commitMsg)
		if err := cmdCommit.Run(); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "لم يتم رصد تغييرات جديدة للالتزام بها"})
		}

		cmdPush := exec.Command("git", "-C", tmpDir, "push", "-u", "origin", "main")
		if err := cmdPush.Run(); err != nil {
			cmdPushMaster := exec.Command("git", "-C", tmpDir, "push", "-u", "origin", "master")
			if err := cmdPushMaster.Run(); err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "فشل رفع التعديلات للخادم"})
			}
		}

		_ = exec.Command("git", "-C", bareRepoPath, "symbolic-ref", "HEAD", "refs/heads/main").Run()

		return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "تم حفظ وتحديث الملف بنجاح"})
	})

	gitGroup := app.Group("/git/:owner/:repo", gitAuthMiddleware())
	gitGroup.Get("/info/refs", gitHTTPHandler)
	gitGroup.Post("/git-receive-pack", gitHTTPHandler)
	gitGroup.Post("/git-upload-pack", gitHTTPHandler)

	port := getEnv("PORT", "8080")
	log.Printf("GitPort Secure Backend Server Ready on port :%s...", port)
	log.Fatal(app.Listen(fmt.Sprintf(":%s", port)))
}

func parseBasicAuth(c *fiber.Ctx) (string, string, bool) {
	auth := c.Get("Authorization")
	if auth == "" || !strings.HasPrefix(auth, "Basic ") {
		return "", "", false
	}

	payload, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(auth, "Basic "))
	if err != nil {
		return "", "", false
	}

	pair := strings.SplitN(string(payload), ":", 2)
	if len(pair) != 2 {
		return "", "", false
	}

	return pair[0], pair[1], true
}

func gitAuthMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		owner := c.Params("owner")
		repoParam := c.Params("repo")
		repoName := strings.TrimSuffix(repoParam, ".git")

		var repoOwner string
		var isPrivate bool
		queryRepo := `SELECT owner, is_private FROM repositories WHERE LOWER(owner) = LOWER($1) AND LOWER(name) = LOWER($2)`
		err := db.QueryRow(queryRepo, owner, repoName).Scan(&repoOwner, &isPrivate)
		if err != nil {
			repoOwner = owner
			isPrivate = false
		}

		service := c.Query("service")
		isReadOp := strings.HasSuffix(c.Path(), "/git-upload-pack") || service == "git-upload-pack"
		isWriteOp := strings.HasSuffix(c.Path(), "/git-receive-pack") || service == "git-receive-pack"

		if !isPrivate && isReadOp {
			return c.Next()
		}

		username, password, ok := parseBasicAuth(c)
		if !ok {
			c.Set("WWW-Authenticate", `Basic realm="GitPort"`)
			return c.Status(fiber.StatusUnauthorized).SendString("مطلوب تسجيل الدخول لاستخدام هذا المستودع")
		}

		var hashedPassword string
		queryUser := `SELECT password FROM users WHERE LOWER(username) = LOWER($1)`
		err = db.QueryRow(queryUser, username).Scan(&hashedPassword)
		if err != nil {
			c.Set("WWW-Authenticate", `Basic realm="GitPort"`)
			return c.Status(fiber.StatusUnauthorized).SendString("اسم المستخدم أو كلمة المرور غير صحيحة")
		}

		if err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password)); err != nil {
			c.Set("WWW-Authenticate", `Basic realm="GitPort"`)
			return c.Status(fiber.StatusUnauthorized).SendString("اسم المستخدم أو كلمة المرور غير صحيحة")
		}

		if isPrivate || isWriteOp {
			if !strings.EqualFold(username, repoOwner) {
				return c.Status(fiber.StatusForbidden).SendString("غير مصرح لك للوصول إلى هذا المستودع")
			}
		}

		c.Locals("username", username)
		return c.Next()
	}
}

func gitHTTPHandler(c *fiber.Ctx) error {
	owner := c.Params("owner")
	repo := c.Params("repo")

	repoName := strings.TrimSuffix(repo, ".git")
	repoPath := filepath.Join(storageDir, owner, repoName+".git")

	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		if err := os.MkdirAll(repoPath, 0755); err != nil {
			return c.Status(fiber.StatusInternalServerError).SendString("فشل إنشاء مجلد المستودع")
		}
		cmd := exec.Command("git", "init", "--bare", "--initial-branch=main", repoPath)
		if err := cmd.Run(); err != nil {
			cmdFallback := exec.Command("git", "init", "--bare", repoPath)
			_ = cmdFallback.Run()
			_ = exec.Command("git", "-C", repoPath, "symbolic-ref", "HEAD", "refs/heads/main").Run()
		}
	}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		service := r.URL.Query().Get("service")

		if strings.HasSuffix(r.URL.Path, "/info/refs") {
			w.Header().Set("Content-Type", fmt.Sprintf("application/x-%s-advertisement", service))
			w.Header().Set("Cache-Control", "no-cache, max-age=0, must-revalidate")
			w.WriteHeader(http.StatusOK)

			packet := fmt.Sprintf("# service=%s\n", service)
			length := len(packet) + 4
			fmt.Fprintf(w, "%04x%s0000", length, packet)

			subCmd := strings.TrimPrefix(service, "git-")
			cmd := exec.Command("git", subCmd, "--stateless-rpc", "--advertise-refs", repoPath)
			cmd.Stdout = w
			_ = cmd.Run()
			return
		}

		var subCmd string
		if strings.HasSuffix(r.URL.Path, "/git-receive-pack") {
			subCmd = "receive-pack"
		} else if strings.HasSuffix(r.URL.Path, "/git-upload-pack") {
			subCmd = "upload-pack"
		}

		if subCmd != "" {
			w.Header().Set("Content-Type", fmt.Sprintf("application/x-git-%s-result", subCmd))
			w.Header().Set("Cache-Control", "no-cache, max-age=0, must-revalidate")
			w.WriteHeader(http.StatusOK)

			cmd := exec.Command("git", subCmd, "--stateless-rpc", repoPath)
			cmd.Stdin = r.Body
			cmd.Stdout = w
			_ = cmd.Run()
			return
		}

		http.NotFound(w, r)
	})

	return adaptor.HTTPHandler(handler)(c)
}

func authMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "غير مخول، يجب تسجيل الدخول أولاً"})
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

		token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("طريقة التوقيع غير متوافقة: %v", token.Header["alg"])
			}
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "جلسة غير صالحة أو منتهية الصلاحية"})
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "بيانات الجلسة غير صالحة"})
		}

		username, ok := claims["username"].(string)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "معرف المستخدم مفقود في الجلسة"})
		}

		c.Locals("username", username)
		return c.Next()
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists && value != "" {
		return value
	}
	return fallback
}