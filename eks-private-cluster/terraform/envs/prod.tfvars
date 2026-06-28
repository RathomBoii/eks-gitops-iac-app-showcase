# ── Prod Environment ──────────────────────────────────────────────────────────
env    = "prod"
region = "ap-southeast-7"

# Cluster
cluster_name       = "eks-prod"
kubernetes_version = "1.35"

# Network — 3 AZs for high availability in production
vpc_cidr              = "10.5.0.0/16"
is_single_nat_gateway = true # false mean HA for prod: we will got one NAT gateway per AZ
private_subnets       = ["10.5.1.0/24", "10.5.2.0/24"]
public_subnets        = ["10.5.101.0/24", "10.5.102.0/24"]

# Node group — larger for prod
node_instance_type = "t3.medium"
desired_nodes      = 3
min_nodes          = 2
max_nodes          = 4

# EKS Admin Access — add IAM user/role ARNs that need kubectl access
admin_principal_arns = [
  "arn:aws:iam::687069305167:user/Jessada.S",
]

# ECR
ecr_repo_name            = "app"
ecr_image_tag_mutability = "IMMUTABLE"

# Terraform state bucket — required for bastion to run terraform apply
tfstate_bucket = "eks-app-jessada-demo"

# App
# app_image_tag  = "1.0.0"
# app_replicas   = 3
# argocd_version        = "6.7.0"
# # app_api_key_value — do NOT set here. Pass via env var:
# #   export TF_VAR_app_api_key_value="your-secret-value"

# ESO (External Secrets Operator)
eso_namespace            = "external-secrets"
eso_service_account_name = "eks-secret-store-irsa"

# RDS PostgreSQL — smallest instance, Multi-AZ for prod reliability
rds_db_identifier           = "postgres-prod"
rds_db_name                 = "appdb"
rds_db_username             = "pgadmin"
rds_instance_class          = "db.t3.micro"
rds_multi_az                = false # true mean we will got HA Standby replica for failover in prod
rds_backup_retention_period = 7
rds_skip_final_snapshot     = true  # (prod default: false — skipping for destroy)
rds_deletion_protection     = false # (prod default: true — disabled for destroy)

# GitHub Actions CI/CD
github_org                  = "RathomBoii"
github_repo                 = "technical-refresh"
create_github_oidc_provider = false # false on prod — OIDC provider already created by dev env
