const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies
const Utils = require('../utils');
const SECRET = require('../.secret').notify;

const dynamoDb = new AWS.DynamoDB.DocumentClient();

function POST(event, context, callback) {
  const timestamp = new Date().getTime();
  const data = event.body;
  if (typeof data.url !== 'string') {
    callback(null, {
      statusCode: 400,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Couldn\'t create the url item.',
    });
    return;
  }

  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Item: {
      id: Utils.RandomId(8),
      url: data.url,
      checked: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };

  // write the url to the database
  dynamoDb.put(params, (error) => {
    // handle potential errors
    if (error) {
      callback(null, {
        statusCode: error.statusCode || 501,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Couldn\'t create the url item.',
      });
      return;
    }

    // create a response
    const response = {
      statusCode: 200,
      body: JSON.stringify(params.Item),
    };
    callback(null, response);
  });
}

function LIST(event, context, callback) {
  if (event.headers.Authorization !== SECRET.authorization) {
    return Utils.ServiceDenied(event, context, callback);
  }
  const params = {
    TableName: process.env.DYNAMODB_TABLE,
  };

  // fetch all urls from the database
  dynamoDb.scan(params, (error, result) => {
    // handle potential errors
    if (error) {
      callback(null, {
        statusCode: error.statusCode || 501,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Couldn\'t fetch the urls.',
      });
      return;
    }

    // create a response
    const response = {
      statusCode: 200,
      body: JSON.stringify(result.Items),
    };
    callback(null, response);
  });
}

function GET(event, context, callback) {
  if (event.pathParameters == null) {
    return LIST(event, context, callback);
  }
  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      id: event.pathParameters.id,
    },
  };

  // fetch url from the database
  dynamoDb.get(params, (error, result) => {
    // handle potential errors
    if (error) {
      callback(null, {
        statusCode: error.statusCode || 501,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Couldn\'t fetch the url item.',
      });
      return;
    }
    if (result.Item == null) {
      Utils.ServiceNotFound(event, context, callback);
      return;
    }

    // create a response
    const response = {
      statusCode: 301,
      headers: {
        Location: result.Item.url,
      },
    };
    callback(null, response);
  });
}

function DELETE(event, context, callback) {
  if (event.headers.Authorization !== SECRET.authorization) {
    return Utils.ServiceDenied(event, context, callback);
  }
  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      id: event.pathParameters.id,
    },
  };

  // delete the url from the database
  dynamoDb.delete(params, (error) => {
    // handle potential errors
    if (error) {
      callback(null, {
        statusCode: error.statusCode || 501,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Couldn\'t remove the url item.',
      });
      return;
    }

    // create a response
    const response = {
      statusCode: 200,
      body: JSON.stringify({}),
    };
    callback(null, response);
  });
}

const SERVICE_MAPPING = {
  GET,
  POST,
  DELETE,
};

module.exports = (event, context, callback) => {
  const serviceFunction = SERVICE_MAPPING[event.httpMethod] || Utils.ServiceNotFound;
  event.body = JSON.parse(event.body);
  return serviceFunction(event, context, callback);
};
