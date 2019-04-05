#!/usr/bin/env bash

# Helper script forked by bot
# syncs app with revision=branch

function usage_and_exit() {
    echo "${0} [app name]"
    exit 1
}

app_name="${1}"

if [[ -z "${app_name}" ]]; then
    usage_and_exit
fi

argocd app get ${app_name} --plaintext
