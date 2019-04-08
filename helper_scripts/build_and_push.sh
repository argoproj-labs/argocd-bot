set -e

# helper script to push to docker hub: https://hub.docker.com/r/marcb1/argocd-bot

version=0.1

ARGOCD_SERVER="${1}"
if [[ -z "${ARGOCD_SERVER}" ]]; then
    echo "usage: ${0} [argocd URL to download CLI from]"
    exit 1
fi

docker build --build-arg ARGOCD_SERVER="${ARGOCD_SERVER}" -f deployment/Dockerfile -t argocd-bot .
docker tag argocd-bot marcb1/argocd-bot:v${version}
docker push marcb1/argocd-bot:v${version}
