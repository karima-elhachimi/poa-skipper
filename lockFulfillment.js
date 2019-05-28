const ApicsRequest = require('./apicsRequestHandler')
const moment = require('moment');

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
        return this.requestApiData(url);
    }

    respondWithLockInformation(lockCode){
        const url = this.getFullUrl(this.createGetLockPath(lockCode), this.apicsHost);
        return this.requestApiData(url).then(res => {
            console.log(`#respondWithLockInformation response: ${res.lockName}`);
            return res;
        }, err => {
            console.log(`#requestApicsData error: ${err}` );
        });
    }

    getOutofOrderLocks(){
        return this.requestAllLocks()
        .then(res => {
            const locks = JSON.parse(res);
            let locksOutOfOrder = [];
            locks.forEach(lock => {
                if(lock.status.toLowerCase() == 'unavailable' )
                    locksOutOfOrder.push(lock);
            })
            return locksOutOfOrder;
        })

    }

    requestAllLocks() {
        let locksPath = this.createGetLocksPath();
        let url = this.getFullUrl(locksPath, this.apicsHost);
        return this.requestApiData(url);
    }

    requestLockExecutions(lock) {
        let lockExecutionsPath = this.createGetLockExecutionsPath(lock);
        let url = this.getFullUrl(lockExecutionsPath, this.apicsHost);
        return this.requestApiData(url)
        .then(res => {
            return this.formatLockExecutions(res);
        })
    }

    //dry argh
    formatLocks(locks) {
        let format = '';
        locks.forEach(lock => {
            format += `${lock.lockName} status: ${lock.status.toLowerCase()}\n`;
        })
        console.log(format);
        return format;
    }

    formatLockExecutions(executions){
        let format = '';
        executions.forEach(execution => {
            format +=   `richting: ${execution.direction},
                        geplande start: ${moment(execution.planned).format('L, LTS')}
                        `;

        })
        return format;
    }


}