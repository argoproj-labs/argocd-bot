import { PrLock } from "./singleton-pr-lock";

import { ArgoAPI } from "./argo-api";
import { ArgoBotConfig } from "./argo-bot-config";
import { to } from "./to";

// bot command that triggers this bot to wake up
const BotCommand = "argo";

// supported actions, must be prefixed by BotCommand for example 'argo unlock'
const BotActions = Object.freeze({Unlock: "unlock", Diff: "diff", Sync: "sync", Preview: "preview", Info: "info", History: "history", Rollback: "rollback", Help: "help"});
// supported diff flags
const BotDiffActions = Object.freeze({AutoSync: "--auto-sync", All: "--all", Dir: "--dir", DirShort: "-d"});

// help string for actions
const diffHelp = `
by default diffs all deployment files in current branch, against what's deployed on their respective GKE cluster.
Apps must be managed by argocd server.
supported flags:
--auto-sync: diffs all apps with auto sync enabled against yaml files/helm charts on current branch
--dir [dir name] or -d [dir name]: diffs all yaml files/helm charts in a specific directory against what's deployed in GKE
                                   will look in subdirectories i.e 'argo diff -d /abc' will also check attempt to diff all deployments in 'abc' dir
--all: diffs all apps on current branch against what's deployed in GKE (default behavior)`;

const BotHelp = Object.freeze({Diff: diffHelp,
                               History: "[Not yet supported] history [app name], prints deployment history of app",
                               Info: "usage: 'info [app name]`, view info for a specific app",
                               Preview: "[Not yet supported] deploy temporary PR",
                               Rollback: "rollback [optional: --dry-run or -d] [app name], use 'rollback --dry-run app' or 'rollback -d app' to see latest deployment info, use 'rollback app' to rollback the latest deployment to the previous one, verify rollback using diff command",
                               Sync: "usage: `sync [app name]`, syncs deployment in GKE cluster with manifests or helm charts using branch in current PR",
                               Unlock: "removes lock held by current PR, allows other PR's to run bot"});

export class ArgoBot {
    // checks if command is valid and can be processed by ArgoBot
    // a valid command looks like so "argo [action]"
    public static isBotCommand(command) {
        const arr = command.split(" ");
        if (!arr || arr.length < 2) {
            return false;
        } else if (arr[0] !== BotCommand) {
            return false;
        }
        return true;
    }

    // responde with comment on current issue in context
    // ArgoBot is triggered for PR comments, so this will create a new comment on the PR
    private static async respondWithComment(context, comment) {
        const response = context.issue({body: comment});
        await context.github.issues.createComment(response);
    }

    // sets the status check on a PR, example args:
    // state="success", description="message", context="argo/diff_success"
    private static async setPrStatusCheck(context, stateString, descriptionString, contextString) {
        const prNumber = context.payload.issue.number;
        const branchContext = await ArgoBot.getCurrentBranchContext(context, prNumber);
        await context.github.repos.createStatus({owner: branchContext.head.repo.owner.login, repo: branchContext.head.repo.name, sha: branchContext.head.sha, state: stateString, description: descriptionString, context: contextString});
    }

    private static async setDiffStatusCheck(context, state) {
        context.log.info("setting status check=argo/diff state=", state);
        await ArgoBot.setPrStatusCheck(context, state, "argo diff status", "argo/diff");
    }

    private static async setSyncStatusCheck(context, state) {
        context.log.info("setting status check=argo/sync state=", state);
        await ArgoBot.setPrStatusCheck(context, state, "argo sync status", "argo/sync");
    }

    // gets current branch name for pr with a specific number
    private static async getCurrentBranchContext(context, prNumber) {
        // I couldn't find an API call that filters this properly
        let prs = await context.github.pullRequests.list(context.repo());
        prs = prs["data"];
        for (const key in prs) {
            if (prs[key]["number"] === prNumber) {
                return prs[key];
             }
        }
        context.log.error("pr not found!");
    }

    // gets current branch name for pr with a specific number
    private static async getCurrentBranch(context, prNumber) {
        const branchContext = await ArgoBot.getCurrentBranchContext(context, prNumber);
        return branchContext["head"]["ref"];
    }

