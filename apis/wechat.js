const request = require('superagent');
const crypto = require('crypto');
const Dynasty = require('dynasty')({ region: 'ap-northeast-2' });
const Utils = require('../utils');
const SECRET = require('../.secret').wechat;

const ALGORITHM = 'aes-256-cbc';


function encrypt(data) {
  const cip = crypto.createCipher(ALGORITHM, SECRET.encrypt_key);
  return cip.update(data, 'binary', 'hex') + cip.final('hex');
}

function decrypt(data) {
  const decipher = crypto.createDecipher(ALGORITHM, SECRET.encrypt_key);
  return decipher.update(data, 'hex', 'binary') + decipher.final('binary');
}

function respHandler(callback, data, error) {
  const result = {
    code: error ? 400 : 200,
    data: error || data,
  };

  const response = {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(result),
  };
  callback(null, response);
}

function wechatUserAuth(event, context, callback) {
  const body = event.body;
  request.get('https://api.weixin.qq.com/sns/jscode2session')
    .query({ appid: SECRET.appid })
    .query({ secret: SECRET.secret })
    .query({ appgrant_type: 'authorization_code' })
    .query({ js_code: body.code })
    .then(rawResp => JSON.parse(rawResp.text))
    .then((resp) => {
      if (resp.errcode) {
        // {"errcode":40029,"errmsg":"invalid code, hints: [ req_id: zcXQ5a0973th23 ]"}
        respHandler(callback, null, 'Invalid auth code');
      } else {
        // eslint-disable-next-line
        // {"session_key":"dzKj+yc+D1mgcEFqmjF+Wg==","expires_in":7200,"openid":"ovCQA0WX2frXAhilabdkBW4At66U"}
        const timestamp = new Date().getTime();
        const user = {
          time_created: timestamp,
          time_updated: timestamp,
          time_deleted: 0,
        };
        const result = {
          token: encrypt(JSON.stringify({
            openid: resp.openid,
            expires: timestamp + (86400 * 7),
          })),
        };
        Dynasty.table('UserTable')
               .update(resp.openid, user)
               .then(() => respHandler(callback, result));
      }
    });
}

function wechatUserGet(event, context, callback) {
  try {
    const authToken = JSON.parse(decrypt(event.headers.AuthToken));
    if (authToken.expires < new Date().getTime()) {
      throw new Error('Token Expired');
    }
    Dynasty.table('UserTable')
      .find(event.pathParameters.openid)
      .then(resp => respHandler(callback, resp));
  } catch (e) {
    respHandler(callback, null, 'Invalid auth token');
  }
}

function wechatUserPost(event, context, callback) {
  try {
    Dynasty.table('UserTable')
      .find(event.pathParameters.openid)
      .then(resp => respHandler(callback, resp));
  } catch (e) {
    respHandler(callback, null, 'Invalid auth token');
  }
}

const SERVICE_MAPPING = {
  'POST /wechat/auth': wechatUserAuth,
  'GET /wechat/user/{openid}': wechatUserGet,
  'POST /wechat/user/{openid}': wechatUserPost,
};

module.exports = (event, context, callback) => {
  Utils.SafeParseJson(event, 'body');
  const service = event.headers.Authorization === SECRET.authorization ? SERVICE_MAPPING[`${event.httpMethod} ${event.resource}`] || Utils.ServiceNotFound : Utils.ServiceDenied;
  return service(event, context, callback);
};
