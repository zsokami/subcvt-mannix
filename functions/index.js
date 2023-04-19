const { URL } = require('url')
const axios = require('axios')

exports.handler = async function ({ rawUrl }) {
  const url = new URL(rawUrl)
  const path = url.pathname.split('/')
  if (path[1].includes('.')) {
    url.host = path.splice(1, 1)[0]
    url.pathname = path.join('/')
  } else {
    url.host = 'api.dler.io'
  }
  if (!path[1]) {
    url.pathname = 'sub'
  }
  
  const { data } = await axios.get(url)
  return {
    statusCode: 200,
    body: data
  }
}
