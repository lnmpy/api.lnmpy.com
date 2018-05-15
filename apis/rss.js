const request = require('superagent-charset')(require('superagent'));
const xml2js = require('xml2js');

const parseString = xml2js.parseString;
const builder = new xml2js.Builder({
  allowSurrogateChars: true,
});

function xitu(event, context, callback) {
  const category = event.pathParameters.args || '';
  request.get('https://juejin.im/rss')
    .then(response => response.text)
    .then((data) => {
      parseString(data, (err, content) => {
        if (category) {
          const newItem = content.rss.channel[0].item.filter(ele => ele.category[0] === category);
          content.rss.channel[0].item = newItem;
          content.rss.channel[0].title = `${content.rss.channel[0].title} - ${category}`;
        }
        callback(null, {
          statusCode: (err && err.statusCode) || 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/xml; charset=utf-8',
          },
          body: builder.buildObject(content),
        });
      });
    });
}

function newsmth(event, context, callback) {
  const board = event.pathParameters.args;
  request.get(`http://www.newsmth.net/nForum/rss/${board}`)
    .charset('GBK')
    .then(response => response.text)
    .then((data) => {
      parseString(data, (err, content) => {
        content.rss.channel[0].item = content.rss.channel[0].item
          .map((ele) => {
            ele.link = ele.link.map(u => u.replace('www.newsmth.net/nForum', 'm.newsmth.net'));
            ele.guid = ele.guid.map(u => u.replace('www.newsmth.net/nForum', 'm.newsmth.net'));
            ele.comments = ele.comments.map(u => u.replace('www.newsmth.net/nForum', 'm.newsmth.net'));
            return ele;
          });
        callback(null, {
          statusCode: (err && err.statusCode) || 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/xml',
          },
          body: builder.buildObject(content),
        });
      });
    });
}

function serviceNotFound(event, context, callback) {
  callback(null, {
    statusCode: 400,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'plain/text; charset=utf-8',
    },
    body: 'error',
  });
}

const SERVICE_MAPPING = {
  xitu,
  newsmth,
};

module.exports = (event, context, callback) => {
  const serviceFunction = SERVICE_MAPPING[event.pathParameters.provider]
    || serviceNotFound;
  event.body = JSON.parse(event.body);
  return serviceFunction(event, context, callback);
};
