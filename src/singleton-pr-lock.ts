// Singleton lock object shared by bot, this is to prevent multiple PR's from running at the same time
export class SingletonPrLock {

    private static instance;

    private activePrName;
    private activePrNumber;
    private locked;

    constructor() {
        if (typeof SingletonPrLock.instance === "object") {
            return SingletonPrLock.instance;
        }

        this.activePrName = "";
        this.activePrNumber = -1;
        this.locked = false;

        SingletonPrLock.instance = this;
        return this;
    }

    public tryLock(prName, prNumber) {
        // if no one is holding the lock, obtain it
        if (this.locked === false) {
            this.activePrName = prName;
            this.activePrNumber = prNumber;
            this.locked = true;
            return true;
        }
        // if a PR is attempting to lock and it already holds the lock, allow it to proceed
        if (this.locked === true && this.activePrNumber === prNumber) {
            return true;
        }
        return false;
    }

    public getPrNumber() {
        return this.activePrNumber;
    }

    public getLockInfo() {
        if (this.locked === false) {
            throw new Error("Lock is not being held");
        }
        return "PR: `" + this.activePrName + "` #" + this.activePrNumber;
    }

    public unlock(prNumber) {
        if (this.activePrNumber === prNumber) {
            this.locked = false;
            return true;
        }
        return false;
    }

    public isLocked() {
        return this.locked;
    }
}

export {SingletonPrLock as PrLock } from "./singleton-pr-lock";
