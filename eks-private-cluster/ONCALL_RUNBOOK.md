# EKS On-Call Runbook

Architecture this runbook covers:

- Private EKS cluster (private API endpoint — access via bastion only)
- AWS NLB → Traefik → backend services (NLB created by AWS Load Balancer Controller)
- cert-manager + Let's Encrypt (HTTP-01 via Traefik) for TLS
- External Secrets Operator (ESO) syncing AWS Secrets Manager → k8s Secrets
- ArgoCD GitOps (all workloads managed from `k8s/gitops/argocd/`)
- Prometheus + Grafana for observability
- RDS PostgreSQL in private subnets (accessible from EKS nodes only)
- Bastion host (private subnet, EC2 Instance Connect Endpoint — no SSH key)

All `kubectl` and `helm` commands must be run from the **bastion host** unless stated otherwise.

---

## 1. On-Call Operating Model

### Severity levels

| Severity | Meaning | Example | Update cadence |
|---|---|---|---|
| `SEV1` | Broad outage or critical security event | All public traffic down, NLB unhealthy | Every 10–15 min |
| `SEV2` | Major degradation, partial service available | TLS broken, one app down | Every 30 min |
| `SEV3` | Limited degradation with workaround | One ArgoCD app degraded, rollback available | Every 60 min |
| `SEV4` | Internal issue, low user impact | One pod restarting, no user impact | Best effort |

### Incident roles

| Role | Responsibility |
|---|---|
| `Incident Commander` | Own incident flow, assign tasks, approve mitigation |
| `Operator` | Run commands, collect evidence, apply rollback or mitigation |
| `Communicator` | Update stakeholders with facts only |
| `Scribe` | Keep record timeline, commands used, and decision log |

### SLO guardrails

**SLI is the name of metric we used to measure our system performance whil SLO is the numerical value of SLI  and SLA which is the buffered SLO which we commit with customer**

| SLO | Target |
|---|---|
| Public ingress availability | 99.9% monthly |
| TLS success rate | 99.95% monthly |
| App HTTP success rate | 99.9% monthly |
| p95 response latency | < 300 ms |
| Mean time to detect (SEV1/2) | < 5 min |
| Mean time to mitigate (SEV2) | < 30 min |

### First 5 minutes checklist

1. Confirm severity and user impact scope.
2. Freeze risky changes — pause manual deploys, do not run `terraform apply` or `helm upgrade` for unrelated changes.
3. Identify blast radius: one app, one namespace, Traefik, ESO, or cluster-wide.
4. Pick mitigation first, root cause second.
5. Start a timeline in the incident channel.

### Connect to bastion (prerequisite for all kubectl commands)

```bash
# Get bastion instance ID
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=prod-bastion" "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text --region ap-southeast-7)

# Connect via EC2 Instance Connect Endpoint (no SSH key required)
aws ec2-instance-connect ssh \
  --instance-id "${INSTANCE_ID}" \
  --region ap-southeast-7

# Or: AWS Console → EC2 → select prod-bastion → Connect → EC2 Instance Connect tab
```

### Core diagnostic commands

```bash
# Cluster-wide health
kubectl get pods -A
kubectl get nodes -o wide
kubectl get events -A --sort-by=.lastTimestamp | tail -50

# Traefik
kubectl get pods -n traefik
kubectl get svc traefik -n traefik
kubectl get ingressroute -A

# ArgoCD
kubectl get applications -n argocd

# ESO
kubectl get secretstore -A
kubectl get externalsecret -A

# cert-manager
kubectl get certificate -A
kubectl get challenge -A

# Workloads
kubectl get pods -n prod-app
kubectl top pods -A
kubectl top nodes
```

---

## 2. Incident Runbooks

---

### Incident 1 — Public traffic fails (5xx / timeout from NLB or Traefik)

#### Symptoms

- `helloworldapp.wolffialampang.com` or any subdomain returns `502`, `503`, `504`
- NLB DNS resolves but requests fail
- Grafana or `/health` endpoints unreachable externally

#### Architecture reminder

```
Internet → Squarespace CNAME → NLB (AWS LBC) → Traefik pods (traefik ns) → backend Service → Pod
```

#### Triage