    // ---------------------
    // data members here
    private botCommand;
    private appContext;
    private argoConfig;
    private argoAPI;

    // ----------------------
    // non-static functions here

    constructor(appContext) {
        this.botCommand = BotCommand;
        this.appContext = appContext;
        this.argoConfig = new ArgoBotConfig();
        this.argoAPI = new ArgoAPI(this.appContext, this.argoConfig.getAPIToken(), this.argoConfig.getServerIP());
    }

    // handles command sent by user on PR
    public async handleCommand(command) {
        if (!ArgoBot.isBotCommand(command)) {
            this.appContext.log.error("received non-bot command:" + command);
            return;
        }
        const arr = command.split(" ");
        const action = arr[1];

        const prNumber = this.appContext.payload.issue.number;
        this.appContext.log("received command=" + command + ", for PR#" + prNumber);

        if (action === BotActions.Help) {
            return await this.handleHelpAction();
        }

        // if action is an unlock request, process it here and return
        if (action === BotActions.Unlock) {
            return await this.handleUnlockAction();
        }

        // otherwise user is trying to run a command, attempt to obtain lock
        const lockRes = await this.attemptLock();
        if (lockRes === false) {
            return;
        }

        if (action === BotActions.Info) {
            if (arr[2]) {
                return await this.handleInfo(arr[2]);
            }
        }

        if (action === BotActions.Rollback) {
            if (arr[2] || (arr[3] && arr[3])) {
                return await this.handleRollback(arr[2], arr[3]);
            }
        }

        if (action === BotActions.Sync) {
            this.appContext.log("Received sync, processing; command:", arr);
            if (arr[2]) {
                return await this.handleSync(arr[2]);
            }
        }

        if (action === BotActions.Diff) {
            // valid argo action, try executing command in shell
            this.appContext.log("Received diff, processing; command:", arr);
            let jsonResponse = {};
            if (arr[2] && arr[2] === BotDiffActions.AutoSync) {
                this.appContext.log("Received diff command with" + BotDiffActions.AutoSync);
                jsonResponse = await this.argoAPI.fetchAllAutoSyncApps();
                return await this.handleDiff(jsonResponse);
            } else if (arr[2] && (arr[2] === BotDiffActions.Dir || arr[2] === BotDiffActions.DirShort) && arr[3]) {
                this.appContext.log("Received diff command with" + BotDiffActions.Dir);
                jsonResponse = await this.argoAPI.fetchAppsWithDirectory(arr[3]);
                return await this.handleDiff(jsonResponse);
            } else if (arr[2]) {
                // if arr[2] is not empty, then it's not a valid diff arg, notify user
                this.appContext.log("Received unsupported diff command");
                const args = arr.toString();
                const help = `
Received command:
\`\`\`
${args}
\`\`\`
This is an unsupported \`diff\` command. Supported commands are:
\`\`\`
${BotActions.Diff}: ${BotHelp.Diff}
\`\`\`
`;
                return await ArgoBot.respondWithComment(this.appContext, help);
            } else {
                this.appContext.log("Received diff command, using default behavior");
                jsonResponse = await this.argoAPI.fetchAllApplications();
                return await this.handleDiff(jsonResponse);
            }
        }

        // Invalid command, print help text
        await ArgoBot.respondWithComment(this.appContext, "Invalid command; received command: `" + command + "`");
        await this.handleHelpAction();
    }

    // executes argo commands in local shell environment, and returns stdout
    // optional failingExitCode which will return an error, by default exit code = 1 will error
    // this is needed since 'argo diff' returns exit 1 on success when a diff is found
    private async execCommand(command, failingExitCode = 1) {
        const exec = require("child_process").exec;
        const p = new Promise((done, failed) => {
            exec(command, (err, stdout, stderr) => {
                const res: any = {};
                res.stdout = stdout;
                res.stderr = stderr;
                if (err && err.code === failingExitCode) {
                    res.err = err;
                    failed(res);
                    return;
                }
                done(res);
            });
        });
        return await p;
    }

