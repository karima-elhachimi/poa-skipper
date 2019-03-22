'use strict'

const dialogflow = require('dialogflow');
const dotenv = require('dotenv').config()

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

  async sendTextMessageToDialogFlow(textMessage, sessionId) {
    // Define session path
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
      console.log(`DialogFlow.sendTextMessageToDialogFlow: Detected intent is ${responses[0].queryResult.fulfillmentText}`);
      return responses[0];
    }
    catch(err) {
      console.error('DialogFlow.sendTextMessageToDialogFlow ERROR:', err);
      throw err
    }
  }
}
