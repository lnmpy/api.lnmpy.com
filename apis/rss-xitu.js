const request = require('superagent');
const xml2js = require('xml2js');

const parseString = xml2js.parseString;
const builder = new xml2js.Builder({
  allowSurrogateChars: true,
});


function returnResponse(error, content, callback) {
  const statusCode = (error && error.statusCode) || 200;
  callback(null, {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/xml; charset=utf-8',
    },
    body: content,
  });
}

module.exports = (event, context, callback) => {
  const category = (event.pathParameters && event.pathParameters.category) || '';

  request.get('http://gold.xitu.io/rss')
    .then(response => response.text)
    .then((data) => {
      parseString(data, (err, content) => {
        if (category) {
          const newItem = content.rss.channel[0].item.filter(ele => ele.category[0] === category);
          content.rss.channel[0].item = newItem;
          content.rss.channel[0].title = `${content.rss.channel[0].title} - ${category}`;
        }
        returnResponse(err, builder.buildObject(content), callback);
      });
    });
};