    private async handleHelpAction() {
        const help = `
Hi, I'm a bot that helps with Kubernetes deployments. Invoke me via \`${BotCommand}\` on PRs.
Supported commands are:
\`\`\`
${BotActions.Diff}: ${BotHelp.Diff}

${BotActions.Unlock}: ${BotHelp.Unlock}

${BotActions.Sync}: ${BotHelp.Sync}

${BotActions.Info}: ${BotHelp.Info}

${BotActions.History}: ${BotHelp.History}

${BotActions.Rollback}: ${BotHelp.Rollback}
\`\`\`
`;
        await ArgoBot.respondWithComment(this.appContext, help);
    }

    // attempts to obtain lock from singleton, returns true if lock was obtained
    private async attemptLock() {
        const prTitle = this.appContext.payload.issue.title;
        const prNumber = this.appContext.payload.issue.number;

        // this is a singleton
        const prLock = new PrLock();
        if (prLock.tryLock(prTitle, prNumber) === false) {
            const lockMessage = prLock.getLockInfo() +  "; is holding the lock, please merge PR or comment with \`" + BotCommand + " unlock\` to release lock";
            await ArgoBot.respondWithComment(this.appContext, lockMessage);
            return false;
        }
        return true;
    }

    // handles unlock action, which is sent by user to remove lock on current PR
    private async handleUnlockAction() {
        const prNumber = this.appContext.payload.issue.number;
        const prLock = new PrLock();

        // if user wants to unlock, and lock is held by current PR, unlock
        if (prLock.getPrNumber() === prNumber) {
            this.appContext.log("received unlock request, unlocking...");
            prLock.unlock(prNumber);
            return await ArgoBot.respondWithComment(this.appContext, "Lock has been released!");
        } else {
            // notify user to unlock from the PR that owns the lock
            this.appContext.log("received unlock request from the wrong PR");
            const lockMessage = prLock.getLockInfo() +  "; is holding the lock, please comment on that PR to unlock";
            return await ArgoBot.respondWithComment(this.appContext, lockMessage);
        }
    }

    private async handleClosedPR() {
        const prNumber = this.appContext.payload.issue.number;
        const prLock = new PrLock();
        prLock.unlock(prNumber);
    }

    private async respondWithError(error) {
        this.appContext.log.error(error);
        await ArgoBot.respondWithComment(this.appContext, error);
    }

    private buildErrString(command, stderr) {
        const errString = `
\`${command}\` returned an error:
\`\`\`
${stderr}
\`\`\`
`;
        return errString;
    }

    private async handleRollback(action, appName) {
        let rollbackCommand = "./src/sh/rollback_latest_deployment.sh ";
        if (action) {
            rollbackCommand += action + " " + appName;
        } else {
            rollbackCommand += appName;
        }
        this.appContext.log("exec-ing: " + rollbackCommand);
        let err, syncRes;
        [err, syncRes] = await to(this.execCommand(rollbackCommand));
        if (err) {
            const errString = this.buildErrString(rollbackCommand, err.stderr);
            return await this.respondWithError(errString);
        }
        let res = "";
        if (!action) {
            res += "Rollback Successful!";
        }
        res += `
\`\`\`
${syncRes.stdout}
\`\`\`
`;
        await ArgoBot.respondWithComment(this.appContext, res);
     }

    private async handleInfo(appName) {
        const command = "./src/sh/view_app_info.sh " + appName;
        this.appContext.log("exec-ing: " + command);
        let err, syncRes;
        [err, syncRes] = await to(this.execCommand(command));
        if (err) {
            const errString = this.buildErrString(command, err.stderr);
            return await this.respondWithError(errString);
        }
        const res = `
\`${appName}\` set-up info:
\`\`\`
${syncRes.stdout}
\`\`\`
`;
        await ArgoBot.respondWithComment(this.appContext, res);
    }

