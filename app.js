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


//lockCode keys
const lockCodes = require('./lockcodes');
const lockCodeMap = lockCodes.lockMap;

//todo: implement initial hello
app.get('+/chat/hello')

app.get('/weather/forecast/:params', (req, res) => {

});

app.get('/chat/:text', (req, res) =>{
  dfAgent.sendTextMessageToDialogFlow(req.params.text, "localhost")
    .then(answer => {
      console.log(answer);
      res.json(
         answer
      );
    })
    .catch(err => res.send(err))
})

app.get('/', (req, res) => res.send('online'))



app.post('/fulfillment', express.json(), (request, response) => {

  function nauticalForecast (agent) {
    return fulfill.respondWithNauticalWeatherData(agent)
      .then(nautischeData => {
        console.log(`json parse data: ${JSON.stringify(nautischeData.data.hours[0])}`)
        let text = fulfill.formatWeatherForecast(nautischeData.data.hours[0]);
        console.log(`response: ${text}`);
        agent.add(text);
      }).catch(er => agent.add(`something went wrong: ${er}`))
  }

  function allExecutions(agent) {
    let lock = agent.parameters.paramSluis;
    //agent.add(`Ik antwoord binnenkort met alle schuttingen voor ${lock}`);
    return fulfill.requestLockExecutions(lock)
      .then(res => {
        console.log(`request all executions response: ${res}`);
        // todo: format response to a readable format
        // todo: send multiple messages
        agent.add(`request all executions response: ${res}`);
  
      }).catch(er => agent.add(`Het ophalen van de schuttingen voor ${lock} is mislukt. error: ${er}`));
  }

  function lockDetails(agent){
    let lockName = agent.parameters.paramSluis.toLowerCase();
    console.log(`lock details ${lockCodeMap.get(lockName)}`);
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

  function executionDetails(agent) {
    let lock = agent.parameters.paramSluis;

    return fulfill.requestLockExecutionDetail(lock).then(res => {
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
        agent.context.set('informatieligplaats-alternatief', 5, {param: ''})
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
  intentMap.set('sluis.schuttingen', allExecutions);
  intentMap.set('sluis.toestand.algemeen - yes', allLocks);
  intentMap.set('sluis.toestand.detail', lockDetails )
  intentMap.set('sluis.schutting.details', executionDetails)
  intentMap.set('informatie.ligplaats - alternatief', respondWithAvailableQuays)
  intentMap.set('informatie.ligplaats.check.ja', respondWithQuayInfo)
  intentMap.set('informatie.ligplaats - check kaainr? no', respondWithAvailableQuays)
  intentMap.set('informatie.ligplaats.locatie', respondWithAvailableQuays)

  agent.handleRequest(intentMap);
});

module.exports = app
