exports.handler = async function (event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify(event, null, 2),
  }
}