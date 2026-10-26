# QR-Based Smart Attendance Tracking System

## Project Overview

The QR-Based Smart Attendance Tracking System is a cloud-hosted web application that allows teachers to create attendance sessions and students to mark their attendance by scanning a QR code.

The system uses a machine learning service to analyze attendance patterns and help identify students who may be at risk of low attendance.

## Objectives

- Allow teachers to create and manage attendance sessions.
- Allow students to log in and scan QR codes to mark attendance.
- Validate QR codes on the backend to reduce duplicate and fraudulent submissions.
- Store attendance records in a PostgreSQL database.
- Use machine learning to generate attendance-risk predictions.
- Containerize application components using Docker.
- Provision cloud infrastructure using Terraform.
- Automate testing and deployment using GitHub Actions.

## Technology Stack

- **Frontend:** React.js
- **Backend:** Node.js and Express.js
- **Database:** PostgreSQL
- **Machine Learning:** Python and FastAPI
- **Containerization:** Docker and Docker Compose
- **Cloud Platform:** Google Cloud
- **Infrastructure as Code:** Terraform
- **CI/CD:** GitHub Actions

## High-Level Architecture

The React frontend communicates with the Node.js backend API. The backend validates attendance requests and manages database operations. The Python ML service provides attendance-risk predictions through the backend.

The application will be containerized for local development and deployed to Google Cloud after the core features have been tested.

## Project Status

Currently in Phase 1: Project setup and requirements.

## Security Considerations

- Validate QR tokens on the server.
- Use short-lived attendance tokens.
- Require student authentication and enrollment validation.
- Prevent duplicate attendance using database constraints.
- Store credentials and secrets outside source code.
