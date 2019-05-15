const ApicsRequest = require('./apicsRequestHandler');

module.exports = class QuayFulfillment extends ApicsRequest  {
    constructor(){}

    requestQuayInformationById(quaynumber) {
        let url = this.getFullUrl(this.createQuayPath(quaynumber), this.apicsHost);
        return axios.get(url).then(res => {
            console.log(`requestQuayInfo data response: ${res}`);
            return this.formatQuayInfo(res);
        })     
    }

    formatAvailableQuay(rawQuayData) {
        let response = '';
        rawQuayData.forEach(quay => {
            //todo: herformateren dat er gechecked wordt of er wel degelijk een beschikbaar van tot veld is
            const from = moment(quay.availableFrom).format('L, LTS');
            const till = moment(quay.availableTill).format('L, LTS')
            response += `\n\nKaainr: ${quay.quayNumber}, beschikbaar van ${from} tot ${till}. \nContact: ${quay.contact}`
        });
        response += `\n\nVergeet niet om een verantwoordelijke te contacteren om een reservatie te regelen.`
        return response;
    }

    formatQuayInfo(rawQuay){
        let quay = JSON.parse(rawQuay);
        let response = [`Kaainummer ${quay.quayNumber}`, null];
        if(quay.status == 'available') {
            response[1] = true
            response[0] += `is beschikbaar van ${moment(quay.availableFrom).format('L, LTS')} tot ${moment(quay.availableTill).format('L, LTS')}`;
            response[0] += `\n\n Contacteer ${quay.contact} om een reservatie aan te vragen.`;
            
        } else {
            response[0] += `is onbeschikbaar. Wil je dat ik een beschikbare ligplaats voor je zoek?`
            response[1] = false;

            
        }
        return response;
    }

}