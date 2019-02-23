const PrLock = require("./singleton-pr-lock.js")
const ArgoAPI = require("./argo-api.js")
const ArgoBotConfig = require("./argo-bot-config.js")

// bot command that triggers this bot to wake up
const BOT_COMMAND = "argo"

// supported commands, for example 'argo unlock'
// TODO make these into an enum/properly encapsulate in an object
const UNLOCK_COMMAND = "unlock"
const DIFF_COMMAND = "diff"

module.exports = class ArgoBot {
    // checks if command is valid and can be processed by ArgoBot
    // a valid command looks like so "argo [action]"
    static isBotCommand(command) {
        const arr = command.split(" ")
        if (!arr || arr.length != 2) {
            return false
        }
        else if (arr[0] != BOT_COMMAND) {
            return false
        }
        return true
    }

    // responde with comment on current issue in context
    // ArgoBot is triggered for PR comments, so this will create a new comment on the PR
    static respondWithComment(context, comment) {
        const response = context.issue({body: comment})
        context.github.issues.createComment(response)
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

    // ----------------------
    // non-static functions here

    constructor(appContext) {
        this.botCommand = BOT_COMMAND
        this.appContext = appContext
        this.argoConfig = new ArgoBotConfig()
        this.argoAPI = new ArgoAPI(this.appContext, this.argoConfig.getAPIToken(), this.argoConfig.getServerIP())
    }

    // executes argo commands in local shell environment, and returns stdout
    async execCommand(command) {
        const { promisify } = require("util");
        const exec = promisify(require("child_process").exec)
        return await exec(command)
    }

    // attempts to obtain lock from singleton, returns true if lock was obtained
    attemptLock() {
        const prTitle = this.appContext.payload.issue.title
        const prNumber = this.appContext.payload.issue.number

        // this is a singleton
        let prLock = new PrLock()
        if (prLock.tryLock(prTitle, prNumber) === false) {
            const lockMessage = prLock.getLockInfo() +  "; is holding the lock, please merge PR or comment with \`" + BOT_COMMAND + " unlock\` to release lock"
            ArgoBot.respondWithComment(this.appContext, lockMessage)
            return false
        }
        return true
    }

    // handles unlock action, which is sent by user to remove lock on current PR
    handleUnlockAction() {
        const prNumber = this.appContext.payload.issue.number
        let prLock = new PrLock()

        // if user wants to unlock, and lock is held by current PR, unlock
        if (prLock.getPrNumber() == prNumber) {
            this.appContext.log("received unlock request, unlocking...")
            prLock.unlock(prNumber)
            return ArgoBot.respondWithComment(this.appContext, "Lock has been released!")
        }
        else {
            // notify user to unlock from the PR that owns the lock
            this.appContext.log("received unlock request from the wrong PR")
            const lockMessage = prLock.getLockInfo() +  "; is holding the lock, please comment on that PR to unlock"
            return ArgoBot.respondWithComment(this.appContext, lockMessage)
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
            return
        }
        const arr = command.split(" ")
        const action = arr[1]

        const prNumber = this.appContext.payload.issue.number
        this.appContext.log("received command=" + command + ", for PR#" + prNumber)

        // if action is an unlock request, process it here and return
        if (action === UNLOCK_COMMAND) {
            return this.handleUnlockAction()
        }

        // otherwise user is trying to run a command, attempt to obtain lock
        if (this.attemptLock() === false) {
            return
        }
        
        if (action == DIFF_COMMAND) {
            // valid argo action, try executing command in shell
            this.appContext.log("handling diff!")
            this.handleDiff(this.argoAPI)
            this.appContext.log("done!")
        }
        else {
            // TODO print helpful output
            ArgoBot.respondWithComment(this.appContext, "Invalid command")
        }

    }

    async handleDiff(argoAPI) {
        const cloneUrl = "https://" + this.argoConfig.getGithubToken() + ":x-oauth-basic@" + this.argoConfig.getGithubRepo()
        const prNumber = this.appContext.payload.issue.number
        const curBranch = await ArgoBot.getCurrentBranch(this.appContext, prNumber)
        const repoDir = "cloned_repos/pr_" + prNumber

        // clone repo and check out current branch
        await this.execCommand("./src/sh/clone_repo.sh " + repoDir + " " + cloneUrl + " " + curBranch)

        const jsonResponse = await argoAPI.fetchAllApplications()
        const jsonItems = jsonResponse["items"]
        // for each app in the ArgoCD Server, attempt to diff with current directory in repo
        for (var key in jsonItems) {
            let appName = jsonItems[key]["metadata"]["name"]
            let gitPath = jsonItems[key]["spec"]["source"]["path"]
            this.appContext.log(appName)
            this.appContext.log(gitPath)
            const res = await this.execCommand("./src/sh/diff_repo.sh " + repoDir + " " + appName + " " + gitPath)
            const response = `Found diff: 
\`\`\`  
${res.stdout}  
\`\`\`
Please merge your PR to apply changes
`

            ArgoBot.respondWithComment(this.appContext, response)
        }
     }
}
