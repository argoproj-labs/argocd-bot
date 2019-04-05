#!/usr/bin/env bash

# Script to exec bash in argocd-bot for testing

pod_name=$(kubectl get pod -l app=argocd-bot -o custom-columns=":metadata.name" --no-headers)
kubectl exec -ti ${pod_name} bash
