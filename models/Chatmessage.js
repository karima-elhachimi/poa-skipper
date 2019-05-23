
module.exports = class Chatmessage {

  constructor ( intent, sender, text, timestamp) {
    this.intent = intent;
    this.sender = sender;
    this.text = text;
    this.timestamp = timestamp;
  }
}