```bash
# 1. Check Traefik pods
kubectl get pods -n traefik
kubectl describe pod -n traefik -l app=traefik
kubectl logs -n traefik deploy/traefik --tail=300

# 2. Check NLB and service
kubectl get svc traefik -n traefik
# EXTERNAL-IP should show the NLB DNS name

# 3. Check IngressRoute rules
kubectl get ingressroute -A
kubectl describe ingressroute -A

# 4. Check backend pods
kubectl get pods -n prod-app
kubectl get endpoints -n prod-app
```

#### AWS checks (from bastion)

```bash
# Find the NLB created by LBC
aws elbv2 describe-load-balancers \
  --region ap-southeast-7 \
  --query "LoadBalancers[?contains(LoadBalancerName, 'traefik')]"

# Check target group health
aws elbv2 describe-target-groups --region ap-southeast-7
aws elbv2 describe-target-health \
  --target-group-arn <TARGET_GROUP_ARN> \
  --region ap-southeast-7
```

#### Mitigation

```bash
# 1. Traefik pods unhealthy — restart the deployment
kubectl rollout restart deployment/traefik -n traefik
kubectl rollout status deployment/traefik -n traefik

# 2. Backend pods crashing — rollback via ArgoCD
kubectl rollout undo deployment/helloworld -n prod-app

# 3. ArgoCD rollback to previous revision
argocd app history helloworld
argocd app rollback helloworld <REVISION>
```

#### Escalate when

- NLB target group stays unhealthy after Traefik recovery
- Multiple IngressRoutes fail simultaneously
- AWS LBC controller logs show NLB provisioning errors

#### Post-incident

- Add Traefik `PodDisruptionBudget` and verify `replicas: 2` in values
- Tune Traefik readiness/liveness probe thresholds
- Add NLB target health alert in Prometheus

---

### Incident 2 — TLS certificate pending, invalid, or expired

#### Symptoms

- Browser shows "Your connection is not private" or HTTP only
- `kubectl get certificate -n traefik` shows `READY: False` or `Pending`
- `traefik-tls` Secret missing or not type `kubernetes.io/tls`

#### Architecture reminder

```
cert-manager ClusterIssuer → HTTP-01 challenge (Traefik handles /.well-known/acme-challenge/ on port 80)
→ Let's Encrypt validates → cert stored as Secret "traefik-tls" in traefik namespace
→ Traefik IngressRoute reads tls.secretName: traefik-tls
```

#### Triage

```bash
kubectl get pods -n cert-manager
kubectl get clusterissuer
kubectl describe clusterissuer letsencrypt-prod-traefik

kubectl get certificate -n traefik
kubectl describe certificate traefik-tls -n traefik

kubectl get challenge -A
kubectl describe challenge -A

kubectl get secret traefik-tls -n traefik
```

#### Mitigation

```bash
# 1. cert-manager pod unhealthy
kubectl rollout restart deployment/cert-manager -n cert-manager

# 2. Challenge failing — verify HTTP-01 solver can reach port 80
# Traefik must be listening on port 80 and the CNAME in Squarespace must point to the NLB
# Check IngressRoute for websecure redirect doesn't block /.well-known/acme-challenge/
kubectl get ingressroute -n traefik -o yaml | grep -A5 "acme-challenge"

# 3. Force certificate re-issue by deleting and letting cert-manager recreate
kubectl delete certificate traefik-tls -n traefik
# ArgoCD will re-create it on next sync

# 4. Check DNS — Squarespace CNAME must point to the NLB hostname
kubectl get svc traefik -n traefik -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

#### Validate after fix

```bash
curl -vk https://helloworldapp.wolffialampang.com/health
curl -vk https://argocd.wolffialampang.com/
openssl s_client -connect helloworldapp.wolffialampang.com:443 -servername helloworldapp.wolffialampang.com < /dev/null | grep "expire date"
```

#### Escalate when

- Let's Encrypt rate limit hit (5 failures/hour, 50/week per domain)
- Squarespace DNS propagation is blocking challenge validation
- All domains fail simultaneously

#### Post-incident

- Add cert expiry Prometheus alert at 14d, 7d, 3d before expiry
- Document Squarespace DNS change SLA

---

### Incident 3 — Secret not injected / app reads empty or missing env var

#### Symptoms

- `helloworld /secret-check` returns `{"api_key_loaded": false}`
- Pod env var `API_KEY` is empty or missing
- `kubectl get externalsecret -A` shows `SecretSyncError` or stale status

#### Architecture reminder

```
AWS Secrets Manager "prod/helloworld" (JSON: {"API_KEY": "..."})
→ ExternalSecret (ESO) fetches every 1h
→ k8s Secret "helloworld-secrets" in prod-app namespace
→ Deployment secretKeyRef → pod env var API_KEY
→ main.py os.environ.get("API_KEY")
```

#### Triage

```bash
# 1. ESO operator health
kubectl get pods -n external-secrets

