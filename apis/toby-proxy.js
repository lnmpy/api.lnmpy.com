const request = require('superagent');

const TOBY_API_PREFIX = 'https://api.gettoby.com/v2';

module.exports = (event, context, callback) => {
  const req = request(event.httpMethod, TOBY_API_PREFIX + event.path.replace(/^.*toby/, ''))
    .set('Content-Type', 'application/json')
    .set('x-auth-token', event.headers.Authorization || '');
  if (event.body) {
    req.send(event.body);
  }
  req.on('error', (resp) => {
    callback(null, {
      statusCode: resp.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: resp.text,
    });
  }).then((resp) => {
    callback(null, {
      statusCode: resp.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: resp.text,
    });
  });
};
