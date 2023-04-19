const { URL } = require('url')
const axios = require('axios')
const YAML = require('yaml')

exports.handler = async function ({ rawUrl }) {
  const url = new URL(rawUrl)
  url.host = 'api.dler.io'
  const { data } = await axios.get(url)
  const y = YAML.parse(data)
  const y_str = YAML.stringify(y)
  return {
    statusCode: 200,
    body: `${y}\n\n${y_str}`
  }
}
