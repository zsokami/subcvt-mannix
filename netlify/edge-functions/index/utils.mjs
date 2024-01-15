export function urlDecode(x) {
  x = x?.replaceAll('+', ' ') ?? ''
  try {
    x = decodeURIComponent(x)
  } catch (ignored) {}
  return x
}

export function keep(o, ...keys) {
  const r = {}
  for (const k of keys) {
    const v = o[k]
    if (v !== undefined) r[k] = v
  }
  return r
}
