
module.exports = class Forecast {
  location;

    constructor ( visibility,  windForce, windDirection, waterlevel, location) {
      this.visibility = visibility;
      this. windForce =  windForce;
      this.windDirection = windDirection;
      this.waterlevel = waterlevel;
      this.location = location;
    }
  }
  