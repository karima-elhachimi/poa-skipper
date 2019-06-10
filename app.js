'use strict'
const express = require('express');
const cors = require('cors');
const request = require('request');
const app = express()

const allowCrossDomain = function(req, res, next) {
  const origin = req.get('origin'); 
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

  if ('OPTIONS' == req.method) {
    res.send(200);
  }
  else {
    next();
  }
};
app.use(cors());
app.use(allowCrossDomain);

// dialogflow

const { WebhookClient } = require('dialogflow-fulfillment')

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

/** Endpoint voor het opvragen van initieel skipper bericht. */
app.get('/chat/init', (req, res) => {
  dfAgent.sendTextMessageToDialogFlow('hallo', 'localhost')
    .then(answer => {
      res.json(answer)
    })
});

/** Endpoints voor het opvragen van sluis gerelateerde data. */
app.get('/apics/lock/:lockId', (req, res) => {

  
  res.json(lock);

});

app.get('/apics/locks', (req, res) => {

  //get all locks of antwerp
 request.get('https://apps-dev.portofantwerp.com/apics-apica/api/v1/chatbot/apics/locks').then(locks => {
    res.json(locks);
  }).catch(e => {
    console.log(`getting locks failed, error: ${e}`);
    res.status(404);
  });
  

});

app.get('/apics/lockexecutions/:lockCode', (req, res) => {

  //get all lockexecutions for a lock by lockcode
  lockFulfiller.requestLockExecutions(req.params.lockCode).then( execs => {
    res.json(execs);
  }).catch(e => {

    console.log(`getting executions failed, error: ${e}`);
    res.status(404);

  })
  

});

app.get('/apics/lockexecution/:lockExecutionId', (req, res) => {

  // find lockexecution by id
  const lock = readJsonFromFile('./stubs/lockExecution.json');
  res.json(lock);

});

app.get('/apics/quay/:quaynumber', (req, res) => {
  //get quay details by quaynumber 
  const quay = readJsonFromFile('./stubs/quay.json');
  res.json(quay);
});



app.get('/apics/quays', (req, res) => {

// get 3 most recent available
  const quays = readJsonFromFile('./stubs/availableQuays.json');
  res.json(quays);
});

app.get('/apics/quays/:location', (req, res) => {

  //get all quays within a radius from a location
  const quays = readJsonFromFile('./stubs/availableQuays.json');
  res.json(quays);
});


/** Endpoint voor het opvragen van het getij adv locatie. */
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

//** Endpoint voor het opvragen van het getij adv geografische positie. */
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

/** Endpoint voor het opvragen van het nautisch weerbericht adv locatie. */
app.get('/forecast/location/:location', (req, res) => {
  try {
    nauticalFulfiller.respondWithNauticalWeatherForecastByLocation(req.params.location, 'all')
      .then(weatherData => {
        console.log(`returned weatherData: ${weatherData}`);
        const fc = nauticalFulfiller.createForecastObject(weatherData.hours[0]);
        fc.location = req.params.location
        res.send(fc)
      });
  } catch (err) {
    console.log(`get location went wrong error: ${err}`);
    res.json({
      location: "NA",
      visibility: "NA",
      windForce: "NA",
      windDirection: "NA",
      waterLevel: "NA"
    });
    

  }
});

/** Endpoint voor het opvragen van het nautisch weerbericht adv geografische positie. */
app.get('/forecast/position/:position', (req, res) => {
  console.log(`req text: ${req.params.position}`);
  const pos = req.params.position.split(",");
  try {
    nauticalFulfiller.respondWithNauticalWeatherForecastByPosition(pos, 'all')
      .then(weatherData => {
        console.log(`returned weatherData: ${weatherData.hours[0]}`);
        const fc = nauticalFulfiller.createForecastObject(weatherData.hours[0]);
        fc.location = "by position"
        res.send(fc)
       
      }, e => {
        console.log(`#respondWithNauticalWeatherForecastByPos.. error: ${e}`);
        res.send({
          location: "NA",
          visibility: "NA",
          windForce: "NA",
          windDirection: "NA",
          waterLevel: "NA"
        });
      });
  } catch (err) {
    console.log(`get forecast by position error: ${err}`);
    res.json({
      location: "NA",
      visibility: "NA",
      windForce: "NA",
      windDirection: "NA",
      waterLevel: "NA"
    });
  }
});

/** Endpoint voor het ontvangen van de chat input vanuit de Angular app. */
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


/** Endpoint voor het ontvangen van de fulfillment requests vanuit Dialogflow. */
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
    }, err => {
      agent.add(err);
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
    }).catch(e => {
      console.log(`#lockDetails error: ${e}`);
      agent.add(`Ophalen van de sluistoestand liep mis, probeer later nog eens. Sorry voor het ongemak.`);
    });
  }

  function allLocks(agent) {
    return lockFulfiller.requestAllLocks()
      .then(locks => {
        console.log(`request all locks response: ${locks}`);
        let text = lockFulfiller.formatLocks(locks);
        agent.add(`Alle sluizen in Antwerpen en hun statussen:\n ${text}`);
      }, er => console.log(er)).catch(err => agent.add(`Er is iets misgegaan bij het ophalen van de sluizen. Probeer later opnieuw!`));
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
      }, err => {
        agent.add(`Ik kan momenteel niet achterhalen welke sluizen er onbeschikbaar zijn. Probeer later opnieuw, mijn excuses!`);
      });
  }

  function executionDetails(agent) {
    let lock = agent.parameters.paramSluis;
    return lockFulfiller.requestLockExecutionDetail(lock).then(res => {
      agent.add(`Details voor de eerstvolgende schutting van ${lock}: ${res[0]}`)
    }, err => {
      console.log(`#executionDetails error: ${err}`);
      agent.add(`Ik kan de eerstvolgende schutting voor ${lock} momenteel niet ophalen. Mijn excuses!`);
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
      }, err => {
        console.log(`#respondWithQuayInfo error: ${err}`);
        agent.add(`Ik kon geen informatie opvragen over ${quaynr}. Wellicht bestaat het niet of is de informatie tijdelijk onbeschikbaar.`);
      })
  }


  function respondWithAvailableQuays(agent) {
    const location = agent.parameters.paramDok ? agent.parameters.paramDok : null;
    console.log(`responding with quays nearest to: ${location}`);
    return quayFulfiller.requestAvailableQuays(location)
      .then(res => {
        console.log(`#respondWithAvailableQuay: ${res}`);
        agent.add(`Volgende kaainummers zijn de komende 12u beschikbaar: \n\n ${res}`);
      }, err => {
        console.log(`#respondWithAvailableQuays`);
        agent.add(err);
      })
  }


  //todo: add option to clear message history on firestore

/** Intenties worden gekoppeld aan de functies dat dienen uitgevoerd te worden. */
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
