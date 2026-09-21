locals {
  db_secret_arn = aws_db_instance.main.master_user_secret[0].secret_arn

  database_environment = {
    DB_HOST       = aws_db_instance.main.address
    DB_PORT       = tostring(aws_db_instance.main.port)
    DB_NAME       = aws_db_instance.main.db_name
    DB_SECRET_ARN = local.db_secret_arn
  }
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

data "archive_file" "ingest" {
  type        = "zip"
  source_dir  = "${path.module}/../app/dist/ingest"
  output_path = "${path.module}/.build/ingest.zip"
}

data "archive_file" "migrate" {
  type        = "zip"
  source_dir  = "${path.module}/../app/dist/migrate"
  output_path = "${path.module}/.build/migrate.zip"
}

resource "aws_cloudwatch_log_group" "ingest" {
  name              = "/aws/lambda/${var.project_name}-ingest"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "migrate" {
  name              = "/aws/lambda/${var.project_name}-migrate"
  retention_in_days = var.log_retention_days
}

resource "aws_iam_role" "ingest" {
  name               = "${var.project_name}-ingest"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "ingest_vpc" {
  role       = aws_iam_role.ingest.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

data "aws_iam_policy_document" "ingest" {
  statement {
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.raw.arn}/raw/*"]
  }

  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [local.db_secret_arn, aws_secretsmanager_secret.api_key.arn]
  }
}

resource "aws_iam_role_policy" "ingest" {
  name   = "access"
  role   = aws_iam_role.ingest.id
  policy = data.aws_iam_policy_document.ingest.json
}

resource "aws_iam_role" "migrate" {
  name               = "${var.project_name}-migrate"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "migrate_vpc" {
  role       = aws_iam_role.migrate.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

data "aws_iam_policy_document" "migrate" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [local.db_secret_arn]
  }
}

resource "aws_iam_role_policy" "migrate" {
  name   = "access"
  role   = aws_iam_role.migrate.id
  policy = data.aws_iam_policy_document.migrate.json
}

resource "aws_lambda_function" "ingest" {
  function_name = "${var.project_name}-ingest"
  role          = aws_iam_role.ingest.arn
  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  handler       = "index.handler"
  memory_size   = 256
  timeout       = 15

  filename         = data.archive_file.ingest.output_path
  source_code_hash = data.archive_file.ingest.output_base64sha256

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = merge(local.database_environment, {
      API_KEY_SECRET_ARN = aws_secretsmanager_secret.api_key.arn
      RAW_BUCKET         = aws_s3_bucket.raw.bucket
      NODE_OPTIONS       = "--enable-source-maps"
    })
  }

  depends_on = [
    aws_cloudwatch_log_group.ingest,
    aws_iam_role_policy_attachment.ingest_vpc,
    aws_iam_role_policy.ingest,
  ]

  lifecycle {
    ignore_changes = [source_code_hash]
  }
}

resource "aws_lambda_function" "migrate" {
  function_name = "${var.project_name}-migrate"
  role          = aws_iam_role.migrate.arn
  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  handler       = "index.handler"
  memory_size   = 256
  timeout       = 60

  filename         = data.archive_file.migrate.output_path
  source_code_hash = data.archive_file.migrate.output_base64sha256

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = merge(local.database_environment, {
      NODE_OPTIONS = "--enable-source-maps"
    })
  }

  depends_on = [
    aws_cloudwatch_log_group.migrate,
    aws_iam_role_policy_attachment.migrate_vpc,
    aws_iam_role_policy.migrate,
  ]

  lifecycle {
    ignore_changes = [source_code_hash]
  }
}
