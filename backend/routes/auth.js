
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body;

    // Validate required fields
    if (!full_name || !email || !password || !role) {
      return res.status(400).json({
        status: "error",
        message: "All fields are required",
      });
    }

    // Validate name
    if (typeof full_name !== "string" || full_name.trim().length < 2 ||
        full_name.trim().length > 100) {
      return res.status(400).json({
        status: "error",
        message: "Name must contain between 2 and 100 characters",
      });
    }

    // Validate email
    if (typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        status: "error",
        message: "Enter a valid email address",
      });
    }

    // Validate password
    if (typeof password !== "string" || password.length < 8 ||
        password.length > 72) {
      return res.status(400).json({
        status: "error",
        message: "Password must contain between 8 and 72 characters",
      });
    }

    // Validate role
    if (!["student", "teacher"].includes(role)) {
      return res.status(400).json({
        status: "error",
        message: "Role must be student or teacher",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check whether the email already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        status: "error",
        message: "An account with this email already exists",
      });
    }

    // Hash the password before saving it
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role, created_at`,
      [full_name.trim(), normalizedEmail, passwordHash, role]
    );

    const user = result.rows[0];

    // Create a JWT token
    const token = jwt.sign(
      { role: user.role },
      process.env.JWT_SECRET,
      {
        subject: String(user.id),
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      }
    );

    return res.status(201).json({
      status: "success",
      message: "Account registered successfully",
      token,
      user,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        status: "error",
        message: "An account with this email already exists",
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      status: "error",
      message: "Unable to register account",
    });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string" ||
        !email.trim() || !password) {
      return res.status(400).json({
        status: "error",
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, role
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    const user = result.rows[0];

    // Use the same response for an unknown email and wrong password
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { role: user.role },
      process.env.JWT_SECRET,
      {
        subject: String(user.id),
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      }
    );

    return res.status(200).json({
      status: "success",
      message: "Login successful",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      status: "error",
      message: "Unable to log in",
    });
  }
});

module.exports = router;
