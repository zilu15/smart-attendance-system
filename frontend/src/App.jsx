import { useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import "./App.css";
import Auth from "./Auth";

function App() {
  const [role, setRole] = useState("student");
  const [apiStatus, setApiStatus] = useState("Checking backend...");
  const [databaseStatus, setDatabaseStatus] = useState("Checking...");
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authTestMessage, setAuthTestMessage] = useState("");
  const [attendanceSession, setAttendanceSession] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [qrTokenInput, setQrTokenInput] = useState("");
  const [attendanceMessage, setAttendanceMessage] = useState(null);
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);
  const [mlReport, setMlReport] = useState(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [studentRisk, setStudentRisk] = useState(null);
  const [isLoadingStudentRisk, setIsLoadingStudentRisk] = useState(false);

  useEffect(() => {
    fetch("http://localhost:5000/api/health")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Backend request failed");
        }
        return response.json();
      })
      .then((data) => {
        setApiStatus(data.message);
        setDatabaseStatus(data.database);
      })
      .catch(() => {
        setApiStatus("Backend unavailable");
        setDatabaseStatus("unknown");
      });
  }, []);

  const fetchCourses = useCallback(async (authToken) => {
    const activeToken = authToken || token;
    if (!activeToken) return;

    try {
      const response = await fetch("http://localhost:5000/api/courses", {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCourses(data.courses || []);
        if (data.courses && data.courses.length > 0) {
          setSelectedCourseId((prev) => prev || String(data.courses[0].id));
        }
      }
    } catch (err) {
      console.error("Failed to fetch courses:", err);
    }
  }, [token]);

  function handleLogin(data) {
    setCurrentUser(data.user);
    setToken(data.token);
    setRole(data.user.role);
    setAuthTestMessage("");
    setAttendanceSession(null);
    setAttendanceMessage(null);
    setQrTokenInput("");
    setMlReport(null);
    setStudentRisk(null);
    fetchCourses(data.token);
  }

  function handleLogout() {
    setCurrentUser(null);
    setToken(null);
    setAuthTestMessage("");
    setAttendanceSession(null);
    setAttendanceMessage(null);
    setQrTokenInput("");
    setCourses([]);
    setSelectedCourseId("");
    setMlReport(null);
    setStudentRisk(null);
  }

  async function testTeacherAccess() {
    setAuthTestMessage("Checking access...");

    try {
      const response = await fetch(
        "http://localhost:5000/api/test/teacher",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      setAuthTestMessage(
        response.ok
          ? data.message
          : `${response.status}: ${data.message}`
      );
    } catch {
      setAuthTestMessage("Could not connect to the backend.");
    }
  }

  async function handleCreateCourse() {
    const courseName = prompt("Enter course name:", "Cloud Computing");
    if (!courseName) return;

    const courseCode = prompt(
      "Enter course code (e.g. CS301):",
      `CC${Math.floor(100 + Math.random() * 900)}`
    );
    if (!courseCode) return;

    try {
      const response = await fetch(
        "http://localhost:5000/api/courses",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            course_name: courseName,
            course_code: courseCode,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert(`Success: ${data.message}\nCourse ID: ${data.course.id}`);
        fetchCourses(token);
        setSelectedCourseId(String(data.course.id));
      } else {
        alert(`Error ${response.status}: ${data.message}`);
      }
    } catch {
      alert("Could not connect to the backend.");
    }
  }

  async function handleCreateAttendanceSession() {
    const courseIdToUse = Number(selectedCourseId);

    if (!courseIdToUse) {
      alert("Please create or select a course first.");
      return;
    }

    const currentCourse = courses.find((c) => Number(c.id) === courseIdToUse);
    const sessionName = prompt(
      "Enter session name:",
      `${currentCourse ? currentCourse.course_name : "Class"} Lecture ${new Date().toLocaleDateString()}`
    );
    if (!sessionName) return;

    const duration = Number(prompt("Enter duration in minutes (1-240):", "30")) || 30;

    try {
      const response = await fetch(
        "http://localhost:5000/api/attendance/sessions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            course_id: courseIdToUse,
            session_name: sessionName,
            duration_minutes: duration,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setAttendanceSession({
          ...data.session,
          course_name: currentCourse ? currentCourse.course_name : "",
          course_code: currentCourse ? currentCourse.course_code : "",
          qr_token: data.qr_token,
        });

        alert(
          `Success: ${data.message}\n` +
            `Session ID: ${data.session.id}\n` +
            `Expires: ${data.session.expires_at}`
        );
      } else {
        alert(`Error ${response.status}: ${data.message}`);
      }
    } catch {
      alert("Could not connect to the backend.");
    }
  }

  async function handleEnroll(courseId) {
    try {
      const response = await fetch(
        `http://localhost:5000/api/courses/${courseId}/enroll`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        fetchCourses(token);
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch {
      alert("Could not connect to the backend.");
    }
  }

  async function handleMarkAttendance(e) {
    if (e) e.preventDefault();
    const tokenClean = qrTokenInput.trim();
    if (!tokenClean) {
      setAttendanceMessage({ type: "error", text: "Please enter a QR token." });
      return;
    }

    setIsSubmittingAttendance(true);
    setAttendanceMessage(null);

    try {
      const response = await fetch("http://localhost:5000/api/attendance/mark", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ qr_token: tokenClean }),
      });

      const data = await response.json();

      if (response.ok) {
        setAttendanceMessage({
          type: "success",
          text: `Attendance marked successfully for ${data.session_name || "class"}!`,
        });
        setQrTokenInput("");
      } else {
        setAttendanceMessage({
          type: "error",
          text: `Error ${response.status}: ${data.message}`,
        });
      }
    } catch {
      setAttendanceMessage({
        type: "error",
        text: "Could not connect to the backend server.",
      });
    } finally {
      setIsSubmittingAttendance(false);
    }
  }

  async function fetchMlRiskReport() {
    const courseIdToUse = Number(selectedCourseId);
    if (!courseIdToUse) {
      alert("Please select a course first.");
      return;
    }

    setIsLoadingReport(true);
    try {
      const response = await fetch(
        `http://localhost:5000/api/attendance/courses/${courseIdToUse}/risk-report`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMlReport(data.report);
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch {
      alert("Could not connect to the backend server.");
    } finally {
      setIsLoadingReport(false);
    }
  }

  async function fetchStudentRisk(courseId) {
    setIsLoadingStudentRisk(true);
    try {
      const response = await fetch(
        `http://localhost:5000/api/attendance/courses/${courseId}/my-risk`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setStudentRisk(data.risk);
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch {
      alert("Could not connect to the backend server.");
    } finally {
      setIsLoadingStudentRisk(false);
    }
  }

  if (!currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">QR</div>
          <div>
            <h2>AttendEase</h2>
            <p>Smart Attendance System</p>
          </div>
        </div>

        <div className="user-section">
          <div>
            <span>{apiStatus}</span>
            <br />
            <small>Database: {databaseStatus}</small>
            <br />
            <small>
              Signed in as{" "}
              {currentUser.fullName ||
                currentUser.full_name ||
                currentUser.email}
              {" "}({currentUser.role})
            </small>
          </div>

          {currentUser.role === "teacher" && (
            <>
              <button onClick={testTeacherAccess}>
                Test Teacher Access
              </button>

              <button onClick={handleCreateCourse}>
                + Create Course
              </button>

              <button onClick={handleCreateAttendanceSession}>
                Create Attendance Session
              </button>

              {authTestMessage && <p>{authTestMessage}</p>}
            </>
          )}

          <button
            className="primary-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard">
        <section className="welcome">
          <div>
            <p className="eyebrow">SMART ATTENDANCE PLATFORM</p>
            <h1>Welcome to AttendEase</h1>
            <p className="welcome-text">
              A simpler way to manage classes and track attendance
              using secure QR codes.
            </p>
          </div>

          <div className="welcome-icon" aria-hidden="true">
            QR
          </div>
        </section>

        <section className="role-section">
          <h2>Your dashboard</h2>
          <p>
            Welcome,{" "}
            {currentUser.fullName ||
              currentUser.full_name ||
              currentUser.email}
            .
          </p>

          <div className="role-switch">
            <button
              className={role === "student" ? "active" : ""}
              onClick={() => setRole("student")}
              disabled={currentUser.role !== "student"}
            >
              Student
            </button>

            <button
              className={role === "teacher" ? "active" : ""}
              onClick={() => setRole("teacher")}
              disabled={currentUser.role !== "teacher"}
            >
              Teacher
            </button>
          </div>
        </section>

        {role === "student" ? (
          <>
            <section className="feature-grid">
              <article className="feature-card">
                <div className="feature-icon purple">QR</div>
                <h3>Mark Attendance</h3>
                <p>
                  Enter or paste the attendance QR token displayed by your teacher to record your attendance.
                </p>

                <form onSubmit={handleMarkAttendance} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <input
                    type="text"
                    value={qrTokenInput}
                    onChange={(e) => setQrTokenInput(e.target.value)}
                    placeholder="Enter 64-character QR token..."
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #dedfec",
                      fontFamily: "monospace",
                      fontSize: "13px",
                    }}
                  />

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={isSubmittingAttendance}
                  >
                    {isSubmittingAttendance ? "Verifying Token..." : "Submit Attendance"}
                  </button>
                </form>

                {attendanceMessage && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "10px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "500",
                      background: attendanceMessage.type === "success" ? "#ecfdf5" : "#fef2f2",
                      color: attendanceMessage.type === "success" ? "#065f46" : "#b91c1c",
                      border: `1px solid ${attendanceMessage.type === "success" ? "#a7f3d0" : "#fecaca"}`,
                    }}
                  >
                    {attendanceMessage.text}
                  </div>
                )}
              </article>

              <article className="feature-card">
                <div className="feature-icon green">🧠</div>
                <h3>AI Attendance Health</h3>
                <p>
                  View your personal attendance score and AI risk predictions powered by the machine learning model.
                </p>

                {courses.filter((c) => c.is_enrolled).length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#77798e" }}>
                    Enroll in a course below to check your attendance health.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {courses.filter((c) => c.is_enrolled).map((course) => (
                      <button
                        key={course.id}
                        className="primary-button"
                        style={{ fontSize: "13px", padding: "8px 14px", background: "#10b981" }}
                        disabled={isLoadingStudentRisk}
                        onClick={() => fetchStudentRisk(course.id)}
                      >
                        {isLoadingStudentRisk ? "Analyzing..." : `Check Risk for ${course.course_code}`}
                      </button>
                    ))}
                  </div>
                )}

                {studentRisk && (
                  <div
                    style={{
                      marginTop: "14px",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: "600" }}>
                        Attendance: {studentRisk.attendance_percentage}% ({studentRisk.attended_sessions}/{studentRisk.total_sessions})
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: "700",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          color: studentRisk.risk_level === "High Risk" ? "#b91c1c" : studentRisk.risk_level === "Medium Risk" ? "#b45309" : "#15803d",
                          background: studentRisk.risk_level === "High Risk" ? "#fef2f2" : studentRisk.risk_level === "Medium Risk" ? "#fffbeb" : "#f0fdf4",
                        }}
                      >
                        {studentRisk.risk_level}
                      </span>
                    </div>
                    <p style={{ fontSize: "12px", color: "#475569", marginTop: "8px", lineHeight: "1.5" }}>
                      💡 <strong>AI Recommendation:</strong> {studentRisk.recommendation}
                    </p>
                  </div>
                )}
              </article>
            </section>

            <section className="feature-card" style={{ marginTop: "24px" }}>
              <h3>Available Courses</h3>
              <p>Enroll in courses below to mark attendance when your teacher starts a session:</p>
              {courses.length === 0 ? (
                <p style={{ color: "#77798e" }}>No courses available yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {courses.map((course) => (
                    <div
                      key={course.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        background: "#f8f9fe",
                        borderRadius: "10px",
                        border: "1px solid #e5e7f0",
                      }}
                    >
                      <div>
                        <strong>{course.course_name}</strong> ({course.course_code})
                        <div style={{ fontSize: "13px", color: "#666" }}>
                          Instructor: {course.teacher_name || "Teacher"}
                        </div>
                      </div>
                      {course.is_enrolled ? (
                        <span style={{ color: "#16a34a", fontWeight: "600", fontSize: "14px" }}>
                          ✓ Enrolled
                        </span>
                      ) : (
                        <button
                          className="primary-button"
                          style={{ padding: "8px 16px", fontSize: "13px" }}
                          onClick={() => handleEnroll(course.id)}
                        >
                          Enroll
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <section className="feature-grid">
              <article className="feature-card">
                <div className="feature-icon purple">+</div>
                <h3>Create Class Session</h3>
                <p>
                  Create an attendance session with a time-limited
                  QR code for your class.
                </p>

                {courses.length > 0 && (
                  <div style={{ marginBottom: "14px" }}>
                    <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                      Select Course:
                    </label>
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #dedfec",
                      }}
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.course_name} ({c.course_code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  className="primary-button"
                  onClick={handleCreateAttendanceSession}
                >
                  Create session and QR code
                </button>
              </article>

              <article className="feature-card">
                <div className="feature-icon green">📊</div>
                <h3>ML Attendance Risk Reports</h3>
                <p>
                  Review AI-powered attendance risk analysis and identify students at risk of debarment.
                </p>

                <button
                  className="primary-button"
                  style={{ background: "#059669" }}
                  disabled={isLoadingReport || !selectedCourseId}
                  onClick={fetchMlRiskReport}
                >
                  {isLoadingReport ? "Generating Report..." : "Generate AI Risk Report"}
                </button>

                {courses.length > 0 && (
                  <div style={{ marginTop: "16px", borderTop: "1px solid #eee", paddingTop: "12px" }}>
                    <small style={{ color: "#666", fontWeight: "600" }}>Your Active Courses:</small>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
                      {courses.slice(0, 2).map((c) => (
                        <div key={c.id} style={{ fontSize: "12px", color: "#444" }}>
                          • <strong>{c.course_name}</strong> ({c.course_code}) — {c.enrolled_students_count || 0} student(s)
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            </section>

            {mlReport && (
              <section className="feature-card" style={{ marginTop: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>📊 ML Attendance Risk Analysis: {mlReport.course_name}</h3>
                    <small style={{ color: "#666" }}>Total sessions: {mlReport.total_sessions} · Enrolled students: {mlReport.total_evaluated}</small>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span style={{ fontSize: "12px", padding: "4px 8px", borderRadius: "6px", background: "#fef2f2", color: "#b91c1c", fontWeight: "700" }}>
                      🔴 High Risk: {mlReport.high_risk_count}
                    </span>
                    <span style={{ fontSize: "12px", padding: "4px 8px", borderRadius: "6px", background: "#fffbeb", color: "#b45309", fontWeight: "700" }}>
                      🟡 Medium: {mlReport.medium_risk_count}
                    </span>
                    <span style={{ fontSize: "12px", padding: "4px 8px", borderRadius: "6px", background: "#f0fdf4", color: "#15803d", fontWeight: "700" }}>
                      🟢 Low: {mlReport.low_risk_count}
                    </span>
                  </div>
                </div>

                {mlReport.students.length === 0 ? (
                  <p style={{ color: "#77798e" }}>No students enrolled in this course yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {mlReport.students.map((s, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 14px",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          background: s.risk_level === "High Risk" ? "#fff5f5" : s.risk_level === "Medium Risk" ? "#fffdf5" : "#f8fafc",
                        }}
                      >
                        <div>
                          <strong>{s.student_name || `Student #${s.student_id}`}</strong>
                          <div style={{ fontSize: "12px", color: "#64748b" }}>
                            Attendance: {s.attended_sessions}/{s.total_sessions} ({s.attendance_percentage}%)
                          </div>
                          <div style={{ fontSize: "11px", color: "#334155", marginTop: "3px" }}>
                            💡 {s.recommendation}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: "700",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              color: s.risk_level === "High Risk" ? "#b91c1c" : s.risk_level === "Medium Risk" ? "#b45309" : "#15803d",
                              background: s.risk_level === "High Risk" ? "#fef2f2" : s.risk_level === "Medium Risk" ? "#fffbeb" : "#f0fdf4",
                            }}
                          >
                            {s.risk_level} ({s.confidence}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {attendanceSession && (
              <section className="feature-card attendance-qr">
                <h2>Attendance QR Code</h2>
                <p>
                  Course: {attendanceSession.course_name || "Cloud Computing"} ({attendanceSession.course_code || "CC101"})
                </p>
                <p>
                  Session: {attendanceSession.session_name}
                </p>
                <p>
                  Session ID: {attendanceSession.id}
                </p>

                <div className="qr-code-container">
                  <QRCodeSVG
                    value={attendanceSession.qr_token}
                    size={240}
                    level="H"
                    includeMargin
                  />
                </div>

                <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <button
                    className="primary-button"
                    style={{ fontSize: "13px", padding: "8px 16px" }}
                    onClick={() => {
                      navigator.clipboard.writeText(attendanceSession.qr_token);
                      alert("QR token copied to clipboard! Students can paste this into their dashboard.");
                    }}
                  >
                    📋 Copy QR Token
                  </button>
                  <code style={{ fontSize: "11px", color: "#666", wordBreak: "break-all", background: "#f1f2f8", padding: "4px 8px", borderRadius: "6px" }}>
                    {attendanceSession.qr_token}
                  </code>
                </div>

                <p style={{ marginTop: "12px" }}>
                  Expires:{" "}
                  {new Date(
                    attendanceSession.expires_at
                  ).toLocaleString()}
                </p>

                <p>
                  Ask students to scan this code while the session
                  is active.
                </p>
              </section>
            )}
          </>
        )}

        <footer>
          AttendEase · Smart Attendance Tracking System
        </footer>
      </main>
    </div>
  );
}

export default App;
