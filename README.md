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


## Deployment
Docker based deployment is still a WIP.
To run the bot for now follow the steps below:

### Create a Github App
Create a new GitHub App [here](https://github.com/settings/apps/new).  
- Webhook URL, is the host where the bot will run.
- Webhook Secret, is an optional secret, make sure it matches the config (see below section)
- Private key, generate a new key and place it in the root directory, and update config below.
- Check the generated `APP_ID` by Github.
For more on creating Github apps [see](https://probot.github.io/docs/development/#manually-configuring-a-github-app)

### Update Config
There is an `.env_example` file, that file should be renamed to `.env`. NodeJS will read that file and expose the variables to the bot.  
Here is a description of each parameter:
- `PORT` is the port that bot will listen on via HTTP.
- `WEBHOOK_SECRET` is the secret configured when creating the Github app (can be left empty if no secret is specified).
- `LOG_LEVEL` can be set to `trace`, `debug`, `info`, `warn`, `error`, or `fatal`.
- `APP_ID` is the app id generated by Github when the app got created.
- `PRIVATE_KEY_PATH` is the path to the private key generated for the Github app, this is usually a `.pem` file.
- `GHE_HOST` for Github enterprise installations, specify the hostname. Otherwise leave blank, bot will use Github.com
- `ARGO_CD_API_TOKEN` it is recommended to generate an automation token using the `/api/v1/projects/{project}/roles/{role}/token` API. For more information [see](https://github.com/argoproj/argo-cd/blob/master/docs/security.md#authentication)
- `GITHUB_TOKEN` generate a Github token for the bot, and give it no scopes. This is just used to clone the repo.
- `GITHUB_REPO` this is the repo that the bot will operate on.

### Starting Server
`npm install && npm start`


## Architecture
See docs [here](./docs/architecture.md)


## Development/Contributing
See docs [here](docs/development.md)


## Minimal TODO
- rename tokens, to `ARGOCD_SERVER` and `ARGOCD_AUTH_TOKEN`, see: https://github.com/argoproj/argo-cd/blob/master/docs/ci_automation.md
- Declare env variables in unit tests + add more tests + fix up current ones
- Deployment for Kubernetes

## Future Work
- tag releases in Github
- look into Github deployment API
