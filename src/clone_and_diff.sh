

#!/usr/bin/env bash

# Helper scripts exec'd by argo-bot, to clone repo, check out branch of the current open PR, and diff using argo binary
# stdout/stderr will go to the PR as a comment

function usage_and_exit() {
    echo "${0} [git repo to clone] [branch to check out]"
    echo "script will run \"argocd diff --local\" on branch"
    exit 1
}

usage_and_exit
