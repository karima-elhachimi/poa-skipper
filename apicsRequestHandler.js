const request = require('request');
const URL = require('url').URL;
const Fulfill = require('./fulfill')


module.exports = class ApicsRequestHandler extends Fulfill {
    constructor(){
        super();
        this.apicsHost =  process.env.apics_mock_host; 
    }

    getApicsFullUrl(path) {
        let url = new URL(path, this.apicsHost);
        console.log(`fullURL: ${url}`);
        return url.toString();
    }

    requestApiData(url) {
        console.log(`request url: ${url}`);
        return new Promise((resolve, reject) => {
            var options = {
                method: 'GET',
                url: url,
                headers:
                {
                    'Content-Type': 'application/json',
                },
                json: true
            };
            request(options, function (error, response, body) {
                if (error) {
                    console.log(`request error: ${error}`);
                    reject(error);
                    
                    throw new Error(error)
                }
                console.log(`to be resolved: ${body}`);
                resolve(body);
            });
        })
    }

    requestApicsData(path){

    }
}