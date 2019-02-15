const handlePrRequest = require('./src/handle-pr-request')

module.exports = app => {
    // issue_comment.created is triggered when someone makes a comment on a PullRequest or an Issue
    app.on(['issue_comment.created'], handlePrRequest)
}
