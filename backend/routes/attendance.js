const express = require("express");
const crypto = require("crypto");
const pool = require("../db");
const {
  verifyToken,
  allowRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

// Create an attendance session (teachers only)
router.post(
  "/sessions",
  verifyToken,
  allowRoles("teacher"),
  async (req, res) => {
    try {
      const { course_id, session_name, duration_minutes } = req.body;

      const courseId = Number(course_id);
      const duration = Number(duration_minutes);

      if (
        !Number.isSafeInteger(courseId) ||
        courseId <= 0 ||
        typeof session_name !== "string" ||
        !session_name.trim() ||
        session_name.trim().length > 150 ||
        !Number.isInteger(duration) ||
        duration < 1 ||
        duration > 240
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Provide a valid course ID, session name, and duration from 1 to 240 minutes.",
        });
      }

      const courseResult = await pool.query(
        "SELECT id FROM courses WHERE id = $1 AND teacher_id = $2",
        [courseId, req.user.id]
      );

      if (courseResult.rowCount === 0) {
        return res.status(404).json({
          status: "error",
          message: "Course not found or you do not own this course.",
        });
      }

      const qrToken = crypto.randomBytes(32).toString("hex");

      const qrTokenHash = crypto
        .createHash("sha256")
        .update(qrToken)
        .digest("hex");

      const result = await pool.query(
        `INSERT INTO attendance_sessions
          (course_id, teacher_id, session_name, qr_token_hash,
           starts_at, expires_at)
         VALUES
          ($1, $2, $3, $4, CURRENT_TIMESTAMP,
           CURRENT_TIMESTAMP + ($5 * INTERVAL '1 minute'))
         RETURNING id, course_id, teacher_id, session_name,
                   starts_at, expires_at, is_active`,
        [
          courseId,
          req.user.id,
          session_name.trim(),
          qrTokenHash,
          duration,
        ]
      );

      return res.status(201).json({
        status: "success",
        message: "Attendance session created successfully.",
        session: result.rows[0],
        qr_token: qrToken,
      });
    } catch (error) {
      console.error(
        "Attendance session creation failed:",
        error.message
      );

      return res.status(500).json({
        status: "error",
        message: "Unable to create attendance session.",
      });
    }
  }
);

// Mark attendance using a QR token (students only)
router.post(
  "/mark",
  verifyToken,
  allowRoles("student"),
  async (req, res) => {
    const { qr_token } = req.body;

    if (
      typeof qr_token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(qr_token)
    ) {
      return res.status(400).json({
        status: "error",
        message: "A valid QR token is required.",
      });
    }

    const qrTokenHash = crypto
      .createHash("sha256")
      .update(qr_token)
      .digest("hex");

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Find a valid, active, unexpired session.
      const sessionResult = await client.query(
        `SELECT id, course_id, session_name
         FROM attendance_sessions
         WHERE qr_token_hash = $1
           AND is_active = TRUE
           AND starts_at <= CURRENT_TIMESTAMP
           AND expires_at > CURRENT_TIMESTAMP
         FOR SHARE`,
        [qrTokenHash]
      );

      if (sessionResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          status: "error",
          message: "This QR code is invalid, inactive, or expired.",
        });
      }

      const session = sessionResult.rows[0];

      // Check that the student is enrolled in this course.
      const enrollmentResult = await client.query(
        `SELECT id
         FROM enrollments
         WHERE student_id = $1 AND course_id = $2`,
        [req.user.id, session.course_id]
      );

      if (enrollmentResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          status: "error",
          message: "You are not enrolled in this course.",
        });
      }

      // The database's unique constraint prevents duplicate attendance.
      const attendanceResult = await client.query(
        `INSERT INTO attendance_records
           (session_id, student_id, marked_at, status)
         VALUES ($1, $2, CURRENT_TIMESTAMP, 'present')
         ON CONFLICT (session_id, student_id) DO NOTHING
         RETURNING id, session_id, student_id, marked_at, status`,
        [session.id, req.user.id]
      );

      if (attendanceResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          status: "error",
          message: "Your attendance has already been marked.",
        });
      }

      await client.query("COMMIT");

      return res.status(201).json({
        status: "success",
        message: "Attendance marked successfully.",
        attendance: attendanceResult.rows[0],
        session_name: session.session_name,
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Marking attendance failed:", error.message);

      return res.status(500).json({
        status: "error",
        message: "Unable to mark attendance.",
      });
    } finally {
      client.release();
    }
  }
);

