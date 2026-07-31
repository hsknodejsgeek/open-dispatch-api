output "public_ip" {
  description = "Elastic IP of the instance. Hit http://<public_ip>/web/* and /api/* once the app containers are deployed."
  value       = aws_eip.app.public_ip
}

output "ssh_command" {
  description = "SSH command to connect to the instance."
  value       = "ssh -i infra/${local.name_prefix}-key.pem ec2-user@${aws_eip.app.public_ip}"
}

output "private_key_path" {
  description = "Local path of the generated private key (gitignored). Use this for SSH and for the GitHub Actions deploy secret."
  value       = local_sensitive_file.private_key.filename
}
