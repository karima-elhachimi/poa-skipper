'use strict';

const dotenv = require('dotenv').config()
const axios = require('axios');
const request = require('request');
const URL = require('url').URL;

module.exports = class FulfillmentHelpers {
   
   


    constructor() {
        this.weatherHost = process.env.weather_host; 
        this.weatherApiKey = process.env.sg_api;
        this.geoHost =  process.env.geo_host; 
        this.apicsHost =  process.env.apics_mock_host; 
     }


    getFullUrl(path, host) {
        let url = new URL(path, host);
        console.log(`fullURL: ${url}`);
        return url.toString();
    }

    //helpers voor de intent handlers

    createLatAndLongSearchParams(city) {
        return `/search?q=${city}&format=json&limit=1`;
    }

    requestLatandLonData(location) {
        let url = this.getFullUrl(this.createLatAndLongSearchParams(location), this.geoHost);

        return axios.get(url.toString())
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
        let paramString;
        for (let i = 0; i < params; i++) {
            paramString += `, ${params[i]}`
        }

        return params;
    }

    respondWithNauticalWeatherData(agent) {
        console.log('#respondWithNauticalWeatherData started');
        let city = agent.parameters.paramLocatie;
        console.log(`city: ${city}`)
        //agent.add(`Momentje, ik ben de nautische weergegevens voor ${city} aan het zoeken...`)
        //eerst latitude en longitude ophalen
        return this.requestLatandLonData(city)
            .then(latlon => {
                //todo: url samenstellen voor het zoeken met createNauticalParams
                let nauticalWeatherParams = "airTemperature,windSpeed" //https://docs.stormglass.io/#point-request
                //todo: nautical weather params maken op basis van params uit df
                let path = this.createNauticalSearchPath(latlon[0], latlon[1], nauticalWeatherParams)

                let url = this.getFullUrl(path, this.weatherHost).toString();
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
        let text = `temperatuur: ${temp} graden celcius
    windkracht: ${wk} meter per seconde.`;
        console.log(`#formatWeatherForecast: ${text}`);
        return text;
    }

    getLockCode(lockname) {
        //todo: uitwerken mapping tussen sluisnaam en sluidcode
        return `ZAS`;
    }

    createGetLockExecutionsPath(lockname) {
        let code = this.getLockCode(lockname);
        return `/apics/lockexecutions/${code}`;
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