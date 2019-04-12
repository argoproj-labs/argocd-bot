#!/usr/bin/env bash

# Helper script forked by bot
# syncs app with revision=branch

function usage_and_exit() {
    echo "${0} [app name] [branch]"
    exit 1
}

app_name="${1}"
branch="${2}"

if [[ -z "${app_name}" || -z "${branch}" ]]; then
    usage_and_exit
fi

argocd app sync ${app_name} --revision=${branch} --plaintext
argocd app wait ${app_name} --sync --plaintext
