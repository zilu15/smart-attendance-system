-- QR-Based Smart Attendance Tracking System
-- PostgreSQL database schema
-- Tables will be added in the following steps.


CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('teacher', 'student')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_name VARCHAR(150) NOT NULL,
    course_code VARCHAR(30) NOT NULL UNIQUE,
    teacher_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enrollments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id),
    course_id BIGINT NOT NULL REFERENCES courses(id),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_student_course
        UNIQUE (student_id, course_id)
);

CREATE TABLE IF NOT EXISTS attendance_sessions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES courses(id),
    teacher_id BIGINT NOT NULL REFERENCES users(id),
    session_name VARCHAR(150) NOT NULL,
    qr_token_hash TEXT NOT NULL UNIQUE,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_session_expiry
        CHECK (expires_at > starts_at)
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES attendance_sessions(id),
    student_id BIGINT NOT NULL REFERENCES users(id),
    marked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'present'
        CHECK (status IN ('present')),
    
    CONSTRAINT unique_student_attendance
        UNIQUE (session_id, student_id)
);

-- Improve attendance lookup performance
CREATE INDEX IF NOT EXISTS idx_attendance_records_student
    ON attendance_records(student_id);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_course
    ON attendance_sessions(course_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_course
    ON enrollments(course_id);
