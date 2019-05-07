import * as nodeFetch from "node-fetch";

export class ArgoAPI {

    private context;
    private token;
    private serverIP;
    private fetchAllAppsFilter;
    private fetchAutoSyncAppsFilter;

    constructor(appContext, token, serverIP) {
        this.context = appContext;
        this.token = token;
        this.serverIP = serverIP;
        this.fetchAllAppsFilter = "items.metadata.name,items.spec.source.path,items.spec.source.repoURL";
        this.fetchAutoSyncAppsFilter = this.fetchAllAppsFilter + ",items.spec.syncPolicy.automated";
    }

    public async fetchHttp(url, token) {
        const response = await nodeFetch(url, { method: "GET", headers: { Cookie: "argocd.token=" + this.token } });
        const responseStatus = response.status;
        if (responseStatus !== 200) {
            this.context.log.info(url, "; received non-200 status=", responseStatus);
            return {};
        }
        return await response.json();
    }

    public async fetchAllAutoSyncApps() {
        const url = "http://" + this.serverIP + "/api/v1/applications?fields=" + this.fetchAutoSyncAppsFilter;
        const responseJson = await this.fetchHttp(url, this.token);

        if (Object.keys(responseJson).length === 0 || !("items" in responseJson)) {
            return responseJson;
        }

        const jsonItems = responseJson["items"];
        // filter out applications that don't have an auto-sync policy;
        for (const key in jsonItems) {
            if (!jsonItems[key]["spec"].hasOwnProperty("syncPolicy") ||
                    !jsonItems[key]["spec"]["syncPolicy"].hasOwnProperty("automated")) {
                delete jsonItems[key];
            }
        }
        return responseJson;
    }

    public async fetchAppsWithDirectory(dir) {
        const url = "http://" + this.serverIP + "/api/v1/applications?fields=" + this.fetchAllAppsFilter;
        const responseJson = await this.fetchHttp(url, this.token);
        const jsonItems = responseJson["items"];

        if (Object.keys(responseJson).length === 0 || !("items" in responseJson)) {
            return responseJson;
        }

        // filter out applications that don't have an auto-sync policy
        for (const key of Object.keys(jsonItems)) {
            const valid = ("spec" in jsonItems[key] && "source" in jsonItems[key]["spec"] && "path" in jsonItems[key]["spec"]["source"]);
            if (!valid) {
                continue;
            }
            const gitPath = jsonItems[key]["spec"]["source"]["path"];
            if (!gitPath.includes(dir)) {
                delete jsonItems[key];
            }
        }
        return responseJson;
     }

    private async fetchAllApplications() {
        const url = "http://" + this.serverIP + "/api/v1/applications?fields=" + this.fetchAllAppsFilter;
        const responseJson = await this.fetchHttp(url, this.token);
        return responseJson;
    }
}
