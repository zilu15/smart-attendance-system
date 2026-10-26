terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.30"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# 1. Enable Required GCP APIs
resource "google_project_service" "enabled_apis" {
  for_each = toset([
    "run.googleapis.com",              # Google Cloud Run
    "sqladmin.googleapis.com",         # Google Cloud SQL
    "artifactregistry.googleapis.com", # Google Artifact Registry
    "cloudbuild.googleapis.com"        # Cloud Build
  ])

  service            = each.key
  disable_on_destroy = false
}

# 2. Google Artifact Registry (Docker Image Repository)
resource "google_artifact_registry_repository" "docker_repo" {
  depends_on    = [google_project_service.enabled_apis]
  location      = var.region
  repository_id = "attendease-repo"
  description   = "Docker container images for AttendEase microservices"
  format        = "DOCKER"
}

# 3. Google Cloud SQL (Managed PostgreSQL 16)
resource "google_sql_database_instance" "postgres_instance" {
  depends_on          = [google_project_service.enabled_apis]
  name                = "attendease-postgres-${var.environment}"
  database_version    = "POSTGRES_16"
  region              = var.region
  deletion_protection = false

  settings {
    tier              = "db-f1-micro"
    availability_type = "ZONAL"
    disk_size         = 10
    disk_type         = "PD_SSD"

    ip_configuration {
      ipv4_enabled = true
      authorized_networks {
        name  = "all"
        value = "0.0.0.0/0"
      }
    }
  }
}

resource "google_sql_database" "attendance_db" {
  name     = "attendance_db"
  instance = google_sql_database_instance.postgres_instance.name
}

resource "google_sql_user" "attendance_user" {
  name     = "attendance_user"
  instance = google_sql_database_instance.postgres_instance.name
  password = var.db_password
}

# 4. Google Cloud Run Service: Machine Learning Service
resource "google_cloud_run_v2_service" "ml_service" {
  depends_on = [google_project_service.enabled_apis, google_artifact_registry_repository.docker_repo]
  name       = "attendease-ml-service"
  location   = var.region
  ingress    = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.name}/ml-service:latest"
      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }
      ports {
        container_port = 8000
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "ml_public_access" {
  location = google_cloud_run_v2_service.ml_service.location
  name     = google_cloud_run_v2_service.ml_service.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# 5. Google Cloud Run Service: Express Backend
resource "google_cloud_run_v2_service" "backend" {
  depends_on = [
    google_project_service.enabled_apis,
    google_sql_database_instance.postgres_instance,
    google_cloud_run_v2_service.ml_service
  ]
  name     = "attendease-backend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.name}/backend:latest"
      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
      ports {
        container_port = 5000
      }
      env {
        name  = "PORT"
        value = "5000"
      }
      env {
        name  = "DB_HOST"
        value = google_sql_database_instance.postgres_instance.public_ip_address
      }
      env {
        name  = "DB_PORT"
        value = "5432"
      }
      env {
        name  = "DB_NAME"
        value = google_sql_database.attendance_db.name
      }
      env {
        name  = "DB_USER"
        value = google_sql_user.attendance_user.name
      }
      env {
        name  = "DB_PASSWORD"
        value = var.db_password
      }
      env {
        name  = "JWT_SECRET"
        value = var.jwt_secret
      }
      env {
        name  = "ML_SERVICE_URL"
        value = google_cloud_run_v2_service.ml_service.uri
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "backend_public_access" {
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# 6. Google Cloud Run Service: React Frontend
resource "google_cloud_run_v2_service" "frontend" {
  depends_on = [
    google_project_service.enabled_apis,
    google_cloud_run_v2_service.backend
  ]
  name     = "attendease-frontend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.name}/frontend:latest"
      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
      ports {
        container_port = 80
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public_access" {
  location = google_cloud_run_v2_service.frontend.location
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
