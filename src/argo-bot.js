// list of supported bot commands
// for example if user comments on PR with 'argo diff', bot execs -> helper script which runs 'argocd diff --local'
const BOT_COMMAND = "argo"
const BOT_ACTIONS = {
    "diff": "./sh/clone_and_diff.sh"
}

module.exports = class ArgoBot {

    constructor(appContext, repo) {
        this.botCommand = BOT_COMMAND
        this.actions = BOT_ACTIONS
        this.appContext = appContext
        this.repo = repo
    }

    // a valid command looks like so 'argo [action]'
    static isBotCommand(command) {
        const arr = command.split(' ')
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
        const { promisify } = require('util');
        const exec = promisify(require('child_process').exec)
        return await exec(command)
    }

    handleCommand(command) {
        if (!ArgoBot.isBotCommand(command)) {
            return
        }
        const arr = command.split(' ')
        const action = arr[1]

        const execAction = this.actions[action]
        if (!execAction) {
            this.appContext.log('invalid action, recieved action=' + execAction)
            return
        }
        // valid argo action, try executing command in shell
        this.appContext.log('received valid execAction=' + execAction)
        try { 
            // exec helper script, and send all stdout as a new comment on the PR
            let res = this.execArgoCommand(execAction).then(res => {
                // comment back on PR with stdout
                // wrap with backticks for code block formatting
                const commentData = '```' + res.stdout + '```'
                const response = this.appContext.issue({body: commentData})
                this.appContext.github.issues.createComment(response)
            })
        } catch(error) {
            this.appContext.err(error)
        }
        this.appContext.log('done!')
    }
}