    private async handleSync(appName) {
        await ArgoBot.setSyncStatusCheck(this.appContext, "pending");

        const prNumber = this.appContext.payload.issue.number;
        const curBranch = await ArgoBot.getCurrentBranch(this.appContext, prNumber);
        const syncCommand = "./src/sh/sync_current_branch.sh " + appName + " " + curBranch;
        this.appContext.log("exec-ing: " + syncCommand);
        let err, syncRes;
        [err, syncRes] = await to(this.execCommand(syncCommand));
        if (err) {
            await ArgoBot.setSyncStatusCheck(this.appContext, "failure");
            const errString = this.buildErrString(syncCommand, err.stderr);
            return await this.respondWithError(errString);
        }
        const res = `
Sync Success!
\`\`\`
${syncRes.stdout}
\`\`\`
`;
        await ArgoBot.setSyncStatusCheck(this.appContext, "success");
        await ArgoBot.respondWithComment(this.appContext, res);
    }

    private async handleDiff(jsonArgoCDApps) {
        const cloneUrl = "https://" + this.argoConfig.getGithubToken() + ":x-oauth-basic@" + this.argoConfig.getGithubRepo();
        const prNumber = this.appContext.payload.issue.number;
        const curBranch = await ArgoBot.getCurrentBranch(this.appContext, prNumber);
        const repoDir = "cloned_repos/pr_" + prNumber;

        const cloneCommand = "./src/sh/clone_repo.sh " + repoDir + " " + cloneUrl + " " + curBranch;
        this.appContext.log("exec-ing: " + cloneCommand);
        // clone repo and check out current branch
        let err, cloneRes;
        [err, cloneRes] = await to(this.execCommand(cloneCommand));
        if (err) {
            const errString = this.buildErrString("git clone and checkout of " + curBranch, err.stderr);
            this.appContext.log.error(errString);
            await ArgoBot.setDiffStatusCheck(this.appContext, "failure");
            return await this.respondWithError(errString);
        }

        // if JSON response is empty that means we received an error querying the API
        if (Object.entries(jsonArgoCDApps).length === 0) {
            await ArgoBot.setDiffStatusCheck(this.appContext, "failure");
            return await this.respondWithError("Empty JSON reponse, make sure the argocd API is reachable and the JWT token is valid");
        }

        // Otherwise if "items" is empty that means our filter did not find any deployments, for example if user specifies an empty directory using 'argo diff --dir somedir'
        if (Object.entries(jsonArgoCDApps["items"]).length === 0) {
            await ArgoBot.setDiffStatusCheck(this.appContext, "failure");
            return await this.respondWithError("No Kubernetes deployments found, try running \`argo diff --all\`");
        }

        const jsonItems = jsonArgoCDApps["items"];
        let foundDiffs = false;
        // for each app in the ArgoCD Server, attempt to diff with current directory in repo
        for (const key of Object.keys(jsonItems)) {
            const appName = jsonItems[key]["metadata"]["name"];
            const gitPath = jsonItems[key]["spec"]["source"]["path"];
            const command = "./src/sh/diff_repo.sh " + repoDir + " " + appName + " " + gitPath;
            const failingExitCodeForDiff = 2;
            this.appContext.log("exec-ing: " + command);
            let diffErr, res;
            [diffErr, res] = await to(this.execCommand(command, failingExitCodeForDiff));
            if (diffErr) {
                const errString = this.buildErrString(command, diffErr.stderr);
                await ArgoBot.setDiffStatusCheck(this.appContext, "failure");
                return await this.respondWithError(errString);
            }
            if (res.stdout === "") {
                // found an empty diff skip
                continue;
            }
            this.appContext.log("Found diff for app=", appName);
            foundDiffs = true;
            const response = `Found diff for app: \`${appName}\`
\`\`\`diff
${res.stdout}
\`\`\`
Run \`argo sync ${appName}\` to apply these changes.
`;
            await ArgoBot.respondWithComment(this.appContext, response);
        }
        await ArgoBot.setDiffStatusCheck(this.appContext, "success");
        if (foundDiffs) {
            const response = `
If Auto-sync is enabled just merge this PR to deploy the above changes (to view if auto-sync is enabled run \`argo info [app name]\` and check the \`Sync Policy\` field)
Otherwise, manual deployments can be done via \`argo sync\`, and rollbacks via \`argo rollback\` for usage, see \`argo help\`.
`;
            await ArgoBot.respondWithComment(this.appContext, response);
        } else {
            const response = "No diffs found!";
            await ArgoBot.respondWithComment(this.appContext, response);
        }
    }
}
