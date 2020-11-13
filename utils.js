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

exports.RandomId = (length) => {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) { // eslint-disable-line no-plusplus
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

exports.SafeParseJson = (target, attr) => {
  if (typeof (target[attr]) === 'string') {
    target[attr] = JSON.parse(target[attr] || '{}');
  }
};
