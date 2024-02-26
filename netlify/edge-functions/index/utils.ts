export const b64Encode = (x: any) => Buffer.from(x ?? '').toString('base64')
export const b64EncodeUrlSafe = (x: any) => Buffer.from(x ?? '').toString('base64url')
export const b64Decode = (x: any) => Buffer.from(x ?? '', 'base64').toString()

export const urlEncode = (x: any) => encodeURIComponent(x ?? '')
export const urlDecode = (x: any): string => {
  x = String(x ?? '').replaceAll('+', ' ')
  try {
    x = decodeURIComponent(x)
  } catch (ignored) {}
  return x
}

export function pick<T extends { [k in string]: unknown }, K extends string>(o: T, ...keys: K[]) {
  const r = {} as Pick<T, K & keyof T>
  for (const k of keys) {
    const v = o[k]
    if (v !== undefined) r[k] = v
  }
  return r
}

export function * zip<T extends Iterable<unknown>[]>(...iterables: T) {
  if (iterables.length === 0) return []
  const iterators = iterables.map(x => x[Symbol.iterator]())
  for (;;) {
    const values = iterators.map(x => x.next())
    if (values.some(x => x.done)) break
    yield values.map(x => x.value) as { [K in keyof T]: T[K] extends Iterable<infer V> ? V : never }
  }
}

export const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

export function choice(bound?: number): number
export function choice<T>(arrayLike: ArrayLike<T>): T
export function choice<T>(boundOrArrayLike: number | ArrayLike<T> = Number.MAX_SAFE_INTEGER) {
  const isNumber = typeof boundOrArrayLike === 'number'
  let bound = isNumber ? boundOrArrayLike : boundOrArrayLike.length
  const result = Math.floor(Math.random() * bound)
  return isNumber ? result : boundOrArrayLike[result]
}

export function choices(bound?: number, n?: number): number[]
export function choices<T>(arrayLike: ArrayLike<T>, n?: number): T[]
export function choices<T>(boundOrArrayLike: number | ArrayLike<T> = Number.MAX_SAFE_INTEGER, n = 1) {
  const isNumber = typeof boundOrArrayLike === 'number'
  let bound = isNumber ? boundOrArrayLike : boundOrArrayLike.length
  if (!bound) return []
  const result = Array.from({ length: n }, () => Math.floor(Math.random() * bound))
  return isNumber ? result : result.map(i => boundOrArrayLike[i])
}

export function sample(bound?: number, n?: number): number[]
export function sample<T>(arrayLike: ArrayLike<T>, n?: number): T[]
export function sample<T>(boundOrArrayLike: number | ArrayLike<T> = Number.MAX_SAFE_INTEGER, n = 1) {
  const isNumber = typeof boundOrArrayLike === 'number'
  let bound = isNumber ? boundOrArrayLike : boundOrArrayLike.length
  if (n > bound) n = bound
  const m = new Map()
  while (n > 0) {
    const k = Math.floor(Math.random() * bound)
    --bound
    --n
    const v = m.get(k)
    if (v !== undefined) m.set(v, v)
    m.set(k, m.get(bound) ?? bound)
  }
  const result = [...m.keys()]
  return isNumber ? result : result.map(i => boundOrArrayLike[i])
}

/** 随机生成长度 8 ~ 10 由小写字母和数字拼接的字符串 */
export function randID() {
  const n = randInt(5, 9)
  return String.fromCodePoint(...choices(26, n).map(x => 97 + x))
    + randInt(10 ** Math.max(0, 7 - n), 10 ** Math.min(10 - n, 3) - 1)
}
