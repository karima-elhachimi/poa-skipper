'use strict'
const express = require('express');
const cors = require('cors');
const app = express()

app.use(cors());
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", '*');
  //res.header("Access-Control-Allow-Credentials", true);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header("Access-Control-Allow-Headers", 'Origin,X-Requested-With,Content-Type,Accept,content-type,application/json');
  next();
});

// dialogflow

const { WebhookClient } = require('dialogflow-fulfillment')
const { Card, Suggestion } = require('dialogflow-fulfillment')
//dialogflow fulfillment
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
const Nauticalfulfiller = require('./nauticalFulfillment');
const nautical = new Nauticalfulfiller();

//ligplaats helper 
const Quayfulfiller = require('./quayFulfillment');
const quayfulfiller = new Quayfulfiller();

//sluis helper
const Lockfulfiller = require('./lockFulfillment');
const lockfulfiller = new Lockfulfiller();

//todo: implement initial hello
app.get('/chat/init', (req, res) => {
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
      console.log(`#sendTextMessageToDialogflow returned data: ${JSON.parse(data)}`);
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
  
  function nauticalForecast (agent) {
    return fulfill.respondWithNauticalWeatherData(agent)
      .then(nautischeData => {
        console.log(`json parse data: ${JSON.stringify(nautischeData.data.hours[0])}`)
        let text = fulfill.formatWeatherForecast(nautischeData.data.hours[0]);
        console.log(`response: ${text}`);
        agent.add(text);
      }).catch(er => agent.add(`something went wrong: ${er}`))
  }

  function allExecutionsPerLock(agent) {
    let lock = agent.parameters.paramSluis;
    return lockfulfiller.requestLockExecutions(lock)
      .then(res => {
        agent.add(`Alle schuttingen voor ${lock}: ${res}`);
      }).catch(er => agent.add(`Het ophalen van de schuttingen voor ${lock} is mislukt. error: ${er}`));
  }

  function lockDetails(agent){
    let lockName = agent.parameters.paramSluis;
    console.log(`lock details ${lockName}`);
    return fulfill.respondWithLockInformation(lockName).then(res => {

      agent.add(`${res}`);

    })
  }

  function allLocks(agent) {
    return fulfill.requestAllLocks()
      .then(locks => {
        console.log(`request all locks response: ${locks}`);
        let text = fulfill.formatLocks(locks);
        agent.add(`Alle sluizen in Antwerpen en hun statussen:\n ${text}`);
      }, er => console.log(er)).catch(err => agent.add(`Er is iets misgegaan bij het ophalen van de sluizen. error: ${err}`));
  }

  function respondWithUnavailableLocks(){
    return lockfulfiller.getOutofOrderLocks()
    .then(res => {
      //nl
      if(res.length > 0) {
        agent.add(`Onbeschikbare sluizen: ${lockfulfiller.formatLocks(res)}`);
      } else {
        agent.add('All sluizen zijn beschikbaar');
      }
      
    })
  }

  function executionDetails(agent) {
    let lock = agent.parameters.paramSluis;
    return lockfulfiller.requestLockExecutionDetail(lock).then(res => {
      agent.add(`Details voor de eerstvolgende schutting van ${lock}: ${res[0]}`)
    })
  }

  function respondWithQuayInfo(agent) {
    let quaynr = agent.parameters.paramKaainummer;
    return fulfill.requestQuayInformationById(quaynr)
    .then(res => {
      console.log(`#respondWithQuayInfo response: ${res[0]}`);
      if(res[1]) {
        agent.add(res[0]);
      } else {
        agent.context.set('informatieligplaats-alternatief', 5)
        agent.add(res[0]);
      }
    })
  }


  function respondWithAvailableQuays(agent) {
    const location = agent.parameters.paramDok? agent.parameters.paramDok : null;
    console.log(`responding with quays nearest to: ${location}`);
    
    return fulfill.requestAvailableQuays(location)
    .then(res => {  
      console.log(`#respondWithAvailableQuay: ${res}`);
      agent.add(`Volgende kaainummers zijn de komende 12u beschikbaar: \n\n ${res}`);
    })
  }


  //todo: add option to clear message history on firestore

  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map()
 
  intentMap.set('nautisch.algemeen', nauticalForecast);
  intentMap.set('sluis.schuttingen', allExecutionsPerLock);
  intentMap.set('sluis.toestand.algemeen - yes', allLocks);
  intentMap.set('sluis.toestand.detail', lockDetails )
  intentMap.set('sluis.schutting.details', executionDetails)
  intentMap.set('sluis.toestand.buitendienst', respondWithUnavailableLocks)
  intentMap.set('informatie.ligplaats - alternatief', respondWithAvailableQuays)
  intentMap.set('informatie.ligplaats.check.ja', respondWithQuayInfo)
  intentMap.set('informatie.ligplaats - check kaainr? no', respondWithAvailableQuays)
  intentMap.set('informatie.ligplaats.locatie', respondWithAvailableQuays)

  agent.handleRequest(intentMap);
});

module.exports = app
