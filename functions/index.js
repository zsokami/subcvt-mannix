const SUBCONVERTERS = [
  'api.suda-cdn.com',
  'api.dler.io',
  'api.nexconvert.com',
  'api.subcsub.com',
  'limbopro.cyou'
]

const DEFAULT_SEARCH_PARAMS = [
  ['target', 'clash'],
  ['udp', 'true'],
  ['scv', 'true'],
  ['config', 'https://raw.githubusercontent.com/zsokami/ACL4SSR/main/ACL4SSR_Online_Full_Mannix.ini'],
  ['url', 'https://raw.githubusercontent.com/zsokami/sub/main/trials_providers/All.yaml']
]

const { URL } = require('url')
const axios = require('axios')
const YAML = require('yaml')

Object.getPrototypeOf(YAML.YAMLMap).maxFlowStringSingleLineLength = Infinity

exports.handler = async function ({ rawUrl, headers: { 'user-agent': ua } }) {
  try {
    const url = new URL(rawUrl)
    const path = url.pathname.split('/')
    if (path[1].includes('.')) {
      url.host = path.splice(1, 1)[0]
      url.pathname = path.join('/')
    } else {
      url.host = SUBCONVERTERS[(Math.random() * SUBCONVERTERS.length) | 0]
    }
    if (!path[1]) url.pathname = 'sub'
    if (url.pathname == '/sub')
      for (const [k, v] of DEFAULT_SEARCH_PARAMS)
        if (!url.searchParams.get(k)) url.searchParams.set(k, v)
    url.search = url.search.replace(/%2F/gi, '/')
    let { status, headers, data } = await axios.get(url, {
      headers: { 'user-agent': ua }
    })
    if (
      url.pathname == '/sub' &&
      url.searchParams.get('target') == 'clash' &&
      url.searchParams.get('list') != 'true' &&
      url.searchParams.get('expand') != 'false'
    ) {
      data = remove_redundant_groups(data)
    }
    return {
      statusCode: status,
      headers,
      body: data
    }
  } catch (e) {
    const r = e?.response
    return r
      ? {
          statusCode: r.status,
          headers: r.headers,
          body: r.data
        }
      : {
          statusCode: e instanceof SCError ? 400 : 500,
          body: String(e)
        }
  }
}

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
        if (g != null) {
          if (!(name_v in vis)) {
            vis[name_v] = -1
            vis[name_v] = dfs(g.get('proxies').items)
          } else if (vis[name_v] == -1) {
            throw new SCError(`循环引用 ${name_v}`)
          }
          if (!vis[name_v]) continue
        }
        names[i++] = name
      }
      names.splice(i)
      return i > 1 || (i == 1 && names[0].value != 'DIRECT')
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

class SCError extends Error {}
