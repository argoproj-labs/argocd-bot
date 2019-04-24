#!/usr/bin/env bash

# Helper script forked by bot
# syncs app with revision=branch

function usage_and_exit() {
    echo "${0} [optional flag: -d or --dry-run] [app name]"
    exit 1
}

function view_deployments() {
    local app_name=${1}
    argocd app history ${app_name} --plaintext
}

if [[ ${1} == "--dry-run" || ${1} == "-d" ]]; then
    dry_run=true
    app_name="${2}"
else
    app_name="${1}"
fi

if [[ -z "${app_name}" ]]; then
    usage_and_exit
fi

history_count=$(view_deployments ${app_name} | sed  '1d' | wc -l)
if [[ ${history_count} -lt 1 ]]; then
    echo "There is less than one deployment made via argo, cannot rollback; 2 or more deployments must exist:"
    echo "Deployment history:"
    view_deployments ${app_name}
    exit
fi

# remove the first line (which is just the status line)
# the latest deployment is the last line in the history output
latest=$(view_deployments ${app_name} | sed  '1d' | tail -1)
# the deployment before the last is the one we want to roll back to
before_latest=$(view_deployments ${app_name} | sed  '1d' | tail -2 | head -1 )

if [[ ${dry_run} = true ]]; then
    echo "Latest deployment:"
    echo "${latest}"
    echo ""
    echo "Will rollback the above deployment to the following:"
    echo "${before_latest}"
else
    roll=$(echo $before_latest | awk '{print $1}')
    argocd app rollback ${app_name} ${roll} --plaintext
fi
