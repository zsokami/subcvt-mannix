const { URL } = require('url')
const axios = require('axios')
const YAML = require('yaml')

exports.handler = async function ({ rawUrl }) {
  const url = new URL(rawUrl)
  url.host = 'api.dler.io'
  const { data } = await axios.get(url)
  const y = YAML.parseDocument(data)
  const y_str = y.toString()
  return {
    statusCode: 200,
    body: `${y}\n\n${y_str}`
  }
}
