// class that holds config params used by bot, for now this is reading from node env variables;
export class ArgoBotConfig {

    private config;

    constructor() {
        this.config = process.env;
    }

    public getAPIToken() {
        return this.config.ARGOCD_AUTH_TOKEN;
    }

    public getServerIP() {
        return this.config.ARGOCD_SERVER;
    }

    public getGithubToken() {
        return this.config.GITHUB_TOKEN;
    }

    public getGithubRepo() {
        return this.config.GITHUB_REPO;
    }
}
