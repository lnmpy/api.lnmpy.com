const request = require('superagent');
const Utils = require('../utils');
const SECRET = require('../.secret').circle_ci;

const CIRCLE_TOKEN = SECRET.token;

function ciZoe(event, context, callback) {
  request.post('https://circleci.com/api/v1.1/project/github/elvis-macak/web-test/tree/master')
    .type('json')
    .accept('json')
    .query({ 'circle-token': CIRCLE_TOKEN })
    .send({ build_parameters: { ENV_NAME: 'prod' } })
    .then(response => response.body)
    .then((body) => {
      const data = {
        build_url: body.build_url,
        vcs_revision: body.vcs_revision,
        build_parameters: body.build_parameters,
      };
      return callback(null, {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(data),
      });
    });
}

const SERVICE_MAPPING = {
  zoe: ciZoe,
};

module.exports = (event, context, callback) => {
  const service = event.headers.Authorization === SECRET.authorization ? (SERVICE_MAPPING[event.pathParameters.service] || Utils.ServiceNotFound) : Utils.ServiceDenied;
  return service(event, context, callback);
};
