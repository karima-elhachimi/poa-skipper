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
//dialogflow fulfillment helper
const fullfillmentHelper = require('./fulfillmenthelpers')
const helper = new fullfillmentHelper();
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
    return helper.respondWithNauticalWeatherData(agent)
      .then(nautischeData => {
        console.log(`json parse data: ${JSON.stringify(nautischeData.data.hours[0])}`)
        let text = helper.formatWeatherForecast(nautischeData.data.hours[0]);
        console.log(`response: ${text}`);
        agent.add(text);
      }).catch(er => agent.add(`something went wrong: ${er}`))
  }

  function allExecutions(agent) {
    let lock = agent.parameters.paramSluis;
    //agent.add(`Ik antwoord binnenkort met alle schuttingen voor ${lock}`);
    return helper.requestLockExecutions(lock)
      .then(res => {
        console.log(`request all executions response: ${res}`);

      }).catch(er => agent.add(`Het ophalen van de schuttingen voor ${lock} is mislukt. error: ${er}`));
  }

  function lockDetails(agent){
    let lockName = agent.parameters.paramSluis.toLowerCase();
    console.log(`lock details ${lockCodeMap.get(lockName)}`);
    agent.add(`Ik vraag de details op voor de ${lockName}`);
  }

  function allLocks(agent) {
    return helper.requestAllLocks()
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

module.exports = app