# 2. SecretStore connection to AWS
kubectl get secretstore -n external-secrets
kubectl describe secretstore secret-store -n external-secrets
# Look for: "Valid" status and no auth errors

# 3. ExternalSecret sync status
kubectl get externalsecret -n external-secrets
kubectl describe externalsecret helloworld-secrets -n external-secrets
# Look for: "SecretSynced" condition = True

# 4. Check the k8s Secret was created
kubectl get secret helloworld-secrets -n prod-app
kubectl get secret helloworld-secrets -n prod-app -o jsonpath='{.data}' | base64 -d

# 5. Check the pod is using the correct secretKeyRef
kubectl describe pod -n prod-app -l app=helloworld | grep -A5 "secretKeyRef"
```

#### AWS checks

```bash
# Verify the secret exists in Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id prod/helloworld \
  --region ap-southeast-7 \
  --query SecretString \
  --output text

# Verify ESO IRSA role has access
aws sts get-caller-identity --region ap-southeast-7
```

#### Mitigation

```bash
# 1. Force ESO to re-sync immediately (delete and ArgoCD recreates)
kubectl annotate externalsecret helloworld-secrets \
  force-sync=$(date +%s) \
  -n external-secrets

# 2. If SecretStore auth is broken (IRSA role issue), check the ServiceAccount annotation
kubectl get sa eks-secret-store-irsa -n external-secrets -o yaml | grep role-arn
# Must match terraform output eso_role_arn

# 3. If the k8s Secret exists but pod doesn't pick it up, restart the pod
kubectl rollout restart deployment/helloworld -n prod-app

# 4. If Secrets Manager secret value is wrong, update it
aws secretsmanager put-secret-value \
  --secret-id prod/helloworld \
  --secret-string '{"API_KEY":"new-value"}' \
  --region ap-southeast-7
# ESO will sync on next refresh interval (up to 1h) or force sync above
```

#### Escalate when

- IRSA role trust policy mismatch (requires Terraform change)
- Secrets Manager VPC endpoint unreachable
- ESO operator CrashLooping

#### Post-incident

- Reduce `refreshInterval` from `1h` to `15m` for faster secret rotation
- Add Prometheus alert on `externalsecret_sync_calls_error` metric
- Add `/secret-check` endpoint to synthetic monitoring

---

### Incident 4 — ArgoCD app degraded or sync failing

#### Symptoms

- ArgoCD UI shows `Degraded`, `OutOfSync`, or `Unknown`
- New commit to `main` not reflected on cluster after several minutes
- `kubectl get applications -n argocd` shows error

#### Triage

```bash
kubectl get applications -n argocd
kubectl describe application helloworld -n argocd
kubectl describe application traefik -n argocd

# ArgoCD server and repo-server logs
kubectl logs -n argocd deploy/argocd-server --tail=200
kubectl logs -n argocd deploy/argocd-repo-server --tail=200

# Check repo connection (public repo — no credentials needed)
argocd repo list
```

#### Mitigation

```bash
# 1. Force manual sync
argocd app sync helloworld
argocd app sync traefik

# 2. If app is in a failed state, hard refresh
argocd app get helloworld --hard-refresh

# 3. Rollback to previous revision
argocd app history helloworld
argocd app rollback helloworld <REVISION>

# 4. ArgoCD server unhealthy
kubectl rollout restart deployment/argocd-server -n argocd
kubectl rollout restart deployment/argocd-repo-server -n argocd
```

#### Escalate when

- All applications show `Unknown` (ArgoCD itself is down)
- Repo server cannot clone the Git repo

#### Post-incident

- Add ArgoCD app health alert in Prometheus
- Verify `automated.selfHeal: true` is set in all Application CRs

---

### Incident 5 — Node NotReady or pods Pending

#### Symptoms

- `kubectl get nodes` shows `NotReady`
- Pods stuck in `Pending` state
- Workloads unschedulable

#### Triage

```bash
kubectl get nodes -o wide
kubectl describe nodes
kubectl top nodes
kubectl get pods -A --field-selector=status.phase=Pending
kubectl describe pod <PENDING_POD> -n <NAMESPACE>
kubectl get events -A --sort-by=.lastTimestamp | tail -50
```

#### AWS checks

```bash
# Check node group health
aws eks describe-nodegroup \
  --cluster-name prod-eks \
  --nodegroup-name <NODEGROUP_NAME> \
  --region ap-southeast-7

