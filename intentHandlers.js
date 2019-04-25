module.exports=  {

  createLatAndLongSearchParams : function (city) {
    return `/search?q=${city}&format=json&limit=1`
  },

  requestLatandLonData: function requestLatandLonData (location) {
    let url = getFullUrl(createLatAndLongSearchParams(location), nomiHost)

    return axios.get(url.toString())
      .then(res => {
        console.log(`lat lon response: ${JSON.parse(res.data[0].lat)}`)
        return [JSON.parse(res.data[0].lat), JSON.parse(res.data[0].lon)]
      })
  },

  requestNauticalWeatherData: function  (url) {
    console.log('creating axios request for ' + url)
    let config = {
      headers: {
        'Authorization': stormGlassApi,
        'Content-Type': 'application/json'
      }
    }
    return axios.get(url)
  },

  createNauticalSearchPath: function  (lat, lon, params) {
    return `/point?lat=${lat}&lng=${lon}&source=sg&params=${params}`
  },

  createNauticalParams: function  (...params) {
    let paramString
    for (let i = 0; i < params; i++) {
      paramString += `, ${params[i]}`
    }

    return params
  },

  respondWithNauticalWeatherData:function  (agent, req) {
    console.log('function respondWithNauticalWeatherData started')
    console.log(agent.parameters)
    let city = agent.parameters.paramLocatie
    console.log(`city: ${city}`)
    agent.add(`Momentje, ik ben de nautische weergegevens voor ${city} aan het zoeken...`)
    let latlon = []
    //eerst latitude en longitude ophalen
    return this.requestLatandLonData(city)
      .then(latlon => {
        //url samenstellen voor het zoeken
        let nauticalWeatherParams = 'airTemperature,windSpeed' //https://docs.stormglass.io/#point-request
        //todo: nautical weather params maken op basis van params uit df
        let path = createNauticalSearchPath(latlon[0], latlon[1], nauticalWeatherParams)

        let url = getFullUrl(path, stormglassHost).toString()
        return axios.get(url, {
          headers: {

            'Authorization': stormGlassApi,
            'Content-Type': 'application/json'
          }
        })
      })
  },

  formatWeatherForecast: function  (forecastData) {
    let temp = forecastData.airTemperature[0].value
    let wk = forecastData.windSpeed[0].value
    return `temperatuur: ${temp} graden celcius
          windkracht: ${wk} meter per seconde.
  `
  },

  getLockCode: function  (lockname) {
    //todo: uitwerken mapping tussen sluisnaam en sluidcode
    return `ZAS`
  },

  createGetLockExecutionsPath: function  (lockname) {
    let code = getLockCode(lockname)
    return `/apics/lockexecutions/${code}`
  },

  createGetLockExecutionPath: function  (executionId) {
    return `/apics/lockexecution/${executionId}`
  },

  createGetLocksPath: function  () {
    return `/apics/locks`
  },

  createGetLockPath: function  (lockCode) {
    return `/apics/lock/${lockCode}`
  },

  requestApicsData: function  (url) {
    console.log(`apics request url: ${url}`)
    return new Promise((resolve, reject) => {
      var options = {
        method: 'GET',
        url: url,
        headers:
          { 'cache-control': 'no-cache' }
      }

      request(options, function (error, response, body) {
        if (error) {
          throw new Error(error)
          reject(error)
        }
        console.log(body)
        resolve(body)
      })
    })
  },

  requestAllLocks: function () {
    let locksPath = createGetLocksPath()
    let url = getFullUrl(locksPath, apicsHost)
    return requestApicsData(url)
  },

  requestLockExecutions:function  (lock) {
    let lockExecutionsPath = createGetLockExecutionsPath(lock.lockCode)
    let url = getFullUrl(lockExecutionsPath, apicsHost)
    return requestApicsData(url)
  },

  formatLocks: function  (locks) {
    let format = ''

    locks = JSON.parse(locks)
    for (let i = 0; i < locks.length; i++) {
      format += `${locks[i].lockName} status: ${locks[i].status}\n`

    }
    console.log(format)
    return format
  }

}

