const ApicsRequest = require('./apicsRequestHandler')

module.exports = class LockFulfillment extends ApicsRequest  {

    constructor(){
        super();
    }

    createGetLocksPath() {
        return `/apics/locks`;
    }
    createGetLockPath(lockCode) {
        return `/apics/lock/${lockCode}`;
    }
    createLatAndLongSearchParams(city) {
        return `/search?q=${city}&format=json&limit=1`;
    }

    createGetLockExecutionPath(executionId) {
        return `/apics/lockexecution/${executionId}`;
    }    
    createGetLockExecutionsPath(lockCode) {
        return `/apics/lockexecutions/${lockCode}`;
    }    

    
    requestLockExecutionDetail(executionId){
        let url = this.getFullUrl(this.createGetLockExecutionPath(executionId, this.apicsHost));
        return this.requestApicsData(url);
    }

    respondWithLockInformation(lockCode){
        const url = this.getFullUrl(this.createGetLockPath(lockCode), this.apicsHost);
        return this.requestApicsData(url).then(res => {
            return res;
        })
    }

    getOutofOrderLocks(){
        this.requestAllLocks()
        .then(res => {
            const locks = JSON.parse(res);
            let locksOutOfOrder = [];
            locks.forEach(lock => {
                if(lock.status.toLowerCase() == 'unavailable' )
                    locksOutOfOrder.add(lock);
            })
            return locksOutOfOrder;
        })

    }

    requestAllLocks() {
        let locksPath = this.createGetLocksPath();
        let url = this.getFullUrl(locksPath, this.apicsHost);
        return this.requestApicsData(url);
    }

    requestLockExecutions(lock) {
        let lockExecutionsPath = this.createGetLockExecutionsPath(lock);
        let url = this.getFullUrl(lockExecutionsPath, this.apicsHost);
        return this.requestApicsData(url)
        .then(res => {
            
        })
    }

    formatLocks(locks) {
        let format = '';

        locks = JSON.parse(locks);
        for (let i = 0; i < locks.length; i++) {
            format += `${locks[i].lockName} status: ${locks[i].status}\n`;

        }
        console.log(format);

        return format;
    }

    formatLockExecutions(lockexecutions){
        let format = '';

        const executions = JSON.parse(lockexecutions);
        executions.forEach(execution => {
            format +=   `richting: ${execution.direction},
                        geplande start: ${moment(execution.planned)}
                        `;

        })

        return format;
    }


}