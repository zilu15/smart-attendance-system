
import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [role, setRole] = useState("student");
  
const [apiStatus, setApiStatus] = useState("Checking backend...");
const [databaseStatus, setDatabaseStatus] = useState("Checking...");

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
          </div>
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
          <h2>Choose your dashboard</h2>
          <p>Select a role to preview the available features.</p>

          <div className="role-switch">
            <button
              className={role === "student" ? "active" : ""}
              onClick={() => setRole("student")}
            >
              Student
            </button>

            <button
              className={role === "teacher" ? "active" : ""}
              onClick={() => setRole("teacher")}
            >
              Teacher
            </button>
          </div>
        </section>

        {role === "student" ? (
          <section className="feature-grid">
            <article className="feature-card">
              <div className="feature-icon purple">▦</div>
              <h3>Scan QR Code</h3>
              <p>
                Scan your teacher's active QR code to mark your
                attendance for a class.
              </p>
              <button
                className="primary-button"
                onClick={() =>
                  alert("QR scanning will be added in a later step.")
                }
              >
                Scan attendance QR
              </button>
            </article>

            <article className="feature-card">
              <div className="feature-icon green">✓</div>
              <h3>My Attendance</h3>
              <p>
                View your attendance records and monitor your
                attendance percentage.
              </p>
              <span className="coming-soon">Coming soon</span>
            </article>
          </section>
        ) : (
          <section className="feature-grid">
            <article className="feature-card">
              <div className="feature-icon purple">＋</div>
              <h3>Create Class Session</h3>
              <p>
                Select a course and create an attendance session
                with a time-limited QR code.
              </p>
              <button
                className="primary-button"
                onClick={() =>
                  alert("Class session creation will be added later.")
                }
              >
                Create session
              </button>
            </article>

            <article className="feature-card">
              <div className="feature-icon green">▤</div>
              <h3>Attendance Reports</h3>
              <p>
                Review class attendance records and track student
                participation.
              </p>
              <span className="coming-soon">Coming soon</span>
            </article>
          </section>
        )}

        <footer>
          AttendEase · Smart Attendance Tracking System
        </footer>
      </main>
    </div>
  );
}

export default App;
