const axios = require('axios')

exports.handler = async function (event, context) {
  return {
    statusCode: 200,
    body: `;${event.rawUrl}\n${(await axios.get('https://dd.al/config')).data}`
  }
}
