variable "project_id" {
  description = "The Google Cloud Platform (GCP) Project ID"
  type        = string
  default     = "attendease-cloud-project"
}

variable "region" {
  description = "GCP region where cloud resources will be deployed"
  type        = string
  default     = "asia-south1"
}

variable "environment" {
  description = "Deployment environment (e.g. dev, staging, prod)"
  type        = string
  default     = "production"
}

variable "db_password" {
  description = "Password for the Cloud SQL PostgreSQL user"
  type        = string
  sensitive   = true
  default     = "AttendEase_Postgres_2026_Secure"
}

variable "jwt_secret" {
  description = "Secret key for signing and verifying JWT tokens"
  type        = string
  sensitive   = true
  default     = "attendease_jwt_production_secret_key_2026"
}
