const { URL } = require('url')
const axios = require('axios')
const YAML = require('js-yaml')

exports.handler = async function ({ rawUrl }) {
  const url = new URL(rawUrl)
  url.host = 'api.dler.io'
  const { data } = await axios.get(url)
  const y = YAML.load(data, {json: true, strict: false})
  const y_str = YAML.dump(y, {flowLevel: 1})
  return {
    statusCode: 200,
    body: `${y}\n\n${y_str}`
  }
}
