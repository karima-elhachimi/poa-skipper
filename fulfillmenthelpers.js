'use strict';

const dotenv = require('dotenv').config()
const axios = require('axios');
const request = require('request');
const URL = require('url').URL;

module.exports = class FulfillmentHelpers {
    constructor() {
        this.weatherHost = process.env.weather_host; 
        this.weatherApiKey = process.env.weather_api;
        this.geoHost =  process.env.geo_host; 
        this.apicsHost =  process.env.apics_mock_host; 
        console.log(`helper initiated with: ${this.weatherHost} ${this.weatherApiKey}`);
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
    createLatAndLongSearchParams(city) {
        return `/search?q=${city}&format=json&limit=1`;
    }

    requestQuayInformationById(quaynumber) {
        let url = this.getFullUrl(this.createQuayPath(quaynumber, this.apicsHost));
        return axios.get(url)
        
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

    createNauticalSearchPath(lat, lon, params) {
        return `/point?lat=${lat}&lng=${lon}&source=sg&params=${params}`
    }

    createNauticalParams(...params) {

        if(params === 'all') {
            return 'airTemperature,';
        }
        let paramString;
        for (let i = 0; i < params; i++) {
            paramString += `, ${params[i]}`
        }

        return params;
    }

    respondWithLockInformation(lockCode){
        const url = this.getFullUrl(this.createGetLockPath(lockCode), this.apicsHost);
        return this.requestApicsData(url).then(res => {
            return res;
        })
    }

    respondWithNauticalWeatherData(agent) {
        console.log('#respondWithNauticalWeatherData started');
        let city = agent.parameters.paramLocatie;
        console.log(`city: ${city}`)
        return this.requestLatandLonData(city)
            .then(latlon => {
                let nauticalWeatherParams = this.createNauticalParams('all'); //https://docs.stormglass.io/#point-request
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
        let temp = forecastData.airTemperature[0].value;
        let wk = forecastData.windSpeed[0].value;
        let wd = forecastData.windDirection[0].value;
        let vis = forecastData.visibility[0].value;
        let water = forecastData.swellHeight[0].value;
        let text = `temperatuur: ${temp} graden celcius
    windkracht: ${wk} meter per seconde.`;
        console.log(`#formatWeatherForecast: ${text}`);
        return text;
    }

    formatWaterForecast(forecastData){


    }

    formatVisibilityForecast(forecastData){

    }

    formatWindForecast(forecastData){

    }


    getLockCode(lockname) {
        //todo: uitwerken mapping tussen sluisnaam en sluidcode
        return `ZAS`;
    }

    createGetLockExecutionsPath(lockCode) {

        return `/apics/lockexecutions/${lockCode}`;
    }

    createGetLockExecutionPath(executionId) {
        return `/apics/lockexecution/${executionId}`;
    }

    createGetLocksPath() {
        return `/apics/locks`;
    }

    createGetLockPath(lockCode) {
        return `/apics/lock/${lockCode}`;
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
                console.log(body);
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
        let lockExecutionsPath = this.createGetLockExecutionsPath(lock.lockCode);
        let url = this.getFullUrl(lockExecutionsPath, this.apicsHost);
        return this.requestApicsData(url);
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