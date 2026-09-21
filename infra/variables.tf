variable "aws_region" {
  description = "AWS region where everything is deployed."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Prefix used to name every resource."
  type        = string
  default     = "ingest-pipeline"
}

variable "vpc_cidr" {
  description = "CIDR block of the VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "raw_retention_days" {
  description = "Days before raw payloads are expired from S3."
  type        = number
  default     = 90
}

variable "log_retention_days" {
  description = "Days CloudWatch keeps Lambda and API logs."
  type        = number
  default     = 14
}

variable "github_repository" {
  description = "GitHub repository allowed to deploy, in the form owner/name."
  type        = string
}

variable "create_github_oidc_provider" {
  description = "Set to false if the account already has the GitHub OIDC provider."
  type        = bool
  default     = true
}
