const FulFill = require('./fulfill');
const axios = require('axios');

module.exports = class NauticalFulfillment extends FulFill {

    constructor() {
        super();
        this.weatherHost = process.env.weather_host; 
        this.weatherApiKey = process.env.weather_api;
        console.log(`nauticalhelper initiated with: ${this.weatherHost} ${this.weatherApiKey}`);
    }

    createNauticalParams(...params) {

        let paramString = '';
        if(params[0] === 'all') {
           paramString= 'airTemperature,windSpeed,windDirection,visibility,swellHeight';
        } else {
            for (let i = 0; i < params.length; i++) {
                paramString += `${params[i]},`
            }
        }

        return paramString;
    }

    respondWithNauticalDataBasedOnParams(city, params) {
        console.log(`city: ${city}`)
        return this.requestLatandLonData(city)
            .then(latlon => {
                let nauticalWeatherParams = this.createNauticalParams(params);
                let path = this.createNauticalSearchPath(latlon[0], latlon[1], nauticalWeatherParams)
                let url = this.getFullUrl(path, this.weatherHost);
                console.log(`#respondWithNauticalWeatherdata url: ${url}`);
                return axios.get(url, {
                    headers: {
                        'Authorization': this.weatherApiKey,
                        'Content-Type': 'application/json'
                    }
                })
            })
    } 
    
    formatWeatherForecast(forecastData) {
        let temp = this.formatTemperatureForecast(forecastData);
        let wk = this.formatWindForecast(forecastData);
        let wd = this.formatWindDirectionForecast(forecastData);
        let vis = this.formatVisibilityForecast(forecastData);
        let water = this.formatWaterForecast(forecastData);
        let text = `De temperatuur is ${temp}
                    en de windkracht is ${wk} en komt uit ${wd}. De zichtbaarheid is ${vis} en het water komt tot ${water} hoog.`;
        console.log(`#formatWeatherForecast: ${text}`);
        return text;
    }

    formatTemperatureForecast(forecastData) {
        return `${forecastData.airTemperature[0].value}°C`;
    }

    formatWaterForecast(forecastData){
        return `${forecastData.swellHeight[0].value}m`;
    }

    formatVisibilityForecast(forecastData){
        return `${forecastData.visibility[0].value}%`;
    }

    formatWindForecast(forecastData){
        return `${forecastData.windSpeed[0].value}m/s`;
    }

    formatWindDirectionForecast(forecastData){
        let wd =  forecastData.windDirection[0].value;
        return this.degreesToWindDirectionConverter(wd);
    }


    degreesToWindDirectionConverter(wd) {
        const interval = 22.5;
        const n = `N`;
        const ne = `NO`;
        const e = `O`;
        const se = `ZO`;
        const s = `Z`;
        const sw = `ZW`;
        const w = `W`;
        const nw = `NW`;


        if( wd < interval && wd > (360 - interval) ){
            return n;
        } else if (wd > interval && wd < (90 - interval)) {
            return ne;
        } else if ( wd > (90 - interval) && wd < (90 + interval)) {
            return e;
        } else if (wd > (90 + interval) && wd < (180 - interval)) {
            return se;
        } else if (wd > (180 - interval) && wd < ( 180+ interval)) {
            return s;
        } else if (wd > (180 + interval) && wd < (360 - interval)) {
            return sw;
        } else if (wd > (360 - interval) && wd < (360 + interval)) {
            return w;
        } else {
            return nw;
        }
    }
}