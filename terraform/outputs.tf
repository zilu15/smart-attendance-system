output "artifact_registry_repo" {
  description = "Docker repository path for pushing container images"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.name}"
}

output "database_connection_name" {
  description = "Connection name for Cloud SQL instance"
  value       = google_sql_database_instance.postgres_instance.connection_name
}

output "database_ip" {
  description = "Public IP address of Cloud SQL PostgreSQL database"
  value       = google_sql_database_instance.postgres_instance.public_ip_address
}

output "ml_service_url" {
  description = "Public URL for the Python ML Risk Service"
  value       = google_cloud_run_v2_service.ml_service.uri
}

output "backend_api_url" {
  description = "Public URL for the Express Backend API"
  value       = google_cloud_run_v2_service.backend.uri
}

output "frontend_url" {
  description = "Public Web URL for the AttendEase React Application"
  value       = google_cloud_run_v2_service.frontend.uri
}
