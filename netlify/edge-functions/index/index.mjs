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
  const localhost = options['localhost']
  let rulesStr = ''
  if (localhost) {
    const i = clash.indexOf('\nrules:') + 1
    if (i > 0) {
      rulesStr = clash.substring(i)
      clash = clash.substring(0, i)
    }
  }
  const y = YAML.parseDocument(clash, { version: '1.1' })
  for (const k of ['type', 'type!', 'cipher', 'cipher!']) {
    options[k] && (options[k] = new RegExp(options[k]) && new RegExp(`^(?:${options[k]})$`))
  }
  for (const k of ['sni', 'server']) {
    if (options[k]) {
      options[k] = options[k].split(',').flatMap(x => {
        x = x.trim()
        if (!x) return []
        x = x.split('@')
        if (x.length === 1) x.unshift(/^/)
        else x[0] = new RegExp(x[0])
        x[1] = x[1].split('|')
        x[2] = 0
        return [x]
      })
    }
  }
  const {
    'type': re_type,
    'type!': re_type_not,
    'cipher': re_cipher,
    'cipher!': re_cipher_not,
    'sni': server_sni_pairs,
    'server': sni_server_pairs,
  } = options
  const removed = new Set()
  const ps = y.get('proxies')?.items || []
  let i = 0
  for (const p of ps) {
    const uuid = p.get('uuid')
    const type = p.get('type')
    const cipher = p.get('cipher')
    if (
      (uuid === undefined || /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(uuid))
      && (!re_type || re_type.test(type))
      && (!re_type_not || !re_type_not.test(type))
      && (!cipher || (
        (!re_cipher || re_cipher.test(cipher))
        && (!re_cipher_not || !re_cipher_not.test(cipher))
      ))
    ) {
      let v
      const sni = findSNIByServer(server_sni_pairs, p)
      const server = findServerBySNI(sni_server_pairs, p)
      if (server) {
        p.set('server', server)
      }
      switch (type) {
        case 'ss':
          if (sni && (v = p.get('plugin-opts'))) {
            handleSNI(v, 'host', sni)
          }
          break
        case 'ssr':
          handleSNI(p, 'obfs-param', sni)
          break
        case 'vmess':
        case 'vless':
          handleSNIAndHost(y, p, 'servername', sni)
          if ((v = p.get('network')) === 'h2' || v === 'grpc') {
            p.set('tls', true)
          }
          break
        case 'trojan':
          handleSNIAndHost(y, p, 'sni', sni)
          break
        case 'hysteria':
        case 'hysteria2':
          handleSNI(p, 'sni', sni)
          break
      }
      let grpc_service_name
      if (!localhost && (grpc_service_name = p.getIn(['grpc-opts', 'grpc-service-name'], true)) !== undefined) {
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
        if (!removed.has('⚡ ‍低延迟')) {
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
        }
        if (rm) {
          const gs_select = ['✈️ ‍起飞', '📺 ‍B站', '🤖 ‍AI']
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
  return y.toString({
    lineWidth: 0,
    indentSeq: false,
    flowCollectionPadding: false
  }) + rulesStr.replaceAll('\n  ', '\n')
}

function findSNIByServer(server_sni_pairs, p) {
  if (!server_sni_pairs) return undefined
  return findNextValueByKey(server_sni_pairs, p.get('server'))
}

function findServerBySNI(sni_server_pairs, p) {
  if (!sni_server_pairs) return undefined
  return findNextValueByKey(sni_server_pairs, getSNI(p))
}

function getSNI(p) {
  switch (p.get('type')) {
    case 'ss':
      return p.getIn(['plugin-opts', 'host'])
    case 'ssr':
      return p.get('obfs-param')
    case 'vmess':
    case 'vless':
      return p.get('servername') || p.getIn(['ws-opts', 'headers', 'Host'])
    case 'trojan':
      return p.get('sni') || p.getIn(['ws-opts', 'headers', 'Host'])
    case 'hysteria':
    case 'hysteria2':
      return p.get('sni')
  }
  return undefined
}

function findNextValueByKey(pairs, k) {
  for (const pair of pairs) {
    if (pair[0].test(k)) {
      const [_, arr, i] = pair
      pair[2] = (i + 1) % arr.length
      return arr[i]
    }
  }
  return undefined
}

function handleSNI(p, sniKey, sni) {
  if (sni) {
    if (sni === 'd') {
      p.delete(sniKey)
    } else {
      p.set(sniKey, sni)
    }
  }
}

function handleSNIAndHost(y, p, sniKey, sni) {
  let v
  if (sni) {
    if (v = p.get(sniKey, true)) {
      try {
        p.deleteIn(['ws-opts', 'headers'])
      } catch (ignored) {}
      if (sni === 'd') {
        p.delete(sniKey)
      } else {
        v.value = sni
      }
    } else if (v = p.get('ws-opts')) {
      if (sni === 'd') {
        v.delete('headers')
      } else {
        const headers = v.get('headers')
        if (headers) {
          headers.set('Host', sni)
        } else {
          v.set('headers', y.createNode({ 'Host': sni }))
        }
      }
    } else {
      if (sni !== 'd') {
        p.set(sniKey, sni)
      }
    }
  }
}

export default async (req, context) => {
  try {
    const startTime = Date.now()
    const url = new URL(req.url)
    url.search = url.searchParams
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
        for (const k of ['type', 'type!', 'cipher', 'cipher!', 'sni', 'server']) {
          options[k] = url.searchParams.get(k)
          url.searchParams.delete(k)
        }
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
