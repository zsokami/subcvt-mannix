import { spawn } from 'child_process'

export default async (req, context) => {
  const subconverter_process = spawn('subconverter/subconverter')
  await new Promise(resolve => {
    subconverter_process.stderr.on('data', function listener(data) {
      if (data.includes('Startup completed')) {
        resolve()
        subconverter_process.stderr.off('data', listener)
      }
    })
  })
  const url = new URL(req.url)
  url.protocol = 'http:'
  url.host = '127.0.0.1:25500'
  const resp = await fetch(url, req)
  const data = await resp.arrayBuffer()
  subconverter_process.kill('SIGKILL')
  return new Response(data, resp)
}

export const config = {
  path: '/*'
}
