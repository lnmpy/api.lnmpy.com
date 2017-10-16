const GoogleAuth = require('google-auth-library');

function google(event, context, callback) {
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
  google,
};

module.exports = (event, context, callback) => {
  const serviceFunction = SERVICE_MAPPING[event.pathParameters.service] || serviceNotFound;
  event.body = JSON.parse(event.body);
  return serviceFunction(event, context, callback);
};
