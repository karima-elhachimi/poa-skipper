'use strict'

const functions = require('firebase-functions')
const { WebhookClient } = require('dialogflow-fulfillment')
const { Card, Suggestion } = require('dialogflow-fulfillment')
const admin = require('firebase-admin')
const https = require('https')
const axios = require('axios')
const URL = require('url')

const host = 'api.stormglass.io'
const stormGlassApi = '38116ef6-44b8-11e9-8f0d-0242ac130004-38117022-44b8-11e9-8f0d-0242ac130004'

process.env.DEBUG = 'dialogflow:debug' // enables lib debugging statements
admin.initializeApp()

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response })
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers))
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body))

  function welcome (agent) {
    agent.add(`Welcome to my agent!`)
  }

  function fallback (agent) {
    agent.add(`I didn't understand`)
    agent.add(`I'm sorry, can you try again?`)
  }

  function testing (agent) {
    return respondWithNauticalWeatherData(request, agent)
      .then(res => {
        console.log(`json parse data: ${JSON.stringify(res.data)}`)
        let text = JSON.parse(JSON.stringify(res.data.title))
        agent.add(text)
      }).catch(er => agent.add('soemthing went wrong'))
  }

  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map()
  intentMap.set('Default Welcome Intent', welcome)
  intentMap.set('Default Fallback Intent', fallback)
  intentMap.set('Nautisch.algemeen', testing)
  // intentMap.set('your intent name here', googleAssistantHandler);
  agent.handleRequest(intentMap)
})

function respondWithNauticalWeatherData (dfRequest, agent) {
  console.log('function respondWithNauticalWeatherData started')

  let city = dfRequest.body.queryResult.parameters['paramLocatie']
  	console.log(`city: ${city}`)
  agent.add(`Momentje, ik ben de nautische weergegevens voor ${city} aan het zoeken...`)
  let url = 'https://jsonplaceholder.typicode.com/posts/1'
  return axios.get(url, {
    headers: {
      'Content-Type': 'application/json'
    },
    data: {}
  })
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

function requestLatandLon (location) {
  // nog uitwerken met api call
  return ['51.260197', '4.402771']
}

function getFullUrl (url, host) {
  return new URL(url, host)
}

function createLatAndLongUrl (lat, lon, params) {
  return `/point?lat=${lat}&lng=${lon}&params=${params}`
}
