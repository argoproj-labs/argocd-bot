#!/usr/bin/env bash

# helper script to diff two files

git diff -U0 ${1} ${2} | tail -n +5
