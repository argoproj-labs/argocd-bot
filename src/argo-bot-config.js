// class that holds config params used by bot, for now this is reading from node env variables
module.exports = class ArgoBotConfig {
    
    constructor() {
        this.config = process.env
    }

    getAPIToken() {
        return this.config.ARGO_CD_API_TOKEN
    }

    getServerIP() {
        return this.config.ARGO_CD_SERVER_IP
    }

    getGithubToken() {
        return this.config.GITHUB_TOKEN
    }

    getGithubRepo() {
        return this.config.GITHUB_REPO
    }
}
