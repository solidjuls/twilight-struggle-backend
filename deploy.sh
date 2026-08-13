#!/bin/bash
set -e

# ─── Configuration ───────────────────────────────────────────
PROJECT_ID="api-cron-service"
REGION="us-central1"

# ─── Environment selection ───────────────────────────────────
# Usage: ./deploy.sh prod | test
ENV="${1:-prod}"

if [[ "${ENV}" != "prod" && "${ENV}" != "test" ]]; then
  echo "❌ Usage: ./deploy.sh [prod|test]"
  exit 1
fi

SERVICE_NAME="twilight-struggle-backend-${ENV}"
IMAGE="gcr.io/${PROJECT_ID}/twilight-struggle-backend"

echo "🎯 Environment: ${ENV}"
echo "📋 Service: ${SERVICE_NAME}"

# ─── Non-sensitive env vars ──────────────────────────────────
ENV_VARS=(
  "NODE_ENV=production"
  "NEXT_PUBLIC_TOKEN_COOKIE_NAME=__access_token__"
  "JWT_EXPIRES_IN=60d"
  "NEXT_PUBLIC_MAINTENANCE_MODE=false"
  "SMTP_FROM=i.twilightstruggle@gmail.com"
  "SMTP_USER=i.twilightstruggle@gmail.com"
  "SMTP_USER_JUNTA=its.junta@gmail.com"
  "SMTP_FROM_JUNTA=its.junta@gmail.com"
)

if [[ "${ENV}" == "prod" ]]; then
  ENV_VARS+=(
    "NEXT_PUBLIC_API_URL=https://twilight-struggle-backend-9hb8t12ud-solidjuls-projects.vercel.app/api"
    "NEXT_PUBLIC_URL=https://your-prod-frontend.com"
  )
else
  ENV_VARS+=(
    "NEXT_PUBLIC_API_URL=http://localhost:4002/api"
    "NEXT_PUBLIC_URL=http://localhost:3000"
  )
fi

# ─── Secret Manager mappings ─────────────────────────────────
# Format: ENV_VAR_NAME=secret-name:version
# Cloud Run resolves these to env vars at runtime — no code changes needed
SECRETS=(
  "DATABASE_URL=${ENV}-DATABASE_URL:latest"
  "JWT_SECRET=${ENV}-JWT_SECRET:latest"
  "SMTP_HOST_RESET_PWD=${ENV}-SMTP_HOST_RESET_PWD:latest"
  "SMTP_PWD_JUNTA=${ENV}-SMTP_PWD_JUNTA:latest"
  "TOKEN_RESET_PASSWORD_ENCRYPTION_SECRET=${ENV}-TOKEN_RESET_PASSWORD_ENCRYPTION_SECRET:latest"
)

# ─── Build --set-env-vars and --set-secrets flags ────────────
ENV_VARS_FLAGS=()
for var in "${ENV_VARS[@]}"; do
  ENV_VARS_FLAGS+=(--set-env-vars "${var}")
done

SECRETS_FLAGS=()
for secret in "${SECRETS[@]}"; do
  SECRETS_FLAGS+=(--set-secrets "${secret}")
done

# ─── Deploy ──────────────────────────────────────────────────
echo "📦 Building ${SERVICE_NAME} (${ENV})..."
gcloud builds submit --tag "${IMAGE}" --project "${PROJECT_ID}"

echo "🚀 Deploying ${SERVICE_NAME} to Cloud Run (${ENV})..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --platform managed \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  "${ENV_VARS_FLAGS[@]}" \
  "${SECRETS_FLAGS[@]}"

echo ""
echo "✅ Deployed ${SERVICE_NAME} (${ENV})!"
echo "🔗 URL: $(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')"
