#!/usr/bin/env bash
set -e
# helper script to push to docker hub: https://hub.docker.com/r/marcb1/argocd-bot

version=0.3
docker build -f Dockerfile -t argocd-bot .
docker tag argocd-bot marcb1/argocd-bot:v${version} && docker tag argocd-bot marcb1/argocd-bot:latest
docker push marcb1/argocd-bot:v${version} && docker push marcb1/argocd-bot:latest
