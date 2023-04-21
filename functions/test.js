exports.handler = async function ({ rawUrl, headers: reqHeaders }) {
  return {
    statusCode: 200,
    body: JSON.stringify(reqHeaders)
  }
}