# Argocd Bot
Simple bot to run argo diffs on PRs 
Still a WIP.


## Workflow
- User opens a PR with changes in Kubernetes repo
- User comments with `argo diff` on PR
- Argo bot checks out current state of PR and runs `argocd diff --local` posting output on the PR
- Team can review code changes in git, and the posted argo diff
- User can iterate, making changes and re-comment with `argo diff`
- Once PR is merged, Argo server syncs it with production

## Tests
`./test` repo contains basic unit tests, to run use: `npm test`

## Starting Server
`npm install && npm start`


## Minimal TODO
- Argo-Bot should clone current state of PR, before running argocd diff --local, using helper script `src/clone_and_diff.sh`
- Config parameters
- Proper global lock, so one command is executed at a time
- Proper configuration for argo-cd server (for now, these can be set as env variable)
```
export ARGOCD_SERVER=argocd.mycompany.com
export ARGOCD_AUTH_TOKEN=<JWT token generated from project>
argocd app diff
```
- For github repo's that contain multiple Kubernetes applications/deployments, use argocd api to dynamically find applications that will be affected by the PR's changes
- Deployment for Kubernetes
