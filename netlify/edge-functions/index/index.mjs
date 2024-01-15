import { domainToUnicode } from 'url'

import axios from 'axios'
import YAML from 'yaml'

import { getRawURL } from './github-api.mjs'
import { urlDecode, keep } from './utils.mjs'

const SUBCONVERTERS = [
  'c.7.cr',
]

const DEFAULT_SEARCH_PARAMS = [
  ['target', () => 'clash'],
  ['udp', () => 'true'],
  ['scv', () => 'true'],
  ['config', () => getRawURL('zsokami/ACL4SSR', 'ACL4SSR_Online_Full_Mannix.ini')],
  ['url', () => 'https://share.7.cr/base64']
]

const HEADER_KEYS = ['content-type', 'content-disposition', 'subscription-userinfo', 'profile-update-interval']

class SCError extends Error {}

Object.getPrototypeOf(YAML.YAMLMap).maxFlowStringSingleLineLength = Infinity

function cleanClash(clash, options = {}) {
  let rulesStr = ''
  if (options['localhost']) {
    const i = clash.indexOf('\nrules:') + 1
    if (i > 0) {
      rulesStr = clash.substring(i)
      clash = clash.substring(0, i)
    }
  }
  const y = YAML.parseDocument(clash, { version: '1.1' })
  console.time('in cleanClash')
  const re_type = options['type'] && new RegExp(`^(?:${options['type']})$`)
  const re_type_not = options['type!'] && new RegExp(`^(?:${options['type!']})$`)
  const removed = new Set()
  const ps = y.get('proxies')?.items || []
  let i = 0
  for (const p of ps) {
    const uuid = p.get('uuid')
    const type = p.get('type')
    if (
      (uuid === undefined || /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(uuid))
      && (!re_type || re_type.test(type))
      && (!re_type_not || !re_type_not.test(type))
    ) {
      const grpc_service_name = p.getIn(['grpc-opts', 'grpc-service-name'], true)
      if (grpc_service_name !== undefined) {
        try {
          grpc_service_name.value = urlDecode(grpc_service_name.value)
          if (grpc_service_name.type === 'PLAIN' && grpc_service_name.value.includes('?')) {
            grpc_service_name.type = 'QUOTE_DOUBLE'
          }
        } catch (ignored) {}
      }
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
      if (options['mannixConfig']) {
        let rm = false
        if (!removed.has('🇨🇳 ‍中国')) {
          const cn = name_to_g['🇨🇳 ‍中国'].get('proxies').items
          for (const k of ['🇭🇰 ‍香港', '🇹🇼 ‍台湾']) {
            if (!removed.has(k)) {
              const t = name_to_g[k].get('proxies').items
              if (cn.length === t.length) {
                removed.add('🇨🇳 ‍中国')
                removed.add('👆🏻🇨🇳 ‍中国')
                rm = true
              }
              break
            }
          }
        }
        const all = name_to_g['⚡ ‍低延迟'].get('proxies').items
        for (const k of ['🇭🇰 ‍香港', '🇹🇼 ‍台湾', '🇸🇬 ‍新加坡', '🇯🇵 ‍日本', '🇺🇸 ‍美国', '🎏 ‍其他']) {
          if (!removed.has(k)) {
            const t = name_to_g[k].get('proxies').items
            if (all.length === t.length) {
              removed.add(k)
              removed.add('👆🏻' + k)
              rm = true
            }
            break
          }
        }
        if (rm) {
          const gs_select = ['✈️ ‍起飞', '📺 ‍B站', '🤖 ‍OpenAI+Bing']
          let i = 0
          for (const name of names) {
            if (!removed.has(name)) {
              names[i++] = name
              if (gs_select.includes(name)) {
                const _names = name_to_g[name].get('proxies').items
                let j = 0
                for (const name of _names) {
                  if (!removed.has(name.value)) {
                    _names[j++] = name
                  }
                }
                _names.splice(j)
              }
            }
          }
          names.splice(i)
        }
      }
      names.forEach((name, i) => (gs[i] = name_to_g[name]))
      gs.splice(names.length)
    }
  }
  if (!(ps.length && options['mannixConfig']) && removed.size) {
    const rulesSeq = (rulesStr ? YAML.parseDocument(rulesStr, { version: '1.1' }) : y).get('rules')
    if (rulesSeq) {
      const rules = rulesSeq.items
      let i = 0
      for (const rule of rules) {
        if (!removed.has(rule.value.split(',')[2])) {
          rules[i++] = rule
        }
      }
      rules.splice(i)
      y.set('rules', rulesSeq)
      rulesStr = ''
    }
  }
  console.timeEnd('in cleanClash')
  return y.toString({
    lineWidth: 0,
    indentSeq: false,
    flowCollectionPadding: false
  }) + rulesStr.replaceAll('\n  ', '\n')
}

