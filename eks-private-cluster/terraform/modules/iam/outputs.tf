output "lbc_role_arn" {
  description = "IAM role ARN for AWS Load Balancer Controller — use in helm install --set serviceAccount.annotations"
  value       = aws_iam_role.lbc.arn
}
output "eso_role_arn" {
  description = "IAM role ARN for External Secrets Operator — paste into secret-store values as serviceAccount.irsaRoleArn"
  value       = aws_iam_role.eso.arn
}

output "grafana_cloudwatch_role_arn" {
  description = "IAM role ARN for Grafana CloudWatch datasource — set as grafana.serviceAccount.annotations.eks.amazonaws.com/role-arn in values-prod.yaml"
  value       = aws_iam_role.grafana_cloudwatch.arn
}

output "thanos_s3_role_arn" {
  description = "IAM role ARN for Thanos sidecar S3 uploads — set as prometheus.prometheusSpec.podMetadata.annotations.eks.amazonaws.com/role-arn in values-prod.yaml"
  value       = aws_iam_role.thanos_s3.arn
}

output "github_actions_role_arn" {
  description = "IAM role ARN for GitHub Actions CI/CD — set as AWS_ROLE_TO_ASSUME in GitHub repository variables"
  value       = aws_iam_role.github_actions.arn
}