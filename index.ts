import { Application } from 'probot';
import * as prHandler from "./src/handle-pr-request";

module.exports = (app: Application) => {
    // issue_comment.created is triggered when someone makes a comment on a PullRequest or an Issue
    app.on(["issue_comment.created"], prHandler.handlePrComment);
    app.on(["pull_request.closed"], prHandler.handlePrClosed);
}
