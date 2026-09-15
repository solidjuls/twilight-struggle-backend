---
name: Deployment setup and infrastructure
description: GCP Cloud Run deployment config, preview deploys via GitHub Actions, secrets, Docker setup
type: project
---

Backend deploys to GCP Cloud Run, project ID `api-cron-service`, region `us-central1`.

**Manual deploys:** `./deploy.sh prod` or `./deploy.sh test` from local machine. Uses Secret Manager for sensitive vars (`{env}-SECRET_NAME:latest`).

**Preview deploys (GitHub Actions):**
- `preview-deploy.yml` — on PR open/sync: builds Docker image, deploys to per-PR Cloud Run service (`twilight-struggle-backend-pr-{number}`), posts URL as PR comment.
- `preview-cleanup.yml` — on PR close: deletes the per-PR Cloud Run service.
- Per-PR services use `--no-traffic` initially, then route 100% to latest revision. `min-instances=0`, `max-instances=1` to stay free.
- Requires `GCP_SA_KEY` GitHub secret (GCP service account JSON with Cloud Run + GCR permissions).

**Docker:** Multi-stage build — Node 20 Bookworm slim. Builder runs `npm ci` + `npm run build` (uses `tsconfig.build.json` with `rootDir: ./src`). Production stage copies dist, node_modules, prisma schema. Runs on port 8080. `ARG DATABASE_URL` provides dummy value for Prisma generate during build.

**Database:** MySQL via Prisma ORM. Connection string stored as GCP Secret.

**Why:** User prefers zero-cost deploys over Vercel, using GCP free tiers.
