import { brotliCompressSync, gzipSync } from 'zlib'
import axios from 'axios'
import YAML from 'yaml'

const SUBCONVERTERS = [
  'api.dler.io',
]

const GITHUB_REPOS_API = axios.create({
  baseURL: 'https://api.github.com/repos/',
  headers: { 'authorization': 'Bearer ' + process.env.GITHUB_REPOS_API_KEY }
})

async function raw_url(path) {
  if (!Array.isArray(path)) path = path.split('/').filter(x => x)
  if (path.length < 4) throw new SCError('raw 路径错误')
  const repo = path[0] + '/' + path[1]
  const [sha, i] = await GITHUB_REPOS_API(`${repo}/git/refs/heads/${path[2]}`)
    .catch(e => {
      if (e.response?.status === 404)
        return GITHUB_REPOS_API(`${repo}/git/refs/tags/${path[2]}`)
      throw e
    })
    .then(({ data }) => {
      if (!Array.isArray(data)) return [data.object.sha, 3]
      for (const item of data) {
        const ref_parts = item.ref.split('/')
        if (ref_parts.length >= path.length) continue
        for (let i = 3;; ++i) {
          if (i >= ref_parts.length) return [item.object.sha, i]
          if (ref_parts[i] !== path[i]) break
        }
      }
      return [path[2], 3]
    })
    .catch(e => {
      if (e.response?.status === 404)
        return [path[2], 3]
      throw e
    })
  return `https://raw.githubusercontent.com/${repo}/${sha}/${path.slice(i).join('/')}`
}

const DEFAULT_SEARCH_PARAMS = [
  ['target', () => 'clash'],
  ['udp', () => 'true'],
  ['scv', () => 'true'],
  ['config', () => raw_url('zsokami/ACL4SSR/main/ACL4SSR_Online_Full_Mannix.ini')],
  ['url', () => raw_url('zsokami/sub/main/trials_providers/All.yaml')]
]

const HEADER_KEYS = new Set(['content-type', 'content-disposition', 'subscription-userinfo', 'profile-update-interval'])

class SCError extends Error {}

Object.getPrototypeOf(YAML.YAMLMap).maxFlowStringSingleLineLength = Infinity

function remove_redundant_groups (clash) {
  const y = YAML.parseDocument(clash, { version: '1.1' })
  const removed = new Set()
  const ps = y.get('proxies')?.items || []
  let i = 0
  for (const p of ps) {
    const uuid = p.get('uuid')
    if (uuid === undefined || /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(uuid)) {
      ps[i++] = p
    } else {
      removed.add(p.get('name'))
    }
  }
  ps.splice(i)
  const gs = y.get('proxy-groups')?.items
  if (gs) {
    const name_g_pairs = gs.map(g => [g.get('name'), g])
    const name_to_g = Object.fromEntries(name_g_pairs)
    const names = name_g_pairs.map(([name]) => name)
    const vis = {}
    ;(function dfs (names) {
      let i = 0
      for (const name of names) {
        const name_v = name.value ?? name
        if (removed.has(name_v)) continue
        const g = name_to_g[name_v]
        if (g !== undefined) {
          if (!(name_v in vis)) {
            vis[name_v] = -1
            if (!(vis[name_v] = dfs(g.get('proxies').items))) {
              removed.add(name_v)
              continue
            }
          } else if (vis[name_v] === -1) {
            throw new SCError(`循环引用 ${name_v}`)
          }
        }
        names[i++] = name
      }
      names.splice(i)
      return i > 1 || (i === 1 && names[0].value !== 'DIRECT')
    })(names)
    if (names.length < gs.length) {
      names.forEach((name, i) => (gs[i] = name_to_g[name]))
      gs.splice(names.length)
    }
  }
  if (removed.size) {
    const rules = y.get('rules')?.items || []
    let i = 0
    for (const rule of rules) {
      const v = rule.value
      if (!removed.has(v.substring(v.lastIndexOf(',') + 1))) {
        rules[i++] = rule
      }
    }
    rules.splice(i)
  }
  return y.toString({
    lineWidth: 0,
    indentSeq: false,
    flowCollectionPadding: false
  })
}

function wrap(handler) {
  return async (req, context) => {
    const { data = '', ...init } = await handler(req, context)
    const [ce, fn] = req.headers.get('accept-encoding')?.match(/\bbr\b(?!\s*;\s*q=0(?:\.0*)?(?:,|$))/i)
      ? ['br', brotliCompressSync] : ['gzip', gzipSync]
    init.headers = init.headers ? Object.fromEntries(Object.entries(init.headers).filter(h => HEADER_KEYS.has(h[0]))) : {}
    init.headers['content-encoding'] = ce
    return new Response(fn(data), init)
  }
}

export default wrap(async (req, context) => {
  try {
    const url = new URL(req.url)
    let suburlmatch = url.search.match(/[?&][^&=]*(:|%3A)/i)
    if (suburlmatch) {
      const sub = url.search.substring(suburlmatch.index + 1)
      url.search = url.search.substring(0, suburlmatch.index)
      url.searchParams.set('url', suburlmatch[1] === ':' ? sub : decodeURIComponent(sub))
    }
    const pathstr = url.pathname
    const path = pathstr.split('/').filter(x => x)
    if (path[0]?.includes('.') && !path[0].includes('%')) {
      url.host = path.shift()
    } else {
      url.host = SUBCONVERTERS[(Math.random() * SUBCONVERTERS.length) | 0]
    }
    if (!path.length) {
      url.pathname = 'sub'
    } else if (path[0] === 'r') {
      url.pathname = 'sub'
      path.shift()
      url.searchParams.set('url', await raw_url(path))
      if (!url.searchParams.get('filename') && !req.headers.get('accept')?.includes('text/html')) {
        const [fi, la] = [path[0], path[path.length - 1]]
        url.searchParams.set('filename', fi === la ? fi : fi + ' - ' + la)
      }
    } else if (suburlmatch = pathstr.match(/[^/]*(?::|%3A)(?:\/|%2F).*/i)) {
      url.pathname = 'sub'
      url.searchParams.set('url', decodeURIComponent(suburlmatch[0]))
    } else {
      url.pathname = path.join('/')
    }
    if (url.pathname === '/sub') {
      for (const [k, v] of DEFAULT_SEARCH_PARAMS) {
        if (!url.searchParams.get(k)) url.searchParams.set(k, await v())
      }
    }
    url.search = url.search.replace(/%2F/gi, '/')
    let { status, headers, data } = await axios.get(url.href, {
      headers: { 'user-agent': req.headers.get('user-agent') },
      responseType: 'text'
    })
    if (
      url.pathname === '/sub' &&
      url.searchParams.get('target') === 'clash' &&
      url.searchParams.get('list') !== 'true' &&
      url.searchParams.get('expand') !== 'false'
    ) {
      data = remove_redundant_groups(data)
    }
    return { data, status, headers }
  } catch (e) {
    const response = e?.response
    if (response) {
      let { status, headers, data } = response
      if (typeof data !== 'string') data = JSON.stringify(data)
      return { data, status, headers }
    }
    return { data: String(e), status: e instanceof SCError ? 400 : 500, headers: { 'content-type': 'text/plain;charset=utf-8' } }
  }
})

export const config = {
  path: '/*'
}