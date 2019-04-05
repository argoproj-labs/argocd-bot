#!/usr/bin/env bash

# Helper script forked by bot
# syncs app with revision=branch

function usage_and_exit() {
    echo "${0} [action: run, view] [app name]"
    exit 1
}

function view_latest_deployment() {
    local app_name=${1}
    argocd app history ${app_name} --plaintext
}

action="${1}"
app_name="${2}"

if [[ -z "${app_name}" || -z "${action}" ]]; then
    usage_and_exit
fi

if [[ ${action} == "run" ]]; then
    # get the first of the last two deployments, as we need to revert the latest one, by going to the deployment before the latest
    latest=$(view_latest_deployment ${app_name} | tail -2 | head -1 | awk '{print $1}')
    argocd app rollback ${app_name} ${latest} --plaintext
elif [[ ${action} == "view" ]]; then
    view_latest_deployment ${app_name} | sed -n '1p;$p'
fi
