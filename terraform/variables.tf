
variable "project_id" {
  description = "The Google Cloud project ID"
  type        = string
}

variable "region" {
  description = "GCP region where cloud resources will be deployed"
  type        = string
  default     = "asia-south1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "db_password" {
  description = "Password for the Cloud SQL PostgreSQL user"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Secret key for signing and verifying JWT tokens"
  type        = string
  sensitive   = true
}
