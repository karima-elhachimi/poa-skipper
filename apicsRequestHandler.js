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

    requestApicsData(url) {
        console.log(`apics request url: ${url}`);
        return new Promise((resolve, reject) => {
            var options = {
                method: 'GET',
                url: url,
                headers:
                {
                    'Content-Type': 'application/json',
                }
            };
            request(options, function (error, response, body) {
                if (error) {
                    throw new Error(error)
                    reject(error);
                }
                console.log(`to be resolved: ${body}`);
                resolve(body);
            });
        })
    }
}