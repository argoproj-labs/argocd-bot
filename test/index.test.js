const nock = require("nock")
const sinon = require("sinon")
const { Probot } = require("probot")
const argocdBot = require("..")
const payload = require("./fixtures/issue_comment.created.json")

nock.disableNetConnect()

describe("argo-cd-bot", () => {
    let probot
    // constants
    const argoCDToken = "token"
    const argoCDServer = "1.2.3.4"
    
    beforeEach(() => {
        probot = new Probot({})
        const app = probot.load(argocdBot)
        app.app = () => "test"

        // node env variables
        process.env.ARGO_CD_API_TOKEN = argoCDToken
        process.env.ARGO_CD_SERVER_IP = argoCDServer
    })

    test("diff comment posted on PR", async() => {
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
        const execStub = sinon.stub(child_process, "exec")
        // first exec, will fork script to clone repo
        execStub.onCall(0).yields(false)

        nock("https://" + argoCDServer).get("/api/v1/applications?fields=items.metadata.name,items.spec.source.path,items.spec.source.repoURL")
            .reply(200, {"items": [{"metadata": { "name": appName }, "spec": { "source": { "path": appDir } } }] })
        execStub.onCall(1).yields(false, {"stdout": appDiff})
        // regex match post body should match diff produced by API
        nock("https://api.github.com").post("/repos/robotland/test/issues/109/comments", /===== App Diff ====/).reply(200)

        await probot.receive({name: "issue_comment", payload})
    })

    /*
  test("diff comment posted on multiple PR, first PR should hold the lock, preventing the second one from being diff\"d", async () => {
    nock("https://api.github.com")
      .post("/app/installations/2/access_tokens")
      .reply(200, {token: "test"})
    
    let sandbox = sinon.createSandbox()
    const child_process = require("child_process")
    sandbox.stub(child_process, "exec").returns({"stdout": "test"})
    await probot.receive({name: "issue_comment", payload})

    await probot.receive({name: "issue_comment", payload})
    sandbox.restore()
  })
  */

})