// Get attendance risk report for all students in a course (teachers only - ML powered)
router.get(
  "/courses/:courseId/risk-report",
  verifyToken,
  allowRoles("teacher"),
  async (req, res) => {
    try {
      const courseId = Number(req.params.courseId);
      if (!Number.isSafeInteger(courseId) || courseId <= 0) {
        return res.status(400).json({
          status: "error",
          message: "Provide a valid course ID.",
        });
      }

      // Verify course ownership
      const courseResult = await pool.query(
        "SELECT id, course_name, course_code FROM courses WHERE id = $1 AND teacher_id = $2",
        [courseId, req.user.id]
      );

      if (courseResult.rowCount === 0) {
        return res.status(404).json({
          status: "error",
          message: "Course not found or you do not own this course.",
        });
      }

      const course = courseResult.rows[0];

      // Count total sessions held
      const sessionsResult = await pool.query(
        "SELECT COUNT(*)::int AS total_sessions FROM attendance_sessions WHERE course_id = $1",
        [courseId]
      );
      const totalSessions = sessionsResult.rows[0].total_sessions;

      // Query enrolled students and attendance count
      const studentsResult = await pool.query(
        `SELECT u.id AS student_id, u.full_name AS student_name, u.email,
                COUNT(ar.id)::int AS attended_sessions
         FROM enrollments e
         JOIN users u ON u.id = e.student_id
         LEFT JOIN attendance_sessions s ON s.course_id = e.course_id
         LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = u.id
         WHERE e.course_id = $1
         GROUP BY u.id, u.full_name, u.email
         ORDER BY u.full_name ASC`,
        [courseId]
      );

      const enrolledStudents = studentsResult.rows;

      if (enrolledStudents.length === 0) {
        return res.status(200).json({
          status: "success",
          report: {
            course_id: course.id,
            course_name: course.course_name,
            total_sessions: totalSessions,
            total_evaluated: 0,
            high_risk_count: 0,
            medium_risk_count: 0,
            low_risk_count: 0,
            students: [],
          },
        });
      }

      // Call ML Service batch prediction
      try {
        const mlPayload = {
          course_id: course.id,
          course_name: course.course_name,
          students: enrolledStudents.map((s) => ({
            student_id: Number(s.student_id),
            student_name: s.student_name,
            attended_sessions: Number(s.attended_sessions),
            total_sessions: Math.max(1, totalSessions),
            consecutive_absences: Math.max(0, totalSessions - Number(s.attended_sessions)),
          })),
        };

        const mlRes = await fetch(`${ML_SERVICE_URL}/predict-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mlPayload),
        });

        if (mlRes.ok) {
          const report = await mlRes.json();
          return res.status(200).json({ status: "success", report });
        }
      } catch (mlErr) {
        console.warn("ML service request failed, falling back to heuristic calculation:", mlErr.message);
      }

      // Fallback heuristic if ML service is temporarily down
      const fallbackStudents = enrolledStudents.map((s) => {
        const attended = Number(s.attended_sessions);
        const total = Math.max(1, totalSessions);
        const pct = roundToTwo((attended / total) * 100);
        const risk = pct < 65 ? "High Risk" : pct < 75 ? "Medium Risk" : "Low Risk";
        return {
          student_id: Number(s.student_id),
          student_name: s.student_name,
          attended_sessions: attended,
          total_sessions: total,
          attendance_percentage: pct,
          risk_level: risk,
          confidence: 85.0,
          recommendation: pct < 75
            ? `Student must attend next ${Math.max(1, Math.ceil(0.75 * total - attended))} class(es) to recover.`
            : "Attendance is healthy.",
        };
      });

      return res.status(200).json({
        status: "success",
        report: {
          course_id: course.id,
          course_name: course.course_name,
          total_sessions: totalSessions,
          total_evaluated: fallbackStudents.length,
          high_risk_count: fallbackStudents.filter((s) => s.risk_level === "High Risk").length,
          medium_risk_count: fallbackStudents.filter((s) => s.risk_level === "Medium Risk").length,
          low_risk_count: fallbackStudents.filter((s) => s.risk_level === "Low Risk").length,
          students: fallbackStudents,
        },
      });
    } catch (error) {
      console.error("Risk report generation failed:", error.message);
      return res.status(500).json({
        status: "error",
        message: "Unable to generate attendance risk report.",
      });
    }
  }
);

// Get student personal attendance risk for a course (students only - ML powered)
router.get(
  "/courses/:courseId/my-risk",
  verifyToken,
  allowRoles("student"),
  async (req, res) => {
    try {
      const courseId = Number(req.params.courseId);
      if (!Number.isSafeInteger(courseId) || courseId <= 0) {
        return res.status(400).json({
          status: "error",
          message: "Provide a valid course ID.",
        });
      }

      // Check enrollment
      const enrollment = await pool.query(
        "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2",
        [req.user.id, courseId]
      );

      if (enrollment.rowCount === 0) {
        return res.status(403).json({
          status: "error",
          message: "You are not enrolled in this course.",
        });
      }

      // Count total sessions and student's attended sessions
      const sessionsResult = await pool.query(
        "SELECT COUNT(*)::int AS total FROM attendance_sessions WHERE course_id = $1",
        [courseId]
      );
      const totalSessions = sessionsResult.rows[0].total;

      const attendedResult = await pool.query(
        `SELECT COUNT(ar.id)::int AS attended
         FROM attendance_records ar
         JOIN attendance_sessions s ON s.id = ar.session_id
         WHERE s.course_id = $1 AND ar.student_id = $2`,
        [courseId, req.user.id]
      );
      const attendedSessions = attendedResult.rows[0].attended;

      // Query ML Service
      try {
        const mlRes = await fetch(`${ML_SERVICE_URL}/predict-risk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attended_sessions: attendedSessions,
            total_sessions: Math.max(1, totalSessions),
            consecutive_absences: Math.max(0, totalSessions - attendedSessions),
          }),
        });

        if (mlRes.ok) {
          const riskData = await mlRes.json();
          return res.status(200).json({ status: "success", risk: riskData });
        }
      } catch (mlErr) {
        console.warn("ML service request failed, falling back to calculation:", mlErr.message);
      }

      const total = Math.max(1, totalSessions);
      const pct = roundToTwo((attendedSessions / total) * 100);
      const risk = pct < 65 ? "High Risk" : pct < 75 ? "Medium Risk" : "Low Risk";

      return res.status(200).json({
        status: "success",
        risk: {
          attendance_percentage: pct,
          total_sessions: total,
          attended_sessions: attendedSessions,
          risk_level: risk,
          confidence: 85.0,
          recommendation: pct < 75
            ? "Your attendance is below 75%. Please attend upcoming classes to avoid debarment."
            : "Your attendance is in good standing.",
        },
      });
    } catch (error) {
      console.error("Personal risk lookup failed:", error.message);
      return res.status(500).json({
        status: "error",
        message: "Unable to retrieve attendance risk.",
      });
    }
  }
);

function roundToTwo(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

module.exports = router;