export default async (req, context) => {
  try {
    const startTime = Date.now()
    const url = new URL(req.url)
    const originalHost = url.host
    let suburlmatch = url.search.match(/[?&][^&=]*(:|%3A)/i)
    if (suburlmatch) {
      const sub = url.search.substring(suburlmatch.index + 1)
      url.search = url.search.substring(0, suburlmatch.index)
      url.searchParams.set('url', suburlmatch[1] === ':' ? sub : urlDecode(sub))
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
      url.searchParams.set('url', await getRawURL(path))
    } else if (suburlmatch = pathstr.match(/[^/]*(?::|%3A)(?:\/|%2F).*/i)) {
      url.pathname = 'sub'
      url.searchParams.set('url', urlDecode(suburlmatch[0]))
    } else {
      url.pathname = path.join('/')
    }
    const options = {}
    if (url.pathname === '/sub') {
      for (const [k, v] of DEFAULT_SEARCH_PARAMS) {
        if (!url.searchParams.get(k)) url.searchParams.set(k, await v())
      }
      if (/^https?:\/\/raw\.githubusercontent\.com\/zsokami\/ACL4SSR\/.*\/ACL4SSR_Online_(?:Full_)?Mannix\.ini/.test(url.searchParams.get('config'))) {
        options['mannixConfig'] = true
      }
      if (url.searchParams.get('target') === 'clash') {
        options['type'] = url.searchParams.get('type')
        options['type!'] = url.searchParams.get('type!')
        url.searchParams.delete('type')
        url.searchParams.delete('type!')
      }
      const suburl = url.searchParams.get('url')
      if (suburl && !url.searchParams.get('filename') && !req.headers.get('accept')?.includes('text/html')) {
        let m
        if (m = suburl.match(/^https?:\/\/raw\.githubusercontent\.com\/+([^/|]+)(?:\/+[^/|]+){2,}\/+([^/|]+)$/)) {
          url.searchParams.set('filename', m[1] === m[2] ? m[1] : m[1] + ' - ' + urlDecode(m[2]))
        } else if (m = suburl.match(/^(https?:\/\/raw\.githubusercontent\.com\/+([^/|]+))(?:\/+[^/|]+){3,}(?:\|+\1(?:\/+[^/|]+){3,})*$/)) {
          url.searchParams.set('filename', m[2])
        } else if (m = suburl.match(/^(https?:\/\/([^:/?#|]+))(?:[:/?#][^|]*)?(?:\|+\1(?:[:/?#][^|]*)?)*$/)) {
          url.searchParams.set('filename', domainToUnicode(m[2]))
        }
      }
    }
    url.search = url.search.replace(/%2F/gi, '/')
    console.log('prepare:', Date.now() - startTime)
    const subconverterStartTime = Date.now()
    let status, headers, data
    if (url.host === originalHost) {
      options['localhost'] = true
      const resp = await context.next(new Request(url, req))
      status = resp.status
      headers = Object.fromEntries(resp.headers)
      data = await resp.text()
      if (!resp.ok) {
        const e = new Error()
        e.response = { status, headers, data }
        throw e
      }
    } else {
      ({ status, headers, data } = await axios(url.href, { headers: { 'user-agent': req.headers.get('user-agent') }, responseType: 'text' }))
    }
    console.log('subconverter:', Date.now() - subconverterStartTime)
    if (
      url.pathname === '/sub' &&
      url.searchParams.get('target') === 'clash'
    ) {
      const cleanClashStartTime = Date.now()
      data = cleanClash(data, options)
      console.log('cleanClash:', Date.now() - cleanClashStartTime)
    }
    return new Response(data, { status, headers: keep(headers, ...HEADER_KEYS) })
  } catch (e) {
    const response = e?.response
    if (response) {
      let { status, headers, data } = response
      if (typeof data !== 'string') data = JSON.stringify(data)
      return new Response(data, { status, headers: keep(headers, 'content-type') })
    }
    return new Response(String(e), { status: e instanceof SCError ? 400 : 500, headers: { 'content-type': 'text/plain;charset=utf-8' } })
  }
}

export const config = {
  path: '/*'
}
