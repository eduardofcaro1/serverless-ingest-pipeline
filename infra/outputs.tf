output "api_url" {
  description = "Base URL of the HTTP API."
  value       = aws_apigatewayv2_api.http.api_endpoint
}

output "api_key_secret_arn" {
  description = "Secret that holds the API key expected in the x-api-key header."
  value       = aws_secretsmanager_secret.api_key.arn
}

output "raw_bucket" {
  description = "Bucket that stores the raw payloads."
  value       = aws_s3_bucket.raw.bucket
}

output "ingest_function_name" {
  value = aws_lambda_function.ingest.function_name
}

output "migrate_function_name" {
  value = aws_lambda_function.migrate.function_name
}

output "github_deploy_role_arn" {
  description = "Role assumed by GitHub Actions through OIDC."
  value       = aws_iam_role.github_deploy.arn
}
