const path = require('path')
const fs = require('fs').promises



exports.handler = async () => {
  const body = {
    __dirname,
    'ls __dirname': await fs.readdir(__dirname).catch(e => e),
    'cwd': path.resolve(),
    'ls cwd': await fs.readdir('.').catch(e => e),
    '__dirname/..': path.dirname(__dirname),
    'ls __dirname/..': await fs.readdir(path.dirname(__dirname)).catch(e => e),
    'ls /': await fs.readdir('/').catch(e => e)
  }

  return {
    statusCode: 200,
    body: JSON.stringify(body)
  }
}
