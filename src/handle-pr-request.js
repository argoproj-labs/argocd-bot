module.exports  = handlePrRequest

const getConfig = require('probot-config')
const ArgoBot = require('./argo-bot')

const DEFAULT_CONFIG = {
  reposDir: 'repos'
}


async function handlePrRequest(context, config) {
    const prComment = context.payload.comment.body
    const prTitle = context.payload.issue.title
    const prAuthor = context.payload.issue.user.login
    const pr = context.payload.issue.pull_request
    const prCommentAuthor = context.payload.comment.user.login

    // TODO properly use this
    // const { reposDir } = await getConfig(context, 'argo-bot.yml', DEFAULT_OPTS)
    if (!ArgoBot.isBotCommand(prComment)) {
        context.log('Recieved a non-bot command=' + prComment + '; ignoring!')
        return
    }

    const repo = context.payload.repository
    let bot = new ArgoBot(context, repo)
    bot.handleCommand(prComment)
}
