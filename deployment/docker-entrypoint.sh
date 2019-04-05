#!/usr/bin/env bash

# helper function to setup env variables needed by argocd cli
function setup_env {
    export USER=argobot
    export $(cat .env | xargs -L1)
}

setup_env
NODE_TLS_REJECT_UNAUTHORIZED=0 npm start
