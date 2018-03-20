const request = require('superagent');
const Utils = require('../utils');

const SECRET = require('../.secret').notify;
const client = require('twilio')(SECRET.twilio.sid, SECRET.twilio.auth_token);

function notifySlack(event, context, callback) {
  const attachment = Object.assign({
    author_name: 'Lambda-JS',
    title: 'A simple Notification',
    text: 'FYI',
    color: '#36a64f',
  }, event.body);
  request.post(SECRET.slack.notify_url)
    .type('json')
    .accept('json')
    .send({ attachments: [attachment] })
    .end();
  return callback(null, {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ status: 'success' }),
  });
}

function notifyTwilio(event, context, callback) {
  client.calls.create({
    url: 'http://demo.twilio.com/docs/voice.xml',
    to: `+86${event.pathParameters.to}`,
    from: '+13134258245',
  }, err => (
    callback(null, {
      statusCode: err ? 400 : 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(err || { status: 'success' }),
    })));
}

const SERVICE_MAPPING = {
  slack: notifySlack,
  call: notifyTwilio,
};

module.exports = (event, context, callback) => {
  Utils.SafeParseJson(event, 'body');
  const service = event.headers.Authorization === SECRET.authorization ? SERVICE_MAPPING[event.pathParameters.service] || Utils.ServiceNotFound : Utils.ServiceDenied;
  return service(event, context, callback);
};
