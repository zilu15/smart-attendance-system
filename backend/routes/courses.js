const express = require("express");
const pool = require("../db");
const {
  verifyToken,
  allowRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

// List courses
router.get("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role === "teacher") {
      const result = await pool.query(
        `SELECT c.id, c.course_name, c.course_code, c.created_at,
                COUNT(e.id)::int AS enrolled_students_count
         FROM courses c
         LEFT JOIN enrollments e ON e.course_id = c.id
         WHERE c.teacher_id = $1
         GROUP BY c.id
         ORDER BY c.created_at DESC`,
        [req.user.id]
      );

      return res.status(200).json({
        status: "success",
        courses: result.rows,
      });
    }

    // For students: list all courses and whether this student is enrolled
    const result = await pool.query(
      `SELECT c.id, c.course_name, c.course_code, u.full_name AS teacher_name,
              c.created_at,
              EXISTS (
                SELECT 1 FROM enrollments e
                WHERE e.course_id = c.id AND e.student_id = $1
              ) AS is_enrolled
       FROM courses c
       JOIN users u ON u.id = c.teacher_id
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );

    return res.status(200).json({
      status: "success",
      courses: result.rows,
    });
  } catch (error) {
    console.error("Failed to fetch courses:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Unable to fetch courses.",
    });
  }
});

// Create a course (teachers only)
router.post("/", verifyToken, allowRoles("teacher"), async (req, res) => {
  try {
    const { course_name, course_code } = req.body;

    if (
      typeof course_name !== "string" ||
      typeof course_code !== "string" ||
      !course_name.trim() ||
      !course_code.trim()
    ) {
      return res.status(400).json({
        status: "error",
        message: "Course name and course code are required.",
      });
    }

    const name = course_name.trim();
    const code = course_code.trim().toUpperCase();

    if (name.length > 150 || code.length > 30) {
      return res.status(400).json({
        status: "error",
        message: "Course name or course code is too long.",
      });
    }

    const result = await pool.query(
      `INSERT INTO courses (course_name, course_code, teacher_id)
       VALUES ($1, $2, $3)
       RETURNING id, course_name, course_code, teacher_id, created_at`,
      [name, code, req.user.id]
    );

    return res.status(201).json({
      status: "success",
      message: "Course created successfully.",
      course: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        status: "error",
        message: "That course code already exists.",
      });
    }

    console.error("Course creation failed:", error.message);

    return res.status(500).json({
      status: "error",
      message: "Unable to create course.",
    });
  }
});

// Enroll in a course (students only)
router.post(
  "/:id/enroll",
  verifyToken,
  allowRoles("student"),
  async (req, res) => {
    try {
      const courseId = Number(req.params.id);

      if (!Number.isSafeInteger(courseId) || courseId <= 0) {
        return res.status(400).json({
          status: "error",
          message: "Provide a valid course ID.",
        });
      }

      // Check if course exists
      const courseResult = await pool.query(
        "SELECT id, course_name, course_code FROM courses WHERE id = $1",
        [courseId]
      );

      if (courseResult.rowCount === 0) {
        return res.status(404).json({
          status: "error",
          message: "Course not found.",
        });
      }

      const result = await pool.query(
        `INSERT INTO enrollments (student_id, course_id)
         VALUES ($1, $2)
         ON CONFLICT (student_id, course_id) DO NOTHING
         RETURNING id, student_id, course_id, enrolled_at`,
        [req.user.id, courseId]
      );

      if (result.rowCount === 0) {
        return res.status(409).json({
          status: "error",
          message: "You are already enrolled in this course.",
        });
      }

      return res.status(201).json({
        status: "success",
        message: `Successfully enrolled in ${courseResult.rows[0].course_name} (${courseResult.rows[0].course_code}).`,
        enrollment: result.rows[0],
      });
    } catch (error) {
      console.error("Enrollment failed:", error.message);
      return res.status(500).json({
        status: "error",
        message: "Unable to enroll in course.",
      });
    }
  }
);

module.exports = router;
