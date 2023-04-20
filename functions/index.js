const { URL } = require('url')
const axios = require('axios')
const YAML = require('yaml')

Object.getPrototypeOf(YAML.YAMLMap).maxFlowStringSingleLineLength = Infinity

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
  let { data } = await axios.get(url)
  if (
    url.pathname == '/sub' &&
    url.searchParams.get('target') == 'clash' &&
    url.searchParams.get('list') != 'true' &&
    url.searchParams.get('expand') != 'false'
  ) {
    data = remove_redundant_groups(data)
  }
  return {
    statusCode: 200,
    body: data
  }
}

function remove_redundant_groups (clash) {
  const doc = YAML.parseDocument(clash, { version: '1.1' })
  return doc.toString({ lineWidth: 0, indentSeq: false })
}
