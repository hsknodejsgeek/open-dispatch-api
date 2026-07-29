variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (staging or production)."
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be either \"staging\" or \"production\"."
  }
}

variable "db_name" {
  description = "Name of the application Postgres database."
  type        = string
  default     = "opendispatch_db"
}

variable "container_port" {
  description = "Port the Fastify container listens on and the ALB forwards traffic to."
  type        = number
  default     = 3000
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for the 2 public subnets (ALB)."
  type        = list(string)
  default     = ["10.0.0.0/24", "10.0.1.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for the 2 private subnets (ECS + RDS)."
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "db_instance_class" {
  description = "RDS instance class for the Postgres database."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_username" {
  description = "Master username for the RDS Postgres instance."
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "Master password for the RDS Postgres instance. Override via TF_VAR_db_password or a tfvars file; never commit a real value."
  type        = string
  default     = "changeme-in-tfvars"
  sensitive   = true
}

variable "container_image" {
  description = "Container image (repository:tag) for the Fastify app task."
  type        = string
  default     = "public.ecr.aws/docker/library/node:20-alpine"
}

variable "task_cpu" {
  description = "Fargate task CPU units."
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "Fargate task memory (MiB)."
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired number of running ECS tasks."
  type        = number
  default     = 1
}

variable "jwt_secret" {
  description = "Secret used to sign JWTs. Override via TF_VAR_jwt_secret or a tfvars file; never commit a real value."
  type        = string
  default     = "changeme-in-tfvars"
  sensitive   = true
}
