const request = require('superagent');
const GoogleAuth = require('google-auth-library');

function authGoogle(event, context, callback) {
  const auth = new GoogleAuth();
  const client = new auth.OAuth2(event.body.client_id,
                                 event.body.client_secret,
                                 event.body.redirect_uri);
  client.verifyIdToken(
    event.body.id_token,
    event.body.client_id,
    (e, login) => {
      callback(null, {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(login.getPayload()),
      });
    });
}

function calendarGoogle(event, context, callback) {
  const ics = event.queryStringParameters.ics;
  request.get(`https://calendar.google.com/calendar/ical/${ics}`)
    .set('Accept-Encoding', 'identity')
    .then((resp) => {
      callback(null, {
        statusCode: resp.status,
        headers: Object.assign({
          'Access-Control-Allow-Origin': '*',
        }, resp.headers),
        body: resp.text,
      });
    });
}


function serviceNotFound(event, context, callback) {
  callback(null, {
    statusCode: 404,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      msg: `Resouce ${event.path} not exist`,
    }),
  });
}

const SERVICE_MAPPING = {
  google: authGoogle,
  'auth-google': authGoogle,
  'calendar-google': calendarGoogle,
};

module.exports = (event, context, callback) => {
  const serviceFunction = SERVICE_MAPPING[event.pathParameters.service]
    || SERVICE_MAPPING[`${event.pathParameters.service}-${event.pathParameters.provider}`]
    || serviceNotFound;
  event.body = JSON.parse(event.body);
  return serviceFunction(event, context, callback);
};