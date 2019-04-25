'use strict'

const express = require('express')
const https = require('https')
const axios = require('axios')
const URL = require('url').URL;
const cors = require('cors');
const app = express()

app.use(cors());

// dialogflow
const functions = require('firebase-functions')
const { WebhookClient } = require('dialogflow-fulfillment')
const { Card, Suggestion } = require('dialogflow-fulfillment')
const admin = require('firebase-admin')
process.env.DEBUG = 'dialogflow:debug' // enables lib debugging statements
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
admin.initializeApp()

// api
const stormglassHost = 'http://api.stormglass.io'
const nomiHost = 'http://nominatim.openstreetmap.org';
//keys
const stormGlassApi = '38116ef6-44b8-11e9-8f0d-0242ac130004-38117022-44b8-11e9-8f0d-0242ac130004'

app.get('/', (req, res) => res.send('online'))

app.post('/dialogflow', express.json(), (request, response) => {
  let agent = new WebhookClient({ request: request, response: response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers))
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body))



  function welcome (agent) {
    agent.add(`Welcome to my agent!`)
  }

  function fallback (agent) {
    agent.add(`I didn't understand`)
    agent.add(`I'm sorry, can you try again?`)
  }

  function nauticalForecast (agent) {
    return respondWithNauticalWeatherData(agent)
      .then(nautischeData => {
        console.log(`json parse data: ${JSON.stringify(nautischeData.data.hours[0])}`)
        let text = formatWeatherForecast(nautischeData.data.hours[0]);
        agent.add(text)
      }).catch(er => agent.add(`something went wrong: ${er}`))
  }

  function allExecutions(agent) {
    let lock = agent.parameters.paramSluis;
    agent.add(`Ik antwoord binnenkort met alle schuttingen voor ${lock}`);
  }
  function executionDetails(agent) {
    let lock = agent.parameters.paramSluis;
    agent.add(`Ik antwoord binnenkort met schutting details voor ${lock}`);
  }

  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map()
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('nautisch.algemeen', nauticalForecast);
  intentMap.set('sluis.schuttingen', allExecutions);
  intentMap.set('sluis.schutting.details', executionDetails)

  agent.handleRequest(intentMap);
})


function getFullUrl (path, host) {
  let url = new URL(path, host);
  console.log(`fullURL: ${url}`);
  return url;
}


function createLatAndLongSearchParams (city) {
  return `/search?q=${city}&format=json&limit=1`;
}

function requestLatandLonData(location) {
  let url = getFullUrl(createLatAndLongSearchParams(location), nomiHost);
  return axios.get(url.toString())
    .then(res => {
      console.log(`lat lon response: ${JSON.parse(res.data[0].lat)}`);
      return [JSON.parse(res.data[0].lat), JSON.parse(res.data[0].lon)];
    });
}


function requestNauticalWeatherData (url) {
  console.log('creating axios request for ' + url)
  let config = {
    headers: {
      'Authorization': stormGlassApi,
      'Content-Type': 'application/json'
    }
  }
  return axios.get(url, config)
}

function createNauticalSearchPath (lat, lon, params) {
  return `/point?lat=${lat}&lng=${lon}&source=sg&params=${params}`
}

function createNauticalParams(...params) {
  let paramString;
  for (let i = 0; i < params; i++) {
    paramString += `, ${params[i]}`
  }

  return params;
}

function respondWithNauticalWeatherData (agent, req){
  console.log('function respondWithNauticalWeatherData started');
  console.log(agent.parameters);
  let city = agent.parameters.paramLocatie;
  console.log(`city: ${city}`)
  agent.add(`Momentje, ik ben de nautische weergegevens voor ${city} aan het zoeken...`)
  let latlon = [];
  //eerst latitude en longitude ophalen
  return requestLatandLonData(city)
    .then(latlon => {
      //url samenstellen voor het zoeken
      let nauticalWeatherParams = "airTemperature,windSpeed" //https://docs.stormglass.io/#point-request
      //todo: nautical weather params maken op basis van params uit df
      let path = createNauticalSearchPath(latlon[0], latlon[1], nauticalWeatherParams)

      let url = getFullUrl(path, stormglassHost).toString();
      return axios.get(url, {
        headers: {

          'Authorization': stormGlassApi,
          'Content-Type': 'application/json'
        }
      })
    })
}

function formatWeatherForecast(forecastData) {
  let temp = forecastData.airTemperature[0].value;
  let wk = forecastData.windSpeed[0].value;
  return `temperatuur: ${temp} graden celcius
          windkracht: ${wk} meter per seconde.
  `
}

function createGetLockPath(lockname) {
  //todo: maak een mock path
  console.log('lock path:');
}

function requestLock(url){
  return {"lockName": "Berendrechtsluis", "countOfSeaships": 2};
}

function respondWithLockInformation(agent){
  //todo: respondWithLockInformation
}


module.exports = app
