import { brotliCompressSync, gzipSync } from 'zlib'
import axios from 'axios'
import YAML from 'yaml'

const SUBCONVERTERS = [
  'api.suda-cdn.com',
  'api.dler.io',
  'api.nexconvert.com',
  'limbopro.cyou'
]

const GITHUB_REPOS_API = axios.create({
  baseURL: 'https://api.github.com/repos/',
  headers: { 'authorization': 'Bearer ' + process.env.GITHUB_REPOS_API_KEY }
})

async function raw_url(path) {
  const parts = path.split('/').filter(x => x)
  if (parts.length < 4) throw new SCError('raw 路径错误')
  const repo = parts[0] + '/' + parts[1]
  const [sha, i] = await GITHUB_REPOS_API(`${repo}/git/refs/heads/${parts[2]}`)
    .catch(e => {
      if (e.response?.status === 404)
        return GITHUB_REPOS_API(`${repo}/git/refs/tags/${parts[2]}`)
      throw e
    })
    .then(({ data }) => {
      if (!Array.isArray(data)) return [data.object.sha, 3]
      for (const item of data) {
        const ref_parts = item.ref.split('/')
        if (ref_parts.length >= parts.length) continue
        for (let i = 3;; ++i) {
          if (i >= ref_parts.length) return [item.object.sha, i]
          if (ref_parts[i] !== parts[i]) break
        }
      }
      throw new Error()
    })
    .catch(() => {
      return [parts[2], 3]
    })
  return `https://raw.githubusercontent.com/${repo}/${sha}/${parts.slice(i).join('/')}`
}

const DEFAULT_SEARCH_PARAMS = [
  ['target', () => 'clash'],
  ['udp', () => 'true'],
  ['scv', () => 'true'],
  ['config', () => raw_url('zsokami/ACL4SSR/main/ACL4SSR_Online_Full_Mannix.ini')],
  ['url', () => raw_url('zsokami/sub/main/trials_providers/All.yaml')]
]

const HEADER_KEYS = new Set(['content-type', 'content-disposition', 'subscription-userInfo', 'profile-update-interval'])

class SCError extends Error {}

Object.getPrototypeOf(YAML.YAMLMap).maxFlowStringSingleLineLength = Infinity

function remove_redundant_groups (clash) {
  const y = YAML.parseDocument(clash, { version: '1.1' })
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
        const g = name_to_g[name_v]
        if (g !== undefined) {
          if (!(name_v in vis)) {
            vis[name_v] = -1
            vis[name_v] = dfs(g.get('proxies').items)
          } else if (vis[name_v] === -1) {
            throw new SCError(`循环引用 ${name_v}`)
          }
          if (!vis[name_v]) continue
        }
        names[i++] = name
      }
      names.splice(i)
      return i > 1 || (i === 1 && names[0].value !== 'DIRECT')
    })(names)

    if (names.length < gs.length) {
      names.forEach((name, i) => (gs[i] = name_to_g[name]))
      gs.splice(names.length)
      const rules = y.get('rules')?.items
      if (rules) {
        for (const rule of rules) {
          const parts = rule.value.split(',')
          if (vis[parts[2]] === false) {
            parts[2] = 'DIRECT'
            rule.value = parts.join(',')
          }
        }
      }
    }
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
    ;(init.headers ??= {})['content-encoding'] = ce
    delete init.headers['content-length']
    return new Response(fn(data), init)
  }
}

export default wrap(async (req, context) => {
  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/')
    if (path[1].includes('.')) {
      url.host = path.splice(1, 1)[0]
      url.pathname = path.join('/')
    } else {
      url.host = SUBCONVERTERS[(Math.random() * SUBCONVERTERS.length) | 0]
    }
    if (!path[1]) url.pathname = 'sub'
    if (url.pathname === '/sub')
      for (const [k, v] of DEFAULT_SEARCH_PARAMS)
        if (!url.searchParams.get(k)) url.searchParams.set(k, await v())
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
    return { data, status, headers: Object.fromEntries(Object.entries(headers).filter(h => HEADER_KEYS.has(h[0]))) }
  } catch (e) {
    const response = e?.response
    if (response) {
      const { status, data } = response
      return { data, status }
    }
    return { data: String(e), status: e instanceof SCError ? 400 : 500 }
  }
})

export const config = {
  path: '/*'
}