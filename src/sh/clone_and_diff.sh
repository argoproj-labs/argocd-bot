#!/usr/bin/env bash

# Helper scripts exec'd by argo-bot, to clone repo, check out branch of the current open PR, and diff using argo binary
# stdout/stderr will go to the PR as a comment
function usage_and_exit() {
    echo "${0} [repo path] [git repo to clone] [branch to check out]"
    echo "script will run \"argocd diff --local\" on branch"
    exit 1
}

# directory to use to clone repo and check out current PR
repo_path="${1}"
# git clone URL
clone_url="${2}"
branch_name="${3}"

if [[ -z "${repo_path}" || -z "${clone_url}" || -z "${branch_name}" ]]; then
    usage_and_exit
fi

if [[ ! -d "${repo_path}" ]]; then
    mkdir -p "${repo_path}" && cd "${repo_path}"
    git clone "${clone_url}" && cd * && git checkout "${branch_name}"
else
    # we have already cloned the repo, just reset to the latest changes in remote
    cd "${repo_path}" && cd *
    git fetch --all && git checkout "${branch_name}" && git reset --hard origin/${branch_name}
fi
