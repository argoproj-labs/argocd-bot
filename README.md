# Argocd Bot
A github bot that run diffs on PRs using `argocd` CLI.  
Still a WIP. 


## Workflow
This section describes the workflow supported by the bot.

### Workflow basics
- User opens a PR in a Kubernetes repo with changes to deployment files.
- User comments with `argo diff` on the PR.
- Bot checks out current state of PR and runs `argocd diff --local`. Diff output is posted on the PR as a comment.
- Team can review code changes in the PR, and double check the posted diff.
- User can iterate, making changes on the PR and re-comment with `argo diff` once they are ready.
- Once the PR is merged, ArgoCD server syncs it with production.

### Locking
When `diff` is run on by a user, the PR holds a lock, until the it is merged, or `unlock` is run.
The PR lock prevents other users from attempting to run `diff` on their PRs. This is to synchronize changes on master.  
i.e to prevent a scenario like this:
- Alice creates a PR, comments `diff`, and she's happy with the output posted.
- Bob creates a second PR, and comments `diff`.
- Bob merges his PR to master.
- Alice's diff output on her PR is now invalid and she might have no idea. Her merge to master, might produce a different state than what her diff had shown.

With locking in place, Bob will not be able to merge his PR until he coordinates with Alice, by either running `unlock`, or waiting for her PR to get merged first.

### Workflow Commands
These are commands that are supported by the bot.
- `argo diff`: this checks out the current state of the PR, queries the argoCD server at `/api/v1/applications` and diffs all applications with their current state from the PR.
- `argo unlock`: this unlocks the current PR, so other users can run `diff`; see locking section above.


## Development
TODO
### Tests
`./test` repo contains basic unit tests, to run use: `npm test`


## Deployment
TODO
## Starting Server
`npm install && npm start`


## Contributing
This section, I'll try to explain how this bot works for someone trying to understand the codebase.

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
