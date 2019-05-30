const URL = require('url').URL;

module.exports = class Fulfill {

    constructor() {
        this.geoHost =  process.env.geo_host; 
    }
    
    getFullUrl(path, host) {
        let url = new URL(path, host);
        console.log(`fullURL: ${url}`);
        return url.toString();
    }

    createLatAndLongSearchParams(city) {
        return `/search?q=${city}&format=json&limit=1`;
    }
    requestLatandLonData(location) {
        let url = this.getFullUrl(this.createLatAndLongSearchParams(location), this.geoHost);
        console.log(`#requestLatandLonData url: ${url}`);
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
                    reject(error);
                    throw new Error(error)
                }
                console.log(`lat lon response: ${body.data[0].lat}`);
                resolve([ body.data[0].lat, body.data[0].lon]);
            });
        });
    }

    
}