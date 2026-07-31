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

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the single public subnet hosting the instance."
  type        = string
  default     = "10.0.0.0/24"
}

variable "ssh_allowed_cidr" {
  description = "CIDR allowed to SSH into the instance. Lock this down to your IP (e.g. \"1.2.3.4/32\"), not left at 0.0.0.0/0."
  type        = string
  default     = "0.0.0.0/0"
}

variable "instance_type" {
  description = "EC2 instance type."
  type        = string
  default     = "t3.medium"
}

variable "root_volume_size" {
  description = "Root EBS volume size in GB."
  type        = number
  default     = 30
}

variable "db_name" {
  description = "Postgres database name."
  type        = string
  default     = "opendispatch_db"
}

variable "db_username" {
  description = "Postgres username."
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "Postgres password. Override via TF_VAR_db_password or a tfvars file; never commit a real value."
  type        = string
  default     = "changeme-in-tfvars"
  sensitive   = true
}

variable "db_port" {
  description = "Host port Postgres is published on (container's 5432 mapped to this)."
  type        = number
  default     = 5432
}

variable "web_port" {
  description = "Port the web/frontend app listens on (nginx proxies /web/* here)."
  type        = number
  default     = 3000
}

variable "api_port" {
  description = "Port the API/server app listens on (nginx proxies /api/* here)."
  type        = number
  default     = 3001
}
