const request = require('superagent');
const Utils = require('../utils');
const SECRET = require('../.secret').notify;

function notifySlack(event, context, callback) {
  const attachment = {
    ...event.body,
    author_name: 'Lambda-JS',
    title: 'A simple Notification',
    text: 'FYI',
    color: '#36a64f',
  };
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

const SERVICE_MAPPING = {
  slack: notifySlack,
};

module.exports = (event, context, callback) => {
  Utils.SafeParseJson(event, 'body');
  const service = event.headers.Authorization === SECRET.authorization ? SERVICE_MAPPING[event.pathParameters.service] || Utils.ServiceNotFound : Utils.ServiceDenied;
  return service(event, context, callback);
};
