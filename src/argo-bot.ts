import { PrLock } from "./singleton-pr-lock"

const ArgoAPI = require("./argo-api.ts")
const ArgoBotConfig = require("./argo-bot-config.ts")
const to = require("./to.ts")

// bot command that triggers this bot to wake up
const BotCommand = "argo"

// supported actions, must be prefixed by BotCommand for example 'argo unlock'
const BotActions = Object.freeze({"Unlock":"unlock", "Diff": "diff", "Sync": "sync", "Preview": "preview", "Info": "info", "History": "history", "Rollback": "rollback", "Help":"help"})
// supported diff flags
const BotDiffActions = Object.freeze({"AutoSync": "--auto-sync", "All": "--all", "Dir": "--dir", "DirShort": "-d"})

// help string for actions
var diffHelp = `
by default diffs all deployment files in current branch, against what's deployed on their respective GKE cluster.
Apps must be managed by argocd server.
supported flags:
--auto-sync: diffs all apps with auto sync enabled against yaml files/helm charts on current branch
--dir [dir name] or -d [dir name]: diffs all yaml files/helm charts in a specific directory against what's deployed in GKE
                                   will look in subdirectories i.e 'argo diff -d /abc' will also check attempt to diff all deployments in 'abc' dir
--all: diffs all apps on current branch against what's deployed in GKE (default behavior)`

const BotHelp = Object.freeze({"Unlock": "removes lock held by current PR, allows other PR's to run bot",
                               "Sync": "usage: `sync [app name]`, syncs deployment in GKE cluster with manifests or helm charts using branch in current PR",
                               "History": "[Not yet supported] history [app name], prints deployment history of app",
                               "Info": "usage: 'info [app name]`, view info for a specific app",
                               "Preview": "[Not yet supported] deploy temporary PR",
                               "Rollback": "rollback [action: view or run] [app name], use 'rollback view app' to see latest deployment info, use 'rollback run app' to rollback latest deployment, verify rollback using diff command",
                               "Diff": diffHelp})

