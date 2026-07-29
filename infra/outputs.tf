output "alb_dns_name" {
  description = "Public DNS name of the Application Load Balancer."
  value       = aws_lb.app.dns_name
}

output "rds_endpoint" {
  description = "Connection endpoint (host:port) of the RDS Postgres instance."
  value       = aws_db_instance.main.endpoint
}
