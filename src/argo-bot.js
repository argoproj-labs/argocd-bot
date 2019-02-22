const PrLock = require("./singleton-pr-lock.js")

// list of supported bot commands
// for example if user comments on PR with "argo diff", bot execs -> helper script which runs "argocd diff --local"
const BOT_COMMAND = "argo"
const UNLOCK_COMMAND = "unlock"
const BOT_ACTIONS = {
    "diff": "./src/sh/clone_and_diff.sh",
    UNLOCK_COMMAND: UNLOCK_COMMAND
}

module.exports = class ArgoBot {

    constructor(appContext, payload) {
        this.prLock = new PrLock()
        this.botCommand = BOT_COMMAND
        this.actions = BOT_ACTIONS

        this.appContext = appContext
    }

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

    // executes argo commands in local shell environment, and returns stdout
    // throws exception on stderr
    async execArgoCommand(command) {
        const { promisify } = require("util");
        const exec = promisify(require("child_process").exec)
        return await exec(command)
    }

    handleCommand(command) {
        if (!ArgoBot.isBotCommand(command)) {
            return
        }
        const arr = command.split(" ")
        const action = arr[1]

        const execAction = this.actions[action]
        if (!execAction) {
            this.appContext.log("invalid action, received action=" + execAction)
            return
        }
        
        // TODO split lock related checks, to a separate function
        const prNumber = this.appContext.payload.issue.number
        this.appContext.log("received command=" + command ", for PR#" + prNumber)

        // if user wants to unlock, and lock is held by current PR, unlock
        if (execAction === UNLOCK_COMMAND && this.prLock.getPrNumber() == prNumber) {
            this.appContext.log("received unlock request, unlocking...")
            this.prLock.unlock()
            const response = this.appContext.issue({body: "Lock has been removed!"})
            this.appContext.github.issues.createComment(response)
            return
        }

        // notify user to unlock from the PR that owns the lock
        if (execAction === UNLOCK_COMMAND) {
            this.appContext.log("received unlock request from the wrong PR")
            const lockMessage = this.prLock.getLockInfo() +  "; is holding the lock, please comment on that PR to unlock"
            const response = this.appContext.issue({body: lockMessage})
            this.appContext.github.issues.createComment(response)
            return
        }

        const prTitle = this.appContext.payload.issue.title
        // otherwise use is trying to run a command, attempt to lock
        if (this.prLock.tryLock(prTitle, prNumber) === false) {
            const lockMessage = this.prLock.getLockInfo() +  "; is holding the lock, please merge PR or comment with \`" + BOT_COMMAND + " unlock\` to release lock"
            const response = this.appContext.issue({body: lockMessage})
            this.appContext.github.issues.createComment(response)
            return
        }

        // valid argo action, try executing command in shell
        this.appContext.log("received valid execAction=" + execAction)
        // exec helper script, and send all stdout as a new comment on the PR
        this.execArgoCommand(execAction).then(res => {
            // comment back on PR with stdout
            // wrap with backticks for code block formatting
            const commentData = "```" + res.stdout + "```"
            const response = this.appContext.issue({body: commentData})
            this.appContext.github.issues.createComment(response)
        }).catch(error => {
            console.log(error)
            const response = this.appContext.issue({body: "` " + error.toString() + " `"})
            this.appContext.github.issues.createComment(response)
             // this is commented out, so it is clear why the test fails
            // TODO uncomment and fix test
            // this.appContext.err(error)
        })
        this.appContext.log("done!")
    }
}