# Check subnet available IPs (VPC CNI exhaustion)
aws ec2 describe-subnets \
  --subnet-ids <PRIVATE_SUBNET_ID_1> <PRIVATE_SUBNET_ID_2> <PRIVATE_SUBNET_ID_3> \
  --region ap-southeast-7 \
  --query "Subnets[].{ID:SubnetId,AvailableIPs:AvailableIpAddressCount}"
```

#### Mitigation

```bash
# 1. Cordon and drain an unhealthy node
kubectl cordon <NODE_NAME>
kubectl drain <NODE_NAME> --ignore-daemonsets --delete-emptydir-data

# 2. Temporarily scale node group if capacity is too low
aws eks update-nodegroup-config \
  --cluster-name prod-eks \
  --nodegroup-name <NODEGROUP_NAME> \
  --scaling-config minSize=2,maxSize=6,desiredSize=4 \
  --region ap-southeast-7
```

#### Escalate when

- All AZs impacted simultaneously
- Subnet IP exhaustion (AvailableIpAddressCount = 0)
- Control plane API unreachable (cannot kubectl from bastion)

#### Post-incident

- Add Karpenter or Cluster Autoscaler
- Add node memory/CPU pressure alerts
- Review subnet CIDR sizing for VPC CNI

---

### Incident 6 — ECR image pull fails (ImagePullBackOff)

#### Symptoms

- Pods stuck in `ImagePullBackOff` or `ErrImagePull`
- New deployment never becomes ready after CI pipeline ran

#### Triage

```bash
kubectl describe pod <POD_NAME> -n prod-app | grep -A10 "Events:"
kubectl get deployment helloworld -n prod-app -o yaml | grep "image:"

# Verify the image tag exists in ECR
aws ecr describe-images \
  --repository-name prod-helloworld \
  --region ap-southeast-7 \
  --query "sort_by(imageDetails, &imagePushedAt)[-5:].imageTags"
```

#### Mitigation

```bash
# 1. Roll back to last known good tag
# Edit values-prod.yaml image.tag and push to trigger ArgoCD sync
# Or rollback directly:
kubectl rollout undo deployment/helloworld -n prod-app

# 2. If pull auth fails — check helloworld IRSA ServiceAccount annotation
kubectl get sa helloworld -n prod-app -o yaml | grep role-arn
# Must match terraform output helloworld_irsa_role_arn

# 3. Test ECR pull auth from a debug pod
kubectl run ecr-test --rm -it \
  --image=amazonlinux:2 \
  --serviceaccount=helloworld \
  -n prod-app \
  -- aws ecr get-login-password --region ap-southeast-7
```

#### Escalate when

- Last known good image also fails to pull
- VPC endpoint for ECR is unreachable (`ecr.api` or `ecr.dkr`)

#### Post-incident

- Add image existence check to CI pipeline before tagging
- Enable ECR image scanning and block push on CRITICAL CVEs (uncomment Trivy step in pipeline)

---

### Incident 7 — RDS PostgreSQL unreachable

#### Symptoms

- pgAdmin pod cannot connect to database
- App logs show connection timeout to RDS endpoint
- `psql` from bastion fails

#### Triage

```bash
# Get RDS endpoint
aws rds describe-db-instances \
  --db-instance-identifier postgres-prod \
  --region ap-southeast-7 \
  --query "DBInstances[0].Endpoint.Address" \
  --output text

# Check RDS instance status
aws rds describe-db-instances \
  --db-instance-identifier postgres-prod \
  --region ap-southeast-7 \
  --query "DBInstances[0].{Status:DBInstanceStatus,AZ:AvailabilityZone,MultiAZ:MultiAZ}"

# Test connectivity from bastion (RDS is in private subnet, bastion is in same VPC)
psql -h <RDS_ENDPOINT> -U pgadmin -d appdb -c "SELECT 1;"
# Password is in Secrets Manager: /<env>/rds/postgres-prod/password

# Retrieve password
aws secretsmanager get-secret-value \
  --secret-id /prod/rds/postgres-prod/password \
  --region ap-southeast-7 \
  --query SecretString --output text
