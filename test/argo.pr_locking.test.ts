import * as sinon from "sinon"
import * as nock from "nock"
import { Probot } from "probot"

const ArgocdBot = require("..")
import { PrLock } from "../src/singleton-pr-lock"

// test fixtures
const payloadPr1 = require("./fixtures/issue_comment.created.pr1.json")
const payloadPr1Closed = require("./fixtures/pull_request.closed.pr1.json")
const payloadPr1UnlockComment = require("./fixtures/issue_comment.created.unlock.pr1.json")
const payloadPr2 = require("./fixtures/issue_comment.created.pr2.json")

nock.disableNetConnect()

describe("argo-cd-bot", () => {
    let probot
    let sandbox
    // constants
    const argoCDToken = "token"
    const argoCDServer = "1.2.3.4"
    
    beforeEach(() => {
        probot = new Probot({})
        const app = probot.load(ArgocdBot)
        app.app = () => "test"
        sandbox = sinon.createSandbox();

        // few tests take longer to finish than the default time out of 5000
        jest.setTimeout(7000)

        // node env variables
        process.env.ARGOCD_AUTH_TOKEN = argoCDToken
        process.env.ARGOCD_SERVER = argoCDServer
    })

    afterEach(() => {
        sandbox.restore()
    })

    test("diff comment posted on multiple PR, first PR should hold the lock, preventing the second one from being diff'd", async () => {
        nock("https://api.github.com")
            .post("/app/installations/2/access_tokens")
            .reply(200, {token: "test"})

        // test constants
        const branch = "newBranch"
        const appDiff = "===== App Diff ===="
        const appName = "app1"
        const appDir = "projects/app1"

        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, {"data": {"number": 109, "head": { "ref": branch}}})
        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, {"data": {"number": 109, "head": { "ref": branch, "sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e", "repo": { "id": 1296269, "node_id": "MDEwOlJlcG9zaXRvcnkxMjk2MjY5", "name": "Hello-World",  "full_name": "octocat/Hello-World", "owner": { "login": "octocat" }}}}});
        // bot should post status check on PR
        nock("https://api.github.com").post("/repos/octocat/Hello-World/statuses/6dcb09b5b57875f334f61aebed695e2e4193db5e", /success/).reply(200)


        const child_process = require("child_process")
        const execStub = sandbox.stub(child_process, "exec")
        // first exec, will fork script to clone repo
        execStub.onCall(0).yields(false)

        nock("http://" + argoCDServer).get("/api/v1/applications?fields=items.metadata.name,items.spec.source.path,items.spec.source.repoURL")
            .reply(200, {"items": [{"metadata": { "name": appName }, "spec": { "source": { "path": appDir } } }] })
        // second exec call, will attempt to diff with argoCD server
        execStub.onCall(1).yields(false, appDiff)
        // regex match post body should match diff produced by API
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /===== App Diff ====/).reply(200)
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /If Auto-sync is enabled just merge this PR to deploy the above changes/).reply(200)
        
        // first comment on PR1, should proceed and hold the lock
        await probot.receive({name: "issue_comment", payload: payloadPr1})

        let lock = new PrLock()
        expect(lock.isLocked()).toBe(true)

        // second comment on Pr2, should not proceed as PR1 holds the lock
        nock("https://api.github.com").post("/repos/robotland/test/issues/2/comments", /is holding the lock, please merge PR or comment with `argo unlock` to release lock/).reply(200)
        await probot.receive({name: "issue_comment", payload: payloadPr2})
    })
    
    test("diff comment posted on multiple PR, first PR should hold the lock, and release it when closed", async () => {
        nock("https://api.github.com")
            .post("/app/installations/2/access_tokens")
            .reply(200, {token: "test"})

        // test constants
        const branch = "newBranch"
        const appDiff = "===== App Diff ===="
        const appName = "app1"
        const appDir = "projects/app1"

        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, {"data": {"number": 109, "head": { "ref": branch}}})
        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, {"data": {"number": 109, "head": { "ref": branch, "sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e", "repo": { "id": 1296269, "node_id": "MDEwOlJlcG9zaXRvcnkxMjk2MjY5", "name": "Hello-World",  "full_name": "octocat/Hello-World", "owner": { "login": "octocat" }}}}});
        // bot should post status check on PR
        nock("https://api.github.com").post("/repos/octocat/Hello-World/statuses/6dcb09b5b57875f334f61aebed695e2e4193db5e", /success/).reply(200)


        const child_process = require("child_process")
        const execStub = sandbox.stub(child_process, "exec")
        // first exec, will fork script to clone repo
        execStub.onCall(0).yields(false)

        nock("http://" + argoCDServer).get("/api/v1/applications?fields=items.metadata.name,items.spec.source.path,items.spec.source.repoURL")
            .reply(200, {"items": [{"metadata": { "name": appName }, "spec": { "source": { "path": appDir } } }] })
        // second exec call, will attempt to diff with argoCD server
        execStub.onCall(1).yields(false, appDiff)
        // regex match post body should match diff produced by API
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /===== App Diff ====/).reply(200)
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /If Auto-sync is enabled just merge this PR to deploy the above changes/).reply(200)
       
        // first comment on PR1, should proceed and hold the lock
        await probot.receive({name: "issue_comment", payload: payloadPr1})
        let lock = new PrLock()
        expect(lock.isLocked()).toBe(true)

        // pull_request.closed event should release the lock
        await probot.receive({name: "pull_request", payload: payloadPr1Closed})
        expect(lock.isLocked()).toBe(false)
    })
    
    test("first PR should hold the lock, and release it when unlock is requested", async () => {
        nock("https://api.github.com")
            .post("/app/installations/2/access_tokens")
            .reply(200, {token: "test"})

        // test constants
        const branch = "newBranch"
        const appDiff = "===== App Diff ===="
        const appName = "app1"
        const appDir = "projects/app1"

        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, {"data": {"number": 109, "head": { "ref": branch}}})
        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, {"data": {"number": 109, "head": { "ref": branch, "sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e", "repo": { "id": 1296269, "node_id": "MDEwOlJlcG9zaXRvcnkxMjk2MjY5", "name": "Hello-World",  "full_name": "octocat/Hello-World", "owner": { "login": "octocat" }}}}});
        // bot should post status check on PR
        nock("https://api.github.com").post("/repos/octocat/Hello-World/statuses/6dcb09b5b57875f334f61aebed695e2e4193db5e", /success/).reply(200)


        const child_process = require("child_process")
        const execStub = sandbox.stub(child_process, "exec")
        // first exec, will fork script to clone repo
        execStub.onCall(0).yields(false)

        nock("http://" + argoCDServer).get("/api/v1/applications?fields=items.metadata.name,items.spec.source.path,items.spec.source.repoURL")
            .reply(200, {"items": [{"metadata": { "name": appName }, "spec": { "source": { "path": appDir } } }] })
        // second exec call, will attempt to diff with argoCD server
        execStub.onCall(1).yields(false, appDiff)
        // regex match post body should match diff produced by API
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /===== App Diff ====/).reply(200)
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /If Auto-sync is enabled just merge this PR to deploy the above changes/).reply(200)
       
        // first comment on PR1, should proceed and hold the lock
        await probot.receive({name: "issue_comment", payload: payloadPr1})
        let lock = new PrLock()
        expect(lock.isLocked()).toBe(true)

        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /Lock has been released/).reply(200)
        await probot.receive({name: "issue_comment", payload: payloadPr1UnlockComment})
        expect(lock.isLocked()).toBe(false)
    })
})
