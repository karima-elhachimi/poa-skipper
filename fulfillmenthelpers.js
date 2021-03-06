'use strict';

const dotenv = require('dotenv').config()
const axios = require('axios');
const request = require('request');
const URL = require('url').URL;
const moment = require('moment');

module.exports = class FulfillmentHelpers {
    constructor() {
        this.weatherHost = process.env.weather_host; 
        this.weatherApiKey = process.env.weather_api;
        this.geoHost =  process.env.geo_host; 
        this.apicsHost =  process.env.apics_mock_host; 
        console.log(`helper initiated with: ${this.weatherHost} ${this.weatherApiKey}`);
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

    getFullUrl(path, host) {
        let url = new URL(path, host);
        console.log(`fullURL: ${url}`);
        return url.toString();
    }

    //helpers voor de intent handlers

    createQuayPath(quaynumber){
        return `/apics/quay/${quaynumber}`;
    }

    createQuaysPath(location){
        if(location)
            return `/apics/quays/${location}`;
        else    
            return `/apics/quays`;
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
    
    createNauticalSearchPath(lat, lon, params) {
        return `/point?lat=${lat}&lng=${lon}&source=sg&params=${params}`
    }
    createNauticalSearchPath(lat, lon, params) {
        return `/point?lat=${lat}&lng=${lon}&source=sg&params=${params}`
    }
   

    requestAvailableQuays(location){
        let url = this.getFullUrl(this.createQuaysPath(location), this.apicsHost);
        return this.requestApicsData(url)
        .then(res => {
            console.log(`#requestApicsData response: ${res}`);
            return this.formatAvailableQuay(JSON.parse(res));
        })
        .catch(e => console.log(`#requestApicsData couldn't get availableQuays. Error: ${e}`))
    }

    requestQuayInformationById(quaynumber) {
        let url = this.getFullUrl(this.createQuayPath(quaynumber), this.apicsHost);
        return this.requestApicsData(url).then(res => {
            console.log(`requestQuayInfo data response: ${res.quayNumber}`);
            return this.formatQuayInfo(res);
        })     
    }

    requestLockExecutionDetail(executionId){
        let url = this.getFullUrl(this.createGetLockExecutionPath(executionId, this.apicsHost));
        return this.requestApicsData(url);
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


    requestNauticalWeatherData(url) {
        console.log('creating axios request for ' + url)
        let config = {
            headers: {
                'Authorization': this.weatherApiKey,
                'Content-Type': 'application/json'
            }
        }
        return axios.get(url)
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
                return axios.get(url, {
                    headers: {
                        'Authorization': this.weatherApiKey,
                        'Content-Type': 'application/json'
                    }
                })
            })
    } 
   
    respondWithLockInformation(lockCode){
        const url = this.getFullUrl(this.createGetLockPath(lockCode), this.apicsHost);
        return this.requestApicsData(url).then(res => {
            return `Status van de ${res.lockName} is ${res.status}.`;
        })
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

    formatQuayInfo(quay){
        let response =  `Kaainummer ${JSON.parse(quay).quayNumber} `;
        let available = false;
        if(quay.status == 'available') {
            available = true
            response += `is beschikbaar van ${moment(quay.availableFrom).format('L, LTS')} tot ${moment(quay.availableTill).format('L, LTS')}`;
            response+= `\n\n Contacteer ${quay.contact} om een reservatie aan te vragen.`;
            
        } else {
            response += `is onbeschikbaar. Wil je dat ik een beschikbare ligplaats voor je zoek?`
        }
    
        return [response, available];
    }
    formatAvailableQuay(rawQuayData) {
        let response = '';
        rawQuayData.forEach(quay => {
            //todo: herformateren dat er gechecked wordt of er wel degelijk een beschikbaar van tot veld is
            const from = moment(quay.availableFrom).format('LTS');
            const till = moment(quay.availableTill).format('LTS')
            response += `\n\nKaainr: ${quay.quayNumber}, beschikbaar van ${from} tot ${till}. \nContact: ${quay.contact}`
        });
        response += `\n\nVergeet niet om een verantwoordelijke te contacteren om een reservatie te regelen.`
        return response;
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
}

