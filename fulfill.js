const URL = require('url').URL;
const axios = require('axios');

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

        return axios.get(url)
            .then(res => {
                console.log(`lat lon response: ${JSON.parse(res.data[0].lat)}`);
                return [JSON.parse(res.data[0].lat), JSON.parse(res.data[0].lon)];
            });
    }

    
}