# AttendEase Terraform Infrastructure (GCP)

This directory contains Terraform scripts to automate the provisioning of cloud infrastructure for **AttendEase** on Google Cloud Platform (GCP).

## Architecture

The Terraform configuration provisions:
1. **Google Artifact Registry:** Secure private Docker repository for `frontend`, `backend`, and `ml-service` container images.
2. **Google Cloud SQL:** Managed PostgreSQL 16 database instance (`attendance_db`) with secure user authentication.
3. **Google Cloud Run:** Serverless container instances:
   - `attendease-ml-service` (Python/FastAPI)
   - `attendease-backend` (Node.js/Express)
   - `attendease-frontend` (React + Nginx)
4. **IAM Bindings:** Configures secure public invoker roles for web endpoints.

## Prerequisites

1. Install [Terraform](https://developer.hashicorp.com/terraform/downloads) (>= 1.5.0).
2. Install [Google Cloud SDK (gcloud CLI)](https://cloud.google.com/sdk/docs/install).
3. Authenticate with Google Cloud:
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```

## Deployment Steps

1. Copy the example variables file:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```
2. Edit `terraform.tfvars` with your GCP Project ID:
   ```hcl
   project_id = "your-actual-gcp-project-id"
   region     = "asia-south1"
   ```
3. Initialize Terraform:
   ```bash
   terraform init
   ```
4. Review the execution plan:
   ```bash
   terraform plan
   ```
5. Apply the infrastructure:
   ```bash
   terraform apply
   ```
6. When deployment finishes, Terraform will output the live URLs:
   - `frontend_url`
   - `backend_api_url`
   - `ml_service_url`
