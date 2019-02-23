const fetch = require("node-fetch")

module.exports = class ArgocdAPI {

    constructor(appContext, token, serverIP) {
        this.token = token
        this.serverIP = serverIP
        this.fetchFilter = "items.metadata.name,items.spec.source.path,items.spec.source.repoURL"
    }

    async fetchAllApplications() {
        const url = "https://" + this.serverIP + "/api/v1/applications?fields=" + this.fetchFilter
        const response = await fetch(url, { method: "GET", headers: { "Cookie": "argocd.token=" + this.token } })
        const responseJson = await response.json()
        return responseJson
    }
}
