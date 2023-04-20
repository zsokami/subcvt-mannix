const axios = require('axios')

exports.handler = async () => {
  return {
    statusCode: 200,
    body: await axios.get('https://127.0.0.1/test.txt').then(r => r.data)
  }
}
