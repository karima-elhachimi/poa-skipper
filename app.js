'use strict'
const express = require('express');
const cors = require('cors');
const app = express()

app.use(cors());
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", '*');
  //res.header("Access-Control-Allow-Credentials", true);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header("Access-Control-Allow-Headers", 'Origin,X-Requested-With,Content-Type,Accept,content-type,application/json');
  next();
});

// dialogflow

const { WebhookClient } = require('dialogflow-fulfillment')
const { Card, Suggestion } = require('dialogflow-fulfillment')

const admin = require('firebase-admin')
process.env.DEBUG = 'dialogflow:debug' // enables lib debugging statements
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
admin.initializeApp()

//dialogflow client
const df = require('./dialogflow');
const dfAgent = new df();

//dialogflow fulfillers for fulfillment of chat requests: 
//nautical helper
const NauticalFulfiller = require('./nauticalFulfillment');
const nauticalFulfiller = new NauticalFulfiller();

//ligplaats helper 
const QuayFulfiller = require('./quayFulfillment');
const quayFulfiller = new QuayFulfiller();

//sluis helper
const LockFulfiller = require('./lockFulfillment');
const lockFulfiller = new LockFulfiller();

//todo: implement initial hello
app.get('/chat/init', (req, res) => {
  dfAgent.sendTextMessageToDialogFlow('hello', 'localhost')
    .then(answer => {
      res.json(answer)
    })
})

app.get('/tides/location/:location', (req, res) => {
  //todo: raar, refactor!
  try {
    nauticalFulfiller.requestLatandLonData(req.params.location)
    .then(position => {
      nauticalFulfiller.requestTidalData(position)
        .then(tide => {
          res.send(tide);
        });
    });
  }catch (err) {
    console.log(`tides by location error: ${err}`);
  }
})

app.get('/tides/position/:position', (req, res) => {
  const pos = req.params.position.split(",");
  try {
    nauticalFulfiller.requestTidalData(pos)
    .then(tide => {
      res.send(tide);
    });
  } catch (err) {
    console.log(`getting tidal data error: ${err}`);
  }
})


app.get('/forecast/location/:location', (req, res) => {
  try {
    nauticalFulfiller.respondWithNauticalWeatherForecastByLocation(req.params.location, 'all')
      .then(weatherData => {
        console.log(`returned weatherData: ${weatherData}`);
        weatherData.location = req.params.location
        res.send(weatherData)
       /*  res.json({
          visibility: "NA",
          windForce: "NA",
          windDirection: "NA",
          waterLevel: "NA"
        }); */
      });
  } catch (err) {
    console.log(`get location went wrong error: ${err}`);
    res.json({
      visibility: "NA",
      windForce: "NA",
      windDirection: "NA",
      waterLevel: "NA"
    });
    

  }
});

app.get('/forecast/position/:position', (req, res) => {
  console.log(`req text: ${req.params.position}`);
  const pos = req.params.position.split(",");
  try {
    nauticalFulfiller.respondWithNauticalWeatherForecastByPosition(pos, 'all')
      .then(weatherData => {
        console.log(`returned weatherData: ${nauticalFulfiller.formatWeatherForecast(weatherData)}`);
        res.send(weatherData);
       /*  res.json({
          visibility: "NA",
          windForce: "NA",
          windDirection: "NA",
          waterLevel: "NA"
        }); */
      });
  } catch (err) {
    console.log(`get forecast by position error: ${err}`);
  }
});

app.get('/chat/:text', (req, res) => {
  dfAgent.sendTextMessageToDialogFlow(req.params.text, "localhost")
    .then(answer => {
      console.log('get /chat/text answer: ' + answer);
      res.json(
        answer
      );
    })
    .catch(err => res.send(err))
});

app.get('/', (req, res) => res.send('online'))



app.post('/fulfillment', express.json(), (request, response) => {
  let agent = new WebhookClient({ request: request, response: response });

  function nauticalForecast(agent) {
    let city = agent.parameters.paramLocatie;
    console.log(`getting forecast for ${city}`);
    return nauticalFulfiller.respondWithNauticalWeatherForecastByLocation(city, 'all')
    .then(forecast => {
      console.log(`returned forecast is ${forecast}`);
      const text = nauticalFulfiller.formatWeatherForecast(forecast.hours[0]);
      agent.add(`Hierbij het nautisch weerbericht voor ${city}: ${text}`);
    });
  }

  function allExecutionsPerLock(agent) {
    let lock = agent.parameters.paramSluis;
    return lockFulfiller.requestLockExecutions(lock)
      .then(res => {
        agent.add(`Alle schuttingen voor ${lock}: ${res}`);
      }).catch(er => agent.add(`Het ophalen van de schuttingen voor ${lock} is mislukt. error: ${er}`));
  }

  function lockDetails(agent) {
    let lockName = agent.parameters.paramSluis;
    console.log(`get lock details for ${lockName}`);
    return lockFulfiller.respondWithLockInformation(lockName).then(res => {
      agent.add(`${res.lockName} heeft een status van ${res.status}.`);

    })
  }

  function allLocks(agent) {
    return lockFulfiller.requestAllLocks()
      .then(locks => {
        console.log(`request all locks response: ${locks}`);
        let text = lockFulfiller.formatLocks(locks);
        agent.add(`Alle sluizen in Antwerpen en hun statussen:\n ${text}`);
      }, er => console.log(er)).catch(err => agent.add(`Er is iets misgegaan bij het ophalen van de sluizen. error: ${err}`));
  }

  function respondWithUnavailableLocks() {
    return lockFulfiller.getOutofOrderLocks()
      .then(res => {
        //nl
        if (res.length > 0) {
          agent.add(`Onbeschikbare sluizen: ${lockFulfiller.formatLocks(res)}`);
        } else {
          agent.add('All sluizen zijn beschikbaar');
        }

      })
  }

  function executionDetails(agent) {
    let lock = agent.parameters.paramSluis;
    return lockFulfiller.requestLockExecutionDetail(lock).then(res => {
      agent.add(`Details voor de eerstvolgende schutting van ${lock}: ${res[0]}`)
    })
  }

  function respondWithQuayInfo(agent) {
    let quaynr = agent.parameters.paramKaainummer;
    return quayFulfiller.requestQuayInformationById(quaynr)
      .then(res => {
        console.log(`#respondWithQuayInfo response: ${res[0]}`);
        if (res[1]) {
          agent.add(res[0]);
        } else {
          agent.context.set('informatieligplaats-alternatief', 5)
          agent.add(res[0]);
        }
      })
  }


  function respondWithAvailableQuays(agent) {
    const location = agent.parameters.paramDok ? agent.parameters.paramDok : null;
    console.log(`responding with quays nearest to: ${location}`);

    return quayFulfiller.requestAvailableQuays(location)
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
  intentMap.set('sluis.toestand.detail', lockDetails)
  intentMap.set('sluis.schutting.details', executionDetails)
  intentMap.set('sluis.toestand.buitendienst', respondWithUnavailableLocks)
  intentMap.set('informatie.ligplaats - alternatief', respondWithAvailableQuays)
  intentMap.set('informatie.ligplaats.check.ja', respondWithQuayInfo)
  intentMap.set('informatie.ligplaats - check kaainr? no', respondWithAvailableQuays)
  intentMap.set('informatie.ligplaats.locatie', respondWithAvailableQuays)

  agent.handleRequest(intentMap);
});

module.exports = app
