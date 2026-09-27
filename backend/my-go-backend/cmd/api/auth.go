package main

import (
	"database/sql"
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type User struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Password string `json:"-"`
}

// RegisterRoutes يقوم بتسجيل مسارات المصادقة ضمن مجموعة الـ API
func RegisterRoutes(api fiber.Router, db *sql.DB, jwtSecret []byte) {
	api.Post("/register", func(c *fiber.Ctx) error {
		var req LoginRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "البيانات غير صالحة"})
		}

		username := strings.TrimSpace(req.Username)
		if len(username) < 3 || len(req.Password) < 6 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "اسم المستخدم يجب ألا يقل عن 3 أحرف وكلمة المرور عن 6 أحرف"})
		}

		matched, _ := regexp.MatchString(`^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$`, username)
		if !matched {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "اسم المستخدم يجب أن يحتوي فقط على أحرف إنجليزية، أرقام، أو شرطة (-), بدون رموز خاصة",
			})
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "خطأ في التشفير"})
		}

		var userID int
		insertQuery := `INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id`
		err = db.QueryRow(insertQuery, username, string(hashedPassword)).Scan(&userID)
		if err != nil {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "اسم المستخدم مستخدم بالفعل"})
		}

		token, err := generateJWTToken(username, jwtSecret)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "فشل إنشاء رمز المصادقة"})
		}

		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"message": "تم إنشاء الحساب بنجاح",
			"token":   token,
			"user": fiber.Map{
				"id":       userID,
				"username": username,
			},
		})
	})

	api.Post("/login", func(c *fiber.Ctx) error {
		var req LoginRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "البيانات غير صالحة"})
		}

		username := strings.TrimSpace(req.Username)
		var user User
		query := `SELECT id, username, password FROM users WHERE username = $1`
		err := db.QueryRow(query, username).Scan(&user.ID, &user.Username, &user.Password)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "اسم المستخدم أو كلمة المرور غير صحيحة"})
		}

		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "اسم المستخدم أو كلمة المرور غير صحيحة"})
		}

		token, err := generateJWTToken(user.Username, jwtSecret)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "فشل إنشاء رمز المصادقة"})
		}

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"message": "تم تسجيل الدخول بنجاح",
			"token":   token,
			"user": fiber.Map{
				"id":       user.ID,
				"username": user.Username,
			},
		})
	})
}

func generateJWTToken(username string, jwtSecret []byte) (string, error) {
	claims := jwt.MapClaims{
		"username": username,
		"exp":      time.Now().Add(time.Hour * 72).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}