const axios = require('axios')

exports.handler = async ({ rawUrl }) => {
  return {
    statusCode: 200,
    body: await axios.get(new URL(rawUrl).origin + '/test.txt').then(r => r.data)
  }
}
