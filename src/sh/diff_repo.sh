#!/usr/bin/env bash

# Helper script forked by bott
# diffs local directory with argocd app

function usage_and_exit() {
    echo "${0} [repo path] [app name] [dir]"
    echo "script will run \"argocd diff --local\" on [dir]"
    exit 1
}

repo_path="${1}"
app_name="${2}"
dir="${3}"

if [[ -z "${repo_path}" || -z "${app_name}" || -z "${dir}" ]]; then
    usage_and_exit
fi

cd ${repo_path} && cd * && argocd app diff ${app_name} --local=${dir} --plaintext
