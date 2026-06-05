# ── helloworld IRSA role ───────────────────────────────────────────────────────
# Allows the helloworld pod's Kubernetes ServiceAccount to call AWS Secrets Manager.
# The pod's ServiceAccount must be annotated with this role ARN.

# The role's trust policy allows sts:AssumeRoleWithWebIdentity from the OIDC provider ARN for the EKS cluster,
# but only if the token's "sub" claim matches the expected ServiceAccount and namespace, and the "aud" claim is sts.amazonaws.com.
resource "aws_iam_role" "helloworld" {
  name = "${var.env}-helloworld"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = var.oidc_provider_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          # Must match exactly: namespace and ServiceAccount name in the helm chart
          "${var.oidc_provider}:sub" = "system:serviceaccount:${var.helloworld_namespace}:helloworld"
          "${var.oidc_provider}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })

  tags = {
    Name = "${var.env}-helloworld"
    Env  = var.env
  }
}


# The policy of line 7 role allows read-only access to Secrets Manager secrets under /<env>/helloworld/*.
resource "aws_iam_role_policy" "helloworld_secrets" {
  name = "${var.env}-helloworld-secrets"
  role = aws_iam_role.helloworld.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ]
      # Scoped to only secrets under /<env>/helloworld/
      # Wildcard suffix (-??????) matches the 6-char random suffix AWS appends to secret ARNs
      Resource = "arn:aws:secretsmanager:${var.region}:*:secret:/${var.env}/helloworld/*"
    }]
  })
}

# ── External Secrets Operator IRSA role ─────────────────────────────────────
# Allows the ESO ServiceAccount (eks-secret-store-irsa in the external-secrets
# namespace) to call Secrets Manager on behalf of ExternalSecret resources.
# The ServiceAccount name and namespace must match what the secret-store Helm
# chart deploys (values.serviceAccount.name and ArgoCD destination namespace).
resource "aws_iam_role" "eso" {
  name = "${var.env}-eks-secret-store-irsa"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = var.oidc_provider_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${var.oidc_provider}:sub" = "system:serviceaccount:${var.eso_namespace}:${var.eso_service_account_name}"
          "${var.oidc_provider}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })

  tags = {
    Name = "${var.env}-eks-secret-store-irsa"
    Env  = var.env
  }
}

# Scoped to all secrets under <env>/* — covers current and future app secrets
resource "aws_iam_role_policy" "eso_secrets" {
  name = "${var.env}-eso-secrets-manager"
  role = aws_iam_role.eso.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:ListSecretVersionIds"
      ]
      Resource = "arn:aws:secretsmanager:${var.region}:*:secret:${var.env}/*"
    }]
  })
}

# ── AWS Load Balancer Controller IRSA role ────────────────────────────────────
# Allows the aws-load-balancer-controller ServiceAccount in kube-system to
# create/manage NLBs and ALBs in response to LoadBalancer services and Ingresses.
resource "aws_iam_role" "lbc" {
  name = "${var.env}-aws-load-balancer-controller"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = var.oidc_provider_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${var.oidc_provider}:sub" = "system:serviceaccount:kube-system:aws-load-balancer-controller"
          "${var.oidc_provider}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })

  tags = {
    Name = "${var.env}-aws-load-balancer-controller"
    Env  = var.env
  }
}

# AWS-managed policy with all permissions LBC needs (EC2, ELB, IAM, WAF, etc.)
resource "aws_iam_role_policy_attachment" "lbc" {
  role       = aws_iam_role.lbc.name
  policy_arn = "arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess"
}

# LBC also needs EC2 permissions to describe VPCs, subnets, security groups, etc.
resource "aws_iam_role_policy" "lbc_ec2" {
  name = "${var.env}-lbc-ec2"
  role = aws_iam_role.lbc.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeAccountAttributes",
          "ec2:DescribeAddresses",
          "ec2:DescribeAvailabilityZones",
          "ec2:DescribeInternetGateways",
          "ec2:DescribeVpcs",
          "ec2:DescribeVpcPeeringConnections",
          "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeInstances",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DescribeTags",
          "ec2:GetCoipPoolUsage",
          "ec2:DescribeCoipPools",
          "ec2:CreateSecurityGroup",
          "ec2:CreateTags",
          "ec2:DeleteTags",
          "ec2:AuthorizeSecurityGroupIngress",
          "ec2:RevokeSecurityGroupIngress",
          "ec2:DeleteSecurityGroup"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:CreateServiceLinkedRole",
          "iam:GetServerCertificate",
          "iam:ListServerCertificates"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["cognito-idp:DescribeUserPoolClient"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["waf-regional:*", "wafv2:*", "shield:*"]
        Resource = "*"
      }
    ]
  })
}