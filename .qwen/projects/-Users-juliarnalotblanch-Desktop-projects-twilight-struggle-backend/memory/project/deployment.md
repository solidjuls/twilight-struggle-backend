---
name: Deployment setup and infrastructure
description: GCP Cloud Run deployment config, secrets, Docker setup, and known issues
type: project
---

Backend deploys to GCP Cloud Run via deploy.sh (manual, local), uses Secret Manager for sensitive vars, has prod and test environments.

**Why:** User prefers manual deploys over CI to avoid compute costs on free tier.

**How to apply:** Run `./deploy.sh prod` or `./deploy.sh test` from local machine.