```

#### AWS checks

```bash
# Check RDS security group allows EKS node SG on port 5432
aws ec2 describe-security-groups \
  --filters "Name=tag:Name,Values=prod-rds-sg" \
  --region ap-southeast-7 \
  --query "SecurityGroups[0].IpPermissions"
```

#### Mitigation

```bash
# 1. If RDS is in a failed state, attempt reboot
aws rds reboot-db-instance \
  --db-instance-identifier postgres-prod \
  --region ap-southeast-7

# 2. If security group rule is missing, re-apply Terraform
terraform apply -var-file="envs/prod.tfvars" -target=module.rds
```

#### Escalate when

- RDS shows `failed` status (requires AWS Support)
- Data loss suspected

#### Post-incident

- Enable Multi-AZ in `prod.tfvars`: `rds_multi_az = true`
- Add RDS CPU, connection count, and freeable memory alerts

---

## 3. Recommended Alert Pack

| Area | Alert |
|---|---|
| Traefik | Pod not ready, 5xx rate > 1%, p99 latency spike |
| NLB | Target group unhealthy targets > 0 |
| TLS | Certificate expiry < 14d, challenge failure |
| ESO | `externalsecret_sync_calls_error` > 0 |
| ArgoCD | Application degraded, sync failed |
| Nodes | NotReady, CPU > 85%, memory > 85%, pending pods |
| ECR | ImagePullBackOff events |
| RDS | CPU > 80%, connections > 80% of max, freeable memory < 100MB |
| App | HTTP 5xx rate, p95 latency, restart spike |

---

## 4. Ingress Decision Matrix — Traefik vs AWS LBC (ALB)

This section can also serve as an interview answer on ingress architecture trade-offs.

### Quick summary

- **Traefik** (current) — rich L7 proxy, central routing, Kubernetes-native config via CRDs, best for shared ingress across many services.
- **AWS LBC with ALB** — AWS-native, per-app isolation, WAF/ACM/Cognito integration, lower proxy ops, best for teams wanting AWS-managed edge.

### Decision matrix

| Dimension | Traefik + NLB (current) | AWS LBC + ALB |
|---|---|---|
| Data path | NLB → Traefik pods → Service → Pod | ALB → Target Group → Pod (ip mode) |
| L7 routing | Rich: middleware, rewrite, path strip, auth, rate limit | Good via annotations, less flexible |
| TLS management | cert-manager + Let's Encrypt | ACM (auto-renews, no cert-manager needed) |
| AWS native integration | Moderate | Strong: WAF, Shield, Cognito, ACM |
| Shared ingress model | Excellent — one Traefik for all apps | Less efficient — one ALB per Ingress by default |
| Blast radius | Higher — Traefik outage affects all apps | Lower — one app's ALB fails independently |
| Cost | Lower — one NLB shared across all apps | Higher if many apps each get an ALB |
| Observability | Traefik dashboard + Prometheus metrics | AWS CloudWatch + Access Logs |
| Config complexity | CRD-based (IngressRoute, Middleware) | Annotation-based on Ingress objects |
| On-call burden | Higher: proxy tuning, cert-manager ops | Lower on proxy layer, higher on AWS annotation complexity |

### When to switch to ALB

Revisit AWS LBC + ALB when:

- You need WAF or AWS Shield at the edge
- Teams want per-app ingress ownership and blast radius isolation
- You want ACM instead of cert-manager (removes Let's Encrypt rate limit risk)
- You integrate Cognito or AWS-native OIDC at the edge

### Current recommendation

Stay with **Traefik + NLB** because:
- Single ingress layer is simpler to reason about for this project
- cert-manager + Let's Encrypt avoids ACM cost and IAM complexity
- Middleware chain (auth, rate limit, headers) is more expressive than ALB annotations
- All current subdomains share one NLB — cost-efficient

---

## 5. Improvement Backlog

| Priority | Item |
|---|---|
| High | Add Alertmanager with Slack/PagerDuty routing |
| High | Add `PodDisruptionBudget` for Traefik and helloworld |
| High | Enable RDS Multi-AZ (`rds_multi_az = true` in prod.tfvars) |
| Medium | Add Karpenter or Cluster Autoscaler for workload spikes |
| Medium | Reduce ESO `refreshInterval` to 15m for faster secret rotation |
| Medium | Enable Trivy and Semgrep steps in CI pipeline |
| Medium | Add synthetic monitoring on `/health` and `/secret-check` |
| Low | Add subnet CIDR alerts for VPC CNI IP exhaustion |
| Low | Add topology spread constraints for Traefik replicas |
