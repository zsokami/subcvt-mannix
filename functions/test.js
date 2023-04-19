let i = 0
exports.handler = async function () {
  return {
    statusCode: 200,
    body: ++i
  }
}
