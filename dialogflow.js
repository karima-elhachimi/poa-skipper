'use strict'

const dialogflow = require('dialogflow');
const dotenv = require('dotenv').config();
const Chatmessage = require('./models/Chatmessage');

module.exports = class DialogFlow {
  constructor () {
    this.projectId = process.env.df_sessionid;

    let privateKey = process.env.df_private_key.replace(/\\n/g, '\n')
    let clientEmail = process.env.df_client_email
    let config = {
      credentials: {
        private_key: privateKey,
        client_email: clientEmail
      }
    }

    this.sessionClient = new dialogflow.SessionsClient(config)

    //console.log(`class DialogFlow: privateKey: ${privateKey}`);
  }


  //todo: trigger initial hello with payload options: https://dialogflow.com/docs/intents/rich-messages#custom_payload

  async sendTextMessageToDialogFlow(textMessage, sessionId) {
    // session path -> waarvoor dient dit?
    const sessionPath = this.sessionClient.sessionPath(this.projectId, sessionId);
    // The text query request.
    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: textMessage,
          languageCode: 'nl'
        }
      }
    }
    try {
      let responses = await this.sessionClient.detectIntent(request)
      console.log(`DialogFlow.sendTextMessageToDialogFlow: Detected intent is ${responses[0].queryResult.fulfillmentMessages[0].text.text[0]}`);
      return responses[0].queryResult;
    }
    catch(err) {
      console.error('DialogFlow.sendTextMessageToDialogFlow ERROR:', err);
      throw err
    }
  }

  createMessage(queryres) {
    let message = new Chatmessage(queryres.intent.displayName, 'bot', queryres.fulfillmentMessages[0].text.text[0], Date.now() );
    return message;
  }

  createUnpromptedWelcomeMessage(data){
    let message = this.createMessage(data);
    //todo: payload met opties toevoegen aan message voor weergave in skipper
  }
}
