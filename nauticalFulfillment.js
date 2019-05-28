const FulFill = require('./fulfill');
const request = require('request');
const Forecast = require('./models/Forecast');

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

    createNauticalSearchPath(lat, lon, params) {
        return `/v1/weather/point?lat=${lat}&lng=${lon}&source=sg&params=${params}`
    }

    createTidesParams(position){
        return `/v1/tide/extremes/point?lat=${position[0]}&lng=${position[1]}`;

    }

    requestTidalData(position){
        const url = this.getFullUrl(this.createTidesParams(position), this.weatherHost);
        return this.requestNauticalData(url).then(res => {
            console.log(`tidal data: ${res.data.extremes}`);
            return res.data.extremes[0];
        })

    }

    respondWithNauticalWeatherData(agent) {
        console.log('#respondWithNauticalWeatherData started');
        let city = agent.parameters.paramLocatie;
        console.log(`city: ${city}`)
        return this.requestLatandLonData(city)
            .then(latlon => {
                let nauticalWeatherParams = this.createNauticalParams('all'); //https://docs.stormglass.io/#point-request

                //todo: url samenstellen voor het zoeken met createNauticalParams @low
                //let nauticalWeatherParams = "airTemperature,windSpeed" //https://docs.stormglass.io/#point-request
                let path = this.createNauticalSearchPath(latlon[0], latlon[1], nauticalWeatherParams)
                let url = this.getFullUrl(path, this.weatherHost);
                console.log(`#respondWithNauticalWeatherdata url: ${url}`);
                return this.requestNauticalData(url);
            })
    
    } 
   
    respondWithNauticalWeatherForecastByLocation(city, params) {
        console.log(`city: ${city}`)
        return this.requestLatandLonData(city)
            .then(latlon => {
                this.respondWithNauticalWeatherForecastByPosition(latlon, params);
            })
    } 

    respondWithNauticalWeatherForecastByPosition(position, params) {
        console.log(`getting weather forecast for position: ${position}`);
        const pathParams = this.createNauticalParams(params);
        const path = this.createNauticalSearchPath(position[0], position[1], pathParams);
        return this.requestWeatherForecast(path)
        .then(forecast => {
            console.log(`raw forecast: ${forecast}`);
            return forecast;
        });
    }

    
    requestWeatherForecast(path) {
        const url = this.getFullUrl(path, this.weatherHost);
        console.log(`#respondWithNauticalWeatherdata url: ${url}`);
        return this.requestNauticalData(url)
    }

    createForecastObject(forecast) {
        return new Forecast(
            this.formatVisibilityForecast(forecast), 
            this.formatWindForecast(forecast),
            this.formatWindDirectionForecast(forecast), 
            this.formatWaterForecast(forecast));
      
    }

    requestNauticalData(url) {
        console.log(`request url: ${url}`);
        return new Promise((resolve, reject) => {
            var options = {
                method: 'GET',
                url: url,
                json: true,
                headers:
                {
                    'Authorization': this.weatherApiKey,
                    'Content-Type': 'application/json',
                },
                
            };
            request(options, function (error, response, body) {
                if (error) {
                    reject(error);
                    throw new Error(error)
                }
                console.log(`to be resolved: ${body.hours[0]}`);
                resolve(body);
            });
        })
    }

    formatWeatherForecast(forecastData) {
        let wk = this.formatWindForecast(forecastData);
        let wd = this.formatWindDirectionForecast(forecastData);
        let vis = this.formatVisibilityForecast(forecastData);
        let water = this.formatWaterForecast(forecastData);
        let text = `De windkracht is ${wk} en komt uit het ${wd}. De zichtbaarheid is ${vis} en het water komt tot ${water} hoog.`;
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