# Argocd Bot
A bot to help automate [argo-cd](https://github.com/argoproj/argo-cd) changes via Github PRs.  
Currently supports running diffs on open Pull Requests, check the Workflow section for more, or comment `argo help` on an open PR.  

## Benefits
#### Easier Deployments/Fewer Mistakes
- Comment `argo diff` on an open PR, to view diff between local branch and Kubernetes cluster.
- PR diffs can be easily reviewed by everyone.
- Catch errors in the output of `argo diff` before applying changes.
- Comment `argo sync [app name]` to deploy changes, and merge PR.

#### Lock-down Deployments
- Users can submit changes via Github (after PR approval), without needing cluster credentials.
- Audit changes made to clusters via Github PRs/server logs.

## Workflow
This section describes the workflow supported by the bot.

### Workflow basics
- User opens a PR in a Kubernetes repo with changes to deployment files.
- User comments with `argo diff` on the PR.
- Bot checks out current state of PR and runs `argocd diff --local`. Diff output is posted on the PR as a comment.
- Team can review code changes in the PR, and double check the posted diff.
- Author can iterate, making changes on the PR and re-comment with `argo diff` once they are ready.
- Deploying Changes:
  - If Auto Sync is enabled: once the PR is merged, ArgoCD server syncs it with production.
  - Otherwise, user can comment `argo sync [app name]` to sync changes from branch, before merging PR.
  
### PR Example
<img width="700" alt="pr-example" src="https://raw.githubusercontent.com/marcb1/argocd-bot/master/docs/readme-images/pr-example.png">

### Locking
When any command is run on by a user, the PR holds a lock, until the it is merged, or `unlock` is run.
The PR lock prevents other users from attempting to run commands on their PRs. This is to synchronize changes on master.  
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
- `argo sync [app name]`: this syncs changes on current branch
- `argo rollback`: this rolls back latest change

More commands might be added, run `argo help` on a PR, to view all supported commands.

## Deployment

### Create a Github App
Create a new GitHub App [here](https://github.com/settings/apps/new).  
- Webhook URL, is the host where the bot will run.
- Webhook Secret, is an optional secret, make sure it matches the config (see below section)
- Private key, generate a new key and place it in the root directory, and update config below.
- Check the generated `APP_ID` by Github.
For more on creating Github apps [see](https://probot.github.io/docs/development/#manually-configuring-a-github-app)

### Required Permissions for Github App
Please give the argo-cd app the following permissions:
```
Read access to administration and metadata
Read and write access to commit statuses, issues, and pull requests 
```

### Update Config
There is an `.env_example` file that should be renamed to `.env`. NodeJS will read that file and expose the variables to the bot, when running locally.  
When running in Kubernetes, there is a helper script to create k8s secrets from that file (more on this in the kubernetes deployment section).  
Here is a description of each parameter:
- `PORT` is the port that bot will listen on via HTTP.
- `LOG_LEVEL` can be set to `trace`, `debug`, `info`, `warn`, `error`, or `fatal`.
- `KUBECTL_EXTERNAL_DIFF` this is used by `argocd diff`, we pass a helper script to pretti-fy diffs posted on the PR.
- `APP_ID` is the app id corresponding to the Github app (this is generated on app creation).
- `GHE_HOST` for Github enterprise installations, specify the hostname. Otherwise leave blank, bot will use Github.com
- `GITHUB_REPO` this is the repo that the bot will operate on.
- `GITHUB_TOKEN` generate a Github token for the bot, and give it no scopes. This is just used to clone the repo.
- `WEBHOOK_SECRET` is the secret configured when creating the Github app (can be left empty if no secret is specified).
- `PRIVATE_KEY_PATH` is the path to the private key generated for the Github app, this is usually a `.pem` file.
- `ARGOCD_SERVER`, this is the ip address/hostname of the argocd server.
- `ARGOCD_AUTH_TOKEN` it is recommended to generate an automation token using the `/api/v1/projects/{project}/roles/{role}/token` API. For more information [see](https://argoproj.github.io/argo-cd/operator-manual/security/#authentication)

### Kubernetes Deployment
Docker images of `argocd-bot` are built [here](https://cloud.docker.com/repository/docker/marcb1/argocd-bot), they are provided as part of releases [here](https://github.com/marcb1/argocd-bot/releases)

Check the config section above, once you have a `.env` file that's populated with the correct values run `./helper_scripts/create_kubectl_secrets.sh`.  
This will generated a k8s secret `argocd-bot-secret` used by the deployment.  

Build manifests using `kustomize`:
`npm run manifests`

Create deployment from manifests:
`kubectl create -f deployment/install.yaml`

### Manual Deployment
See docs [here](./docs/development.md#manual-deployment)

## Development/Contributing
See docs [here](docs/development.md)
