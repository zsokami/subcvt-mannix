const { PythonShell } = require('python-shell')

exports.handler = async function (event, context) {
  return {
    statusCode: 200,
    body: await PythonShell.run('subcvt-mannix.py', {
      args: [event.rawUrl]
    })
  }
}
