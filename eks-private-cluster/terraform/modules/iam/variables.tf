variable "env" {
  description = "Environment name (dev or prod)"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
}

variable "oidc_provider_arn" {
  description = "OIDC provider ARN from the EKS cluster — used for IRSA trust policy"
  type        = string
}

variable "oidc_provider" {
  description = "OIDC provider URL (without https://) — used in IAM condition keys"
  type        = string
}

variable "eso_namespace" {
  description = "Kubernetes namespace where External Secrets Operator is deployed (must match ArgoCD destination namespace)"
  type        = string
  default     = "external-secrets"
}

variable "eso_service_account_name" {
  description = "ServiceAccount name used by ESO — must match secret-store chart values.serviceAccount.name"
  type        = string
  default     = "eks-secret-store-irsa"
}

variable "grafana_namespace" {
  description = "Kubernetes namespace where Grafana (kube-prometheus-stack) is deployed"
  type        = string
  default     = "monitoring"
}

variable "grafana_service_account_name" {
  description = "Grafana ServiceAccount name — must match the SA created by the chart and the eks.amazonaws.com/role-arn annotation in values-prod.yaml (default <release>-grafana)"
  type        = string
  default     = "prometheus-grafana"
}

variable "prometheus_namespace" {
  description = "Kubernetes namespace where Prometheus (kube-prometheus-stack) is deployed"
  type        = string
  default     = "monitoring"
}

variable "prometheus_service_account_name" {
  description = "Prometheus ServiceAccount name — must match the SA created by the chart (default <release>-prometheus)"
  type        = string
  default     = "kube-prometheus-stack-prometheus"
}

variable "thanos_s3_bucket" {
  description = "S3 bucket name for Thanos long-term metric storage"
  type        = string
  default     = "jessada-prometheus-thanos-metric-storage"
}

variable "github_org" {
  description = "GitHub organisation or user name that owns the repo (e.g. RathomBoii)"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name (e.g. eks-gitops-iac-app-showcase)"
  type        = string
}

variable "ecr_repo_name" {
  description = "ECR repository base name — used to scope the push policy to <env>-<repo_name>"
  type        = string
  default     = "app"
}

variable "create_github_oidc_provider" {
  description = "Set true only on the first env (dev). The GitHub OIDC provider is account-scoped — creating it twice causes an error."
  type        = bool
  default     = false
}


