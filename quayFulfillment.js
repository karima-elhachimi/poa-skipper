const ApicsRequest = require('./apicsRequestHandler');
const moment = require('moment');

module.exports = class QuayFulfillment extends ApicsRequest  {
    constructor(){
        super();
    }

    createQuayPath(quaynumber){
        return `/apics/quay/${quaynumber}`;
    }

    createQuaysPath(location){
        if(location)
            return `/apics/quays/${location}`;
        else    
            return `/apics/quays`;
    }

    requestAvailableQuays(location){
        let url = this.getFullUrl(this.createQuaysPath(location), this.apicsHost);
        return this.requestApiData(url)
        .then(res => {
            console.log(`#requestApicsData response: ${res}`);
            return this.formatAvailableQuay(res);
        })
        .catch(e => {
            console.log(`#requestApicsData couldn't get availableQuays. Error: ${e}`)
            return `Er is iets misgelopen, of er zijn geen beschikbare ligplaatsen gevonden. Probeer later opnieuw.`;
        });
    }

    requestQuayInformationById(quaynumber) {
        let url = this.getFullUrl(this.createQuayPath(quaynumber), this.apicsHost);
        return this.requestApiData(url).then(res => {
            console.log(`requestQuayInfo data response: ${res.quayNumber}`);
            return this.formatQuayInfo(res);
        })
        .catch(e => {
            console.log(`#requestQuayInformationById error: ${e}`);
            return `Gevraagde kaainummer kon niet worden herkend of bestaat niet. Excuses!`;
        });
    }
    
    formatQuayInfo(quay){
        let response =  `Kaainummer ${quay.quayNumber} `;
        let available = false;
        if(quay.status == 'available') {
            available = true
            response += `is beschikbaar van ${moment(quay.availableFrom).format('L, LTS')} tot ${moment(quay.availableTill).format('L, LTS')}`;
            response+= `\n\n Contacteer ${quay.contact} om een reservatie aan te vragen.`;
            
        } else {
            response += `is onbeschikbaar. Wil je dat ik een beschikbare ligplaats voor je zoek?`
        }
    
        return [response, available];
    }
    formatAvailableQuay(rawQuayData) {
        let response = '';
        rawQuayData.forEach(quay => {
            //todo: herformateren dat er gechecked wordt of er wel degelijk een beschikbaar van tot veld is
            const from = moment(quay.availableFrom).format('LTS');
            const till = moment(quay.availableTill).format('LTS')
            response += `\n\n  Kaainr: ${quay.quayNumber}, beschikbaar van ${from} tot ${till}. \nContact: ${quay.contact}`
        });
        response += `\n\nVergeet niet om een verantwoordelijke te contacteren om een reservatie te regelen.`
        return response;
    }



}