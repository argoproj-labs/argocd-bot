const nock = require("nock")
const sinon = require("sinon")
const { Probot } = require("probot")

const ArgocdBot = require("..")

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

        // node env variables
        process.env.ARGOCD_AUTH_TOKEN = argoCDToken
        process.env.ARGOCD_SERVER = argoCDServer
    })

    afterEach(() => {
        sandbox.restore()
    })

    test("diff comment posted on PR, one app in argocd server", async() => {
        nock("https://api.github.com")
            .post("/app/installations/2/access_tokens")
            .reply(200, {token: "test"})

        // test constants
        const branch = "newBranch"
        const appDiff = "===== App Diff ===="
        const appName = "app1"
        const appDir = "projects/app1"

        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, {"data": {"number": 109, "head": { "ref": branch}}})

        const child_process = require("child_process")
        const execStub = sandbox.stub(child_process, "exec")
        // first exec, will fork script to clone repo
        execStub.onCall(0).yields(false)
        // second will be diff exec
        execStub.onCall(1).yields(false, appDiff, "")

        nock("http://" + argoCDServer).get("/api/v1/applications?fields=items.metadata.name,items.spec.source.path,items.spec.source.repoURL")
            .reply(200, {"items": [{"metadata": { "name": appName }, "spec": { "source": { "path": appDir } } }] })
        // regex match post body should match diff produced by API
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /===== App Diff ====/).reply(200)
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /If Auto-sync is enabled just merge this PR to deploy the above changes/).reply(200)

        await probot.receive({name: "issue_comment", payload: payloadPr1})
    })

    test("diff comment posted on PR, one app in argocd server error in diff", async() => {
        nock("https://api.github.com")
            .post("/app/installations/2/access_tokens")
            .reply(200, {token: "test"})

        // test constants
        const branch = "newBranch"
        const appDiff = "===== App Diff ===="
        const appName = "app1"
        const appDir = "projects/app1"

        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, {"data": {"number": 109, "head": { "ref": branch}}})

        const child_process = require("child_process")
        const execStub = sandbox.stub(child_process, "exec")
        // first exec, will fork script to clone repo
        execStub.onCall(0).yields(false)

        nock("http://" + argoCDServer).get("/api/v1/applications?fields=items.metadata.name,items.spec.source.path,items.spec.source.repoURL")
            .reply(200, {"items": [{"metadata": { "name": appName }, "spec": { "source": { "path": appDir } } }] })
        execStub.onCall(1).yields({code: 2}, "", "stderr")

        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /returned an error/).reply(200)
        await probot.receive({name: "issue_comment", payload: payloadPr1})
    })

    test("diff comment posted on PR with non-existent --dir", async() => {
        nock("https://api.github.com")
            .post("/app/installations/2/access_tokens")
            .reply(200, {token: "test"})

        // test constants
        const branch = "newBranch"
        const appDiff = "===== App Diff ===="
        const appName = "app1"
        const appDir = "projects/app1"

        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, {"data": {"number": 109, "head": { "ref": branch}}})

        const child_process = require("child_process")
        const execStub = sandbox.stub(child_process, "exec")
        // first exec, will fork script to clone repo
        execStub.onCall(0).yields(false)

        nock("http://" + argoCDServer).get("/api/v1/applications?fields=items.metadata.name,items.spec.source.path,items.spec.source.repoURL")
            .reply(200, {"items": [{"metadata": { "name": appName }, "spec": { "source": { "path": appDir } } }, {"metadata": { "name": appName + "2" }, "spec": { "source": { "path": appDir + "2"} } }] })
        execStub.onCall(1).yields(false, appDiff)

        // regex match post body should match diff produced by API
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /No Kubernetes deployments found, try running/).reply(200)

        let diffPayload = JSON.parse(JSON.stringify(payloadPr1))
        diffPayload["comment"]["body"] = "argo diff --dir ./non-existent"
        await probot.receive({name: "issue_comment", payload: diffPayload})
    })

    test("diff comment posted on PR with --dir flag", async() => {
        nock("https://api.github.com")
            .post("/app/installations/2/access_tokens")
            .reply(200, {token: "test"})

        // test constants
        const branch = "newBranch"
        const appDiff = "===== App Diff ===="
        const appName = "app1"
        const appDir = "projects/app1"

        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, {"data": {"number": 109, "head": { "ref": branch}}})

        const child_process = require("child_process")
        const execStub = sandbox.stub(child_process, "exec")
        // first exec, will fork script to clone repo
        execStub.onCall(0).yields(false)

        nock("http://" + argoCDServer).get("/api/v1/applications?fields=items.metadata.name,items.spec.source.path,items.spec.source.repoURL")
            .reply(200, {"items": [{"metadata": { "name": appName }, "spec": { "source": { "path": appDir } } }, {"metadata": { "name": appName + "2" }, "spec": { "source": { "path": "randomDir"} } }] })
        execStub.onCall(1).yields(false, appDiff)

        // regex match post body should match diff produced by API
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /===== App Diff ====/).reply(200)
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /If Auto-sync is enabled just merge this PR to deploy the above changes/).reply(200)

        let diffPayload = JSON.parse(JSON.stringify(payloadPr1))
        diffPayload["comment"]["body"] = "argo diff --dir " + appDir
        await probot.receive({name: "issue_comment", payload: diffPayload})
    })

    // same test as above, but using -d instead of --dir
    test("diff comment posted on PR with -d flag", async() => {
        nock("https://api.github.com")
            .post("/app/installations/2/access_tokens")
            .reply(200, {token: "test"})

        // test constants
        const branch = "newBranch"
        const appDiff = "===== App Diff ===="
        const appName = "app1"
        const appDir = "projects/app1"

        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, {"data": {"number": 109, "head": { "ref": branch}}})

        const child_process = require("child_process")
        const execStub = sandbox.stub(child_process, "exec")
        // first exec, will fork script to clone repo
        execStub.onCall(0).yields(false)

        nock("http://" + argoCDServer).get("/api/v1/applications?fields=items.metadata.name,items.spec.source.path,items.spec.source.repoURL")
            .reply(200, {"items": [{"metadata": { "name": appName }, "spec": { "source": { "path": appDir } } }, {"metadata": { "name": appName + "2" }, "spec": { "source": { "path": "randomdir"} } }] })
        execStub.onCall(1).yields(false, appDiff)

        // regex match post body should match diff produced by API
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /===== App Diff ====/).reply(200)
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /If Auto-sync is enabled just merge this PR to deploy the above changes/).reply(200)

        let diffPayload = JSON.parse(JSON.stringify(payloadPr1))
        diffPayload["comment"]["body"] = "argo diff -d " + appDir
        await probot.receive({name: "issue_comment", payload: diffPayload})
    })

    test("diff comment posted on PR, two apps in argocd server, one app has diff", async() => {
        nock("https://api.github.com")
            .post("/app/installations/2/access_tokens")
            .reply(200, {token: "test"})

        // test constants
        const branch = "newBranch"
        const appDiff = "===== App Diff ===="
        const appName = "app1"
        const appDir = "projects/app1"

        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, {"data": {"number": 109, "head": { "ref": branch}}})

        const child_process = require("child_process")
        const execStub = sandbox.stub(child_process, "exec")
        // first exec, will fork script to clone repo
        execStub.onCall(0).yields(false)

        nock("http://" + argoCDServer).get("/api/v1/applications?fields=items.metadata.name,items.spec.source.path,items.spec.source.repoURL")
            .reply(200, {"items": [{"metadata": { "name": appName }, "spec": { "source": { "path": appDir } } }, {"metadata": { "name": appName + "2" }, "spec": { "source": { "path": appDir + "2"} } }] })
        // exec calls to argocd app diff, return diff for both one app
        execStub.onCall(1).yields(false, appDiff)
        // second call returns an empty diff in stdout
        execStub.onCall(2).yields(false, "")
        // regex match post body should match diff produced by API
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /===== App Diff ====/).reply(200)
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /If Auto-sync is enabled just merge this PR to deploy the above changes/).reply(200)

        await probot.receive({name: "issue_comment", payload: payloadPr1})
    })

    test("diff comment posted on PR, two apps in argocd server", async() => {
        nock("https://api.github.com")
            .post("/app/installations/2/access_tokens")
            .reply(200, {token: "test"})

        // test constants
        const branch = "newBranch"
        const appDiff = "===== App Diff ===="
        const appName = "app1"
        const appDir = "projects/app1"

        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, {"data": {"number": 109, "head": { "ref": branch}}})

        const child_process = require("child_process")
        const execStub = sandbox.stub(child_process, "exec")
        // first exec, will fork script to clone repo
        execStub.onCall(0).yields(false)

        nock("http://" + argoCDServer).get("/api/v1/applications?fields=items.metadata.name,items.spec.source.path,items.spec.source.repoURL")
            .reply(200, {"items": [{"metadata": { "name": appName }, "spec": { "source": { "path": appDir } } }, {"metadata": { "name": appName + "2" }, "spec": { "source": { "path": appDir + "2"} } }] })
        // exec calls to argocd app diff, return diff for both apps
        execStub.onCall(1).yields(false, appDiff)
        execStub.onCall(2).yields(false, appDiff)
        // regex match post body should match diff produced by API
        // since there are two apps with diffs, bot will produce a comment for each app diff
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /===== App Diff ====/).reply(200)
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /If Auto-sync is enabled just merge this PR to deploy the above changes/).reply(200)

        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /===== App Diff ====/).reply(200)
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /If Auto-sync is enabled just merge this PR to deploy the above changes/).reply(200)

        await probot.receive({name: "issue_comment", payload: payloadPr1})
    })

    test("diff --auto-sync comment posted on PR", async() => {
        nock("https://api.github.com")
            .post("/app/installations/2/access_tokens")
            .reply(200, {token: "test"})

        // test constants
        const branch = "newBranch"
        const appDiff = "===== App Diff ===="
        const appName = "app1"
        const appDir = "projects/app1"

        nock("https://api.github.com").get("/repos/robotland/test/pulls").reply(200, {"data": {"number": 109, "head": { "ref": branch}}})

        const child_process = require("child_process")
        const execStub = sandbox.stub(child_process, "exec")
        // first exec, will fork script to clone repo
        execStub.onCall(0).yields(false)

        nock("http://" + argoCDServer).get("/api/v1/applications?fields=items.metadata.name,items.spec.source.path,items.spec.source.repoURL,items.spec.syncPolicy.automated")
            .reply(200, {"items": [{"metadata": { "name": appName }, "spec": { "source": { "path": appDir } } }, 
                {"metadata":{"name":"atlantis"},"spec":{"source": { "path": appDir }, "syncPolicy":{"automated":{}}}}] })

        execStub.onCall(1).yields(false, appDiff)
        // regex match post body should match diff produced by API
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /===== App Diff ====/).reply(200)
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /If Auto-sync is enabled just merge this PR to deploy the above changes/).reply(200)

        // copy json object
        let autoSyncPayload = JSON.parse(JSON.stringify(payloadPr1))
        autoSyncPayload["comment"]["body"] = "argo diff --auto-sync"

        await probot.receive({name: "issue_comment", payload: autoSyncPayload})
    })
})
