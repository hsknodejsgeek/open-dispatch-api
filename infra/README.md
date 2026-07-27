# infra

OpenTofu IaC for LogiPulse. Populated in Phase 8 (`docs/implementation-plan.md`):

- `variables.tf` — aws_region, environment, db_name, container_port
- `main.tf` — VPC (2 public + 2 private subnets), RDS Postgres, ECS Fargate cluster/task, ALB
- `outputs.tf` — alb_dns_name, rds_endpoint
