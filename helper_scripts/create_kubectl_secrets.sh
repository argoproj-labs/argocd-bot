#!/usr/bin/env bash
export $(cat .env | xargs -L1)

kubectl create secret generic argocd-bot-secret \
    --from-literal=APP_ID=$APP_ID \
    --from-literal=GHE_HOST=$GHE_HOST \
    --from-literal=GITHUB_REPO=$GITHUB_REPO \
    --from-literal=GITHUB_TOKEN=$GITHUB_TOKEN \
    --from-literal=WEBHOOK_SECRET=$WEBHOOK_SECRET \
    --from-file=key.pem=$PRIVATE_KEY_PATH \
    --from-literal=ARGOCD_SERVER=$ARGOCD_SERVER \
    --from-literal=ARGOCD_AUTH_TOKEN=$ARGOCD_AUTH_TOKEN
