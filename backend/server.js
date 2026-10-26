
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const { verifyToken, allowRoles } = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
// Health-check endpoint

const pool = require("./db");

// Health-check endpoint
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "success",
      message: "Smart Attendance API is running",
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(503).json({
      status: "error",
      message: "Smart Attendance API is running, but the database is unavailable",
      database: "disconnected",
    });
  }
});

// Protected test endpoint: teachers only
app.get(
  "/api/test/teacher",
  verifyToken,
  allowRoles("teacher"),
  (req, res) => {
    res.status(200).json({
      status: "success",
      message: "Teacher access granted",
      user: req.user,
    });
  }
);
 // Protected test endpoint: teachers only
app.get(
  "/api/test/teacher",
  verifyToken,
  allowRoles("teacher"),
  (req, res) => {
    res.status(200).json({
      status: "success",
      message: "Teacher access granted",
      user: req.user,
    });
  }
);

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});
