# ── Dev Environment ───────────────────────────────────────────────────────────
env    = "dev"
region = "ap-southeast-7"

# Cluster
cluster_name       = "eks-dev"
kubernetes_version = "1.31"

# Network
vpc_cidr              = "10.4.0.0/16"
is_single_nat_gateway = true # Cost-saving for dev; set false in prod for HA
private_subnets       = ["10.4.1.0/24", "10.4.2.0/24"]
public_subnets        = ["10.4.0.0/24", "10.4.3.0/24"]

# Node group — small for dev
node_instance_type = "t3.large"
desired_nodes      = 2
min_nodes          = 1
max_nodes          = 3

# EKS Admin Access — add IAM user/role ARNs that need kubectl access
admin_principal_arns = [
  "arn:aws:iam::687069305167:user/Jessada.S",
]

# ECR
ecr_repo_name            = "app"
ecr_image_tag_mutability = "MUTABLE"

# Terraform state bucket — required for bastion to run terraform apply
tfstate_bucket = "eks-app-jessada-demo"

# App
app_image_tag  = "latest"
app_replicas   = 1
argocd_version = "6.7.0"
# app_api_key_value — do NOT set here. Pass via env var:
#   export TF_VAR_app_api_key_value="your-secret-value"

# ESO (External Secrets Operator)
eso_namespace            = "external-secrets"
eso_service_account_name = "eks-secret-store-irsa"

# RDS PostgreSQL — smallest instance, no HA for dev
rds_db_identifier           = "postgres-dev"
rds_db_name                 = "appdb"
rds_db_username             = "pgadmin"
rds_instance_class          = "db.t3.micro"
rds_multi_az                = false
rds_backup_retention_period = 1    # 1 day is enough for dev
rds_skip_final_snapshot     = true # Allow destroy without snapshot in dev
rds_deletion_protection     = false

# GitHub Actions CI/CD
github_org                  = "RathomBoii"
github_repo                 = "eks-gitops-iac-app-showcase"
create_github_oidc_provider = true # true on dev (first env) — account-scoped, only create once
