import axios from 'axios'

const REPOS_API = axios.create({
  baseURL: 'https://api.github.com/repos/',
  headers: { 'authorization': 'Bearer ' + process.env.GITHUB_REPOS_API_KEY },
  responseType: 'text'
})

export async function getCommit(repo, type = undefined, ref = undefined, path = undefined) {
  let url
  if (path && /[^/.]/.test(path)) {
    const { data: [item] } = await REPOS_API(`${repo}/commits`, {
      responseType: 'json',
      params: {
        sha: ref,
        path,
        per_page: 1
      }
    })
    if (!item) return undefined
    url = item.url
  } else {
    url = `${repo}/commits/${ref || 'HEAD'}`
  }
  const { data } = await REPOS_API(url, {
    responseType: type ? 'text' : 'json',
    headers: { 'accept': type && `application/vnd.github.${type}` }
  })
  return data
}

export async function getREADME(repo, ref = undefined) {
  const { data } = await REPOS_API(`${repo}/readme`, {
    headers: { 'accept': 'application/vnd.github.raw' },
    params: { ref }
  })
  return data
}

export async function getRaw(repo, path, ref = undefined) {
  if (ref && /^[\da-f]{40}$/i.test(ref)) {
    const { data } = await axios(`https://raw.githubusercontent.com/${repo}/${ref}/${path}`, {
      responseType: 'text'
    })
    return data
  }
  const { data } = await REPOS_API(`${repo}/contents/${path}`, {
    headers: { 'accept': 'application/vnd.github.raw' },
    params: { ref }
  })
  return data
}

export async function getRawURL(repo_or_path, path = undefined, ref = undefined) {
  if (path) {
    return `https://raw.githubusercontent.com/${repo_or_path}/${await getCommit(repo_or_path, 'sha', ref)}/${path}`
  }
  path = repo_or_path
  if (!Array.isArray(path)) path = path.split('/').filter(x => x)
  if (path.length < 4) throw new Error('raw file path error')
  const repo = path[0] + '/' + path[1]
  if (path[2].toUpperCase() === 'HEAD') {
    return `https://raw.githubusercontent.com/${repo}/${await getCommit(repo, 'sha')}/${path.slice(3).join('/')}`
  }
  const [sha, i] = await REPOS_API(`${repo}/git/refs/heads/${path[2]}`, { responseType: 'json' })
    .catch(e => {
      if (e.response?.status === 404)
        return REPOS_API(`${repo}/git/refs/tags/${path[2]}`, { responseType: 'json' })
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