exports.ServiceNotFound = (event, context, callback) => {
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
};

exports.ServiceDenied = (event, context, callback) => {
  callback(null, {
    statusCode: 401,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      msg: `Resouce ${event.path} denied`,
    }),
  });
};

exports.SafeParseJson = (target, attr) => {
  if (typeof (target[attr]) === 'string') {
    target[attr] = JSON.parse(target[attr] || '{}');
  }
};
