exports.handler = async function (ev) {
  return {
    statusCode: 200,
    body: JSON.stringify(ev)
  }
}