module.exports = class ArgoBot {
    // checks if command is valid and can be processed by ArgoBot
    // a valid command looks like so "argo [action]"
    static isBotCommand(command) {
        const arr = command.split(" ")
        if (!arr || arr.length < 2) {
            return false
        }
        else if (arr[0] != BotCommand) {
            return false
        }
        return true
    }

    // responde with comment on current issue in context
    // ArgoBot is triggered for PR comments, so this will create a new comment on the PR
    static async respondWithComment(context, comment) {
        const response = context.issue({body: comment})
        await context.github.issues.createComment(response)
    }

    // gets current branch name for pr with a specific number
    static async getCurrentBranch(context, prNumber) {
        // I couldn't find an API call that filters this properly
        let prs = await context.github.pullRequests.list(context.repo())
        prs = prs["data"]
        for (var key in prs) {
            if (prs[key]["number"] == prNumber) {
                return prs[key]["head"]["ref"]
             }
        }
        context.log.error("pr not found!")
    }

    // ---------------------
    // data members here
    private botCommand
    private appContext
    private argoConfig
    private argoAPI

    // ----------------------
    // non-static functions here

    constructor(appContext) {
        this.botCommand = BotCommand
        this.appContext = appContext
        this.argoConfig = new ArgoBotConfig()
        this.argoAPI = new ArgoAPI(this.appContext, this.argoConfig.getAPIToken(), this.argoConfig.getServerIP())
    }

    // executes argo commands in local shell environment, and returns stdout
    // optional failingExitCode which will return an error, by default exit code = 1 will error
    // this is needed since 'argo diff' returns exit 1 on success when a diff is found
    async execCommand(command, failingExitCode = 1) {
        const exec = require("child_process").exec
        let p = new Promise((done, failed) => {
            exec(command, (err, stdout, stderr) => {
                let res: any = {}
                res.stdout = stdout
                res.stderr = stderr
                if (err && err.code == failingExitCode) {
                    res.err = err
                    failed(res)
                    return
                }
                done(res)
            })
        })
        return await p
    }

    async handleHelpAction() {
        let help = `
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
`
        await ArgoBot.respondWithComment(this.appContext, help)
    }

    // attempts to obtain lock from singleton, returns true if lock was obtained
    async attemptLock() {
        const prTitle = this.appContext.payload.issue.title
        const prNumber = this.appContext.payload.issue.number

        // this is a singleton
        let prLock = new PrLock()
        if (prLock.tryLock(prTitle, prNumber) === false) {
            const lockMessage = prLock.getLockInfo() +  "; is holding the lock, please merge PR or comment with \`" + BotCommand + " unlock\` to release lock"
            await ArgoBot.respondWithComment(this.appContext, lockMessage)
            return false
        }
        return true
    }

    // handles unlock action, which is sent by user to remove lock on current PR
    async handleUnlockAction() {
        const prNumber = this.appContext.payload.issue.number
        let prLock = new PrLock()

        // if user wants to unlock, and lock is held by current PR, unlock
        if (prLock.getPrNumber() == prNumber) {
            this.appContext.log("received unlock request, unlocking...")
            prLock.unlock(prNumber)
            return await ArgoBot.respondWithComment(this.appContext, "Lock has been released!")
        }
        else {
            // notify user to unlock from the PR that owns the lock
            this.appContext.log("received unlock request from the wrong PR")
            const lockMessage = prLock.getLockInfo() +  "; is holding the lock, please comment on that PR to unlock"
            return await ArgoBot.respondWithComment(this.appContext, lockMessage)
        }
    }

    async handleClosedPR() {
        const prNumber = this.appContext.payload.issue.number
        let prLock = new PrLock()
        prLock.unlock(prNumber)
    }

    // handles command sent by user on PR
    async handleCommand(command) {
        if (!ArgoBot.isBotCommand(command)) {
            this.appContext.log.error("received non-bot command:" + command)
            return
        }
        const arr = command.split(" ")
        const action = arr[1]

        const prNumber = this.appContext.payload.issue.number
        this.appContext.log("received command=" + command + ", for PR#" + prNumber)

        if (action === BotActions.Help) {
            return await this.handleHelpAction()
        }

        // if action is an unlock request, process it here and return
        if (action === BotActions.Unlock) {
            return await this.handleUnlockAction()
        }

        // otherwise user is trying to run a command, attempt to obtain lock
        const lockRes = await this.attemptLock()
        if (lockRes === false) {
            return
        }
        
        if (action == BotActions.Info) {
            if (arr[2]) {
                return await this.handleInfo(arr[2])
            }
        }

        if (action == BotActions.Rollback) {
            if (arr[2] && arr[3]) {
                return await this.handleRollback(arr[2], arr[3])
            }
        }

        if (action == BotActions.Sync) {
            this.appContext.log("Received sync, processing; command:", arr)
            if (arr[2]) {
                return await this.handleSync(arr[2])
            }
        }

        if (action == BotActions.Diff) {
            // valid argo action, try executing command in shell
            this.appContext.log("Received diff, processing; command:", arr)
            let jsonResponse = {}
            if (arr[2] && arr[2] === BotDiffActions.AutoSync) {
                this.appContext.log("Received diff command with" + BotDiffActions.AutoSync)
                jsonResponse = await this.argoAPI.fetchAllAutoSyncApps()
                return await this.handleDiff(jsonResponse)
            }
            else if (arr[2] && (arr[2] === BotDiffActions.Dir || arr[2] === BotDiffActions.DirShort) && arr[3]) {
                this.appContext.log("Received diff command with" + BotDiffActions.Dir)
                jsonResponse = await this.argoAPI.fetchAppsWithDirectory(arr[3])
                return await this.handleDiff(jsonResponse)
            }
            // if arr[2] is not empty, then it's not a valid diff arg, notify user
            else if (arr[2]) {
                this.appContext.log("Received unsupported diff command")
                const args = arr.toString()
                let help = `
Received command:
\`\`\`
${args}
\`\`\`
This is an unsupported \`diff\` command. Supported commands are:
\`\`\`
${BotActions.Diff}: ${BotHelp.Diff}
\`\`\`
`
                return await ArgoBot.respondWithComment(this.appContext, help)
            }
            else {
                this.appContext.log("Received diff command, using default behavior")
                jsonResponse = await this.argoAPI.fetchAllApplications()
                return await this.handleDiff(jsonResponse)
            }
        }

        // Invalid command, print help text
        await ArgoBot.respondWithComment(this.appContext, "Invalid command; received command: `" + command + "`")
        await this.handleHelpAction()
    }

    async respondWithError(error) {
        this.appContext.log.error(error)
        await ArgoBot.respondWithComment(this.appContext, error)
    }

    buildErrString(command, stderr) {
        const errString = `
\`${command}\` returned an error:
\`\`\`
${stderr}
\`\`\`
`
        return errString
    }

    async handleRollback(action, appName) {
        const rollbackCommand = "./src/sh/rollback_latest_deployment.sh " + action + " " + appName
        this.appContext.log("exec-ing: " + rollbackCommand)
        let err, syncRes 
        [err, syncRes] = await to(this.execCommand(rollbackCommand))
        if (err) {
            const errString = this.buildErrString(rollbackCommand, err.stderr)
            return await this.respondWithError(errString)
        }
        let res = ""
        if (action == "view") {
            res += "A rollback will revert this latest change:"
        }
        else if (action == "run") {
            res += "Rollback Successful!"
        }
        res += `
\`\`\`
${syncRes.stdout}
\`\`\`
`
        await ArgoBot.respondWithComment(this.appContext, res)
     }

    async handleInfo(appName) {
        const command = "./src/sh/view_app_info.sh " + appName
        this.appContext.log("exec-ing: " + command)
        let err, syncRes 
        [err, syncRes] = await to(this.execCommand(command))
        if (err) {
            const errString = this.buildErrString(command, err.stderr)
            return await this.respondWithError(errString)
        }
        const res = `
\`${appName}\` set-up info:
\`\`\`
${syncRes.stdout}
\`\`\`
`
        await ArgoBot.respondWithComment(this.appContext, res)
    }

    async handleSync(appName) {
        const prNumber = this.appContext.payload.issue.number
        const curBranch = await ArgoBot.getCurrentBranch(this.appContext, prNumber)
        const syncCommand = "./src/sh/sync_current_branch.sh " + appName + " " + curBranch
        this.appContext.log("exec-ing: " + syncCommand)
        let err, syncRes 
        [err, syncRes] = await to(this.execCommand(syncCommand))
        if (err) {
            const errString = this.buildErrString(syncCommand, err.stderr)
            return await this.respondWithError(errString)
        }
        const res = `
Sync Success!
\`\`\`
${syncRes.stdout}
\`\`\`
`
        await ArgoBot.respondWithComment(this.appContext, res)
    }

    async handleDiff(jsonArgoCDApps) {
        const cloneUrl = "https://" + this.argoConfig.getGithubToken() + ":x-oauth-basic@" + this.argoConfig.getGithubRepo()
        const prNumber = this.appContext.payload.issue.number
        const curBranch = await ArgoBot.getCurrentBranch(this.appContext, prNumber)
        const repoDir = "cloned_repos/pr_" + prNumber

        const cloneCommand = "./src/sh/clone_repo.sh " + repoDir + " " + cloneUrl + " " + curBranch
        this.appContext.log("exec-ing: " + cloneCommand)
        // clone repo and check out current branch
        let err, cloneRes
        [err, cloneRes] = await to(this.execCommand(cloneCommand))
        if (err) {
            this.appContext.log.error("exec returned an error: ```" + err.stderr + "```")
        }

        // if JSON response is empty that means we received an error querying the API
        if (Object.entries(jsonArgoCDApps).length === 0) {
            return await this.respondWithError("Empty JSON reponse, make sure the argocd API is reachable and the JWT token is valid")
        }

        // Otherwise if "items" is empty that means our filter did not find any deployments, for example if user specifies an empty directory using 'argo diff --dir somedir'
        if (Object.entries(jsonArgoCDApps["items"]).length === 0) {
            return await this.respondWithError("No Kubernetes deployments found, try running \`argo diff --all\`")
        }

        const jsonItems = jsonArgoCDApps["items"].filter((item) => item["spec"]["source"]["repoURL"].indexOf(this.argoConfig.getGithubRepo()) > -1);
        let foundDiffs = false
        // for each app in the ArgoCD Server, attempt to diff with current directory in repo
        for (var key in jsonItems) {
            let appName = jsonItems[key]["metadata"]["name"]
            let gitPath = jsonItems[key]["spec"]["source"]["path"]
            const command = "./src/sh/diff_repo.sh " + repoDir + " " + appName + " " + gitPath
            const failingExitCodeForDiff = 2
            this.appContext.log("exec-ing: " + command)
            let err, res
            [err, res] = await to(this.execCommand(command, failingExitCodeForDiff))
            if (err) {
                const errString = this.buildErrString(command, err.stderr)
                return await this.respondWithError(errString)
            }
            if (res.stdout === "") {
                // found an empty diff skip
                continue
            }
            this.appContext.log("Found diff for app=", appName)
            foundDiffs = true
            const response = `Found diff for app: \`${appName}\`
\`\`\`diff
${res.stdout}  
\`\`\`
`
            await ArgoBot.respondWithComment(this.appContext, response)
        }
        if (foundDiffs) {
            const response = `
If Auto-sync is enabled just merge this PR to deploy the above changes (to view if auto-sync is enabled run \`argo info [app name]\` and check the 'Sync Policy' field)
Otherwise, manual deployments can be done via \`argo sync\`, and rollbacks via \`argo rollback\` for usage see \`argo help\`.
`
            await ArgoBot.respondWithComment(this.appContext, response)
        }
        else {
            const response = "No diffs found!"
            await ArgoBot.respondWithComment(this.appContext, response)
        }
     }
}
