// class that holds config params used by bot, for now this is reading from node env variables
module.exports = class ArgoBotConfig {
    
    constructor() {
        this.config = process.env
    }

    getAPIToken() {
        return this.config.ARGOCD_AUTH_TOKEN
    }

    getServerIP() {
        return this.config.ARGOCD_SERVER
    }

    getGithubToken() {
        return this.config.GITHUB_TOKEN
    }

    getGithubRepo() {
        return this.config.GITHUB_REPO
    }
}
