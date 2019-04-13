module.exports = {
    handlePrComment,
    handlePrClosed,
}

const getConfig = require("probot-config")
const ArgoBot = require("./argo-bot")
import { PrLock } from "./singleton-pr-lock"

// TODO use yaml file instead of node env in the future
/*const CONFIG_FILE = "argocd-bot.yaml"
const DEFAULT_CONFIG = {
  reposDir: "repos"
}*/

async function handlePrClosed(context, config) {
    const prNumber = context.payload.pull_request.number

    context.log("handlePrClosed, pr#" + prNumber)

    let lock = new PrLock()
    let unlockStatus = lock.unlock(prNumber)
    context.log("handlePrClosed, unlockStatus=" + unlockStatus)
}

async function handlePrComment(context, config) {
    const prComment = context.payload.comment.body
    const prNumber = context.payload.issue.number

    context.log("handlePrComment, pr#" + prNumber)
    if (!ArgoBot.isBotCommand(prComment)) {
        context.log("Recieved a non-bot command=" + prComment + "; ignoring!")
        return
    }

    const repo = context.payload.repository
    let bot = new ArgoBot(context)
    await bot.handleCommand(prComment)
}
