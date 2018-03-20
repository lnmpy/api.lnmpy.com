exports.ServiceNotFound = function (event, context, callback) {
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

exports.ServiceDenied = function (event, context, callback) {
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
}

exports.SafeParseJson = function (target, attr) {
  if (typeof (target[attr]) === 'string') {
    target[attr] = JSON.parse(target[attr] || '{}');
  }
}
