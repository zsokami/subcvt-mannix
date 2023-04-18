const { URL } = require('url')
const axios = require('axios')

exports.handler = async function (event, context) {
  const url = new URL(event.rawUrl)
  url.host = 'api.dler.io'
  return {
    statusCode: 200,
    body: `;${event.rawUrl}\n${(await axios.get(url)).data}`
  }
}
