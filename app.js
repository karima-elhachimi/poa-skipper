'use strict'
const express = require('express');
const http = require('http');
const https = require('https');
const axios = require('axios');
const request = require('request');
const URL = require('url').URL;
const cors = require('cors');
const app = express()

app.use(cors());

// dialogflow
const { WebhookClient } = require('dialogflow-fulfillment')
//dialogflow fulfillment helper
const fulfillmentHelper = require('./fulfillmenthelpers')

const fulfill = new fulfillmentHelper();
const admin = require('firebase-admin')
process.env.DEBUG = 'dialogflow:debug' // enables lib debugging statements
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
admin.initializeApp()

//dialogflow client
const df = require('./dialogflow');
const dfAgent = new df();

//nautical helper
const Nautical = require('./nauticalFulfillment');
const nautical = new Nautical();
//lockCode keys
let lcArray = [
  ["berendrechtsluis", "BES"],
  ["van cauwelaertsluis", "VCS"],
  ["boudewijnsluis", "BOS"],
  ["royersluis", "ROS"],
  ["kieldrechtsluis", "KIS"],
  ["kallosluis", "KAS"],
];
const lockCodeMap = new Map(lcArray);

//todo: implement initial hello
app.get('/chat/hello', (req, res) => {
  dfAgent.sendTextMessageToDialogFlow('hello', 'localhost')
  .then(answer => {
    res.json(answer)
  })
})

app.get('/weather/forecast/:location', (req, res) => {
  nautical.respondWithNauticalDataBasedOnParams(req.params.text, 'all')
  .then(weatherData => {
    res.json(weatherData)
  });
});


app.get('/chat/:text', (req, res) =>{
  dfAgent.sendTextMessageToDialogFlow(req.params.text, "localhost")
    .then(data => {
      console.log(data);
      answer = dfAgent.createMessage(data);
      res.json(
         answer
      );
    })
    .catch(err => res.send(err))
})

app.get('/', (req, res) => res.send('online'))



app.post('/fulfillment', express.json(), (request, response) => {
  let agent = new WebhookClient({ request: request, response: response });
  //console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers))
  //console.log('Dialogflow Request body: ' + JSON.stringify(request.body))



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
    //agent.add(`Ik antwoord binnenkort met alle schuttingen voor ${lock}`);
    return requestLockExecutions(lock)
      .then(res => {
        agent.add(`request all executions response: ${res}`);
    

      }).catch(er => agent.add(`Het ophalen van de schuttingen voor ${lock} is mislukt. error: ${er}`));
  }

  function lockDetails(agent){
    let lockName = agent.parameters.paramSluis.toLowerCase();
    console.log(`lock details ${lockCodeMap.get(lockName)}`);
    agent.add(`Ik vraag de details op voor de ${lockName}`);
  }

  function allLocks(agent) {
    return requestAllLocks()
      .then(locks => {
        console.log(`request all locks response: ${locks}`);
        let text = formatLocks(locks);
        agent.add(`Alle sluizen in Antwerpen en hun statussen:\n ${text}`);
      }, er => console.log(er)).catch(err => agent.add(`Er is iets misgegaan bij het ophalen van de sluizen. error: ${err}`));
  }

  function executionDetails(agent) {
    let lock = agent.parameters.paramSluis;
    agent.add(`Ik antwoord binnenkort met schutting details voor ${lock}`);
  }

  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map()
  //intentMap.set('Default Welcome Intent', welcome);
  //intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('nautisch.algemeen', nauticalForecast);
  intentMap.set('sluis.schuttingen', allExecutions);
  intentMap.set('sluis.toestand.algemeen - yes', allLocks);
  intentMap.set('sluis.toestand.detail',lockDetails )
  intentMap.set('sluis.schutting.details',executionDetails)

  agent.handleRequest(intentMap);
});


function getFullUrl (path, host) {
  let url = new URL(path, host);
  console.log(`fullURL: ${url}`);
  return url.toString();
}

//helpers voor de intent handlers

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
  return axios.get(url)
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

function getLockCode (lockname) {
  //todo: uitwerken mapping tussen sluisnaam en sluidcode
  return `ZAS`;
}

function createGetLockExecutionsPath(lockname) {
  let code = getLockCode(lockname);
  return `/apics/lockexecutions/${code}`;
}

function createGetLockExecutionPath(executionId) {
  return `/apics/lockexecution/${executionId}`;
}

function createGetLocksPath(){
  return `/apics/locks`;
}

function createGetLockPath(lockCode){
  return `/apics/lock/${lockCode}`;
}

function requestApicsData(url){
  console.log(`apics request url: ${url}`);
  return new Promise((resolve, reject)=> {
    var options = { method: 'GET',
      url: url,
      headers:
        { 'cache-control': 'no-cache' } };

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

function requestAllLocks(){
  let locksPath = createGetLocksPath();
  let url = getFullUrl(locksPath, apicsHost);
  return requestApicsData(url);
}

function requestLockExecutions(lock){
  let lockExecutionsPath = createGetLockExecutionsPath(lock.lockCode);
  let url = getFullUrl(lockExecutionsPath, apicsHost);
  return requestApicsData(url);
}

function formatLocks (locks) {
  let format = '';

  locks = JSON.parse(locks);
  for (let i = 0; i < locks.length; i++){
    format += `${locks[i].lockName} status: ${locks[i].status}\n`;

  }
  console.log(format);
  return format;
}

module.exports = app
