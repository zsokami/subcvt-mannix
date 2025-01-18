import { createClient, type RedisClientType } from 'https://esm.sh/redis@4.7.0'

import { Queue } from './queue.ts'

export type { RedisClientType }

let client: RedisClientType | null = null
let subClient: RedisClientType | null = null

const queueMap: Record<string, Queue<() => void>> = Object.create(null)

function create(tag: string) {
  return createClient({
    password: Deno.env.get('REDIS_CLOUD_PASSWORD'),
    socket: {
      host: 'redis-16595.c295.ap-southeast-1-1.ec2.redns.redis-cloud.com',
      port: 16595,
    },
  }).on('error', (e) => console.error(`Redis ${tag}`, e)) as RedisClientType
}

export async function connect(): Promise<RedisClientType> {
  if (client) return client
  console.log('Redis', 'connect', Deno.env.get('REDIS_CLOUD_PASSWORD'))
  client = create('client')
  await client.connect()
  return client
}

export async function connectSub(): Promise<RedisClientType> {
  if (subClient) return subClient
  console.log('Redis', 'connectSub', Deno.env.get('REDIS_CLOUD_PASSWORD'))
  subClient = create('subClient')
  await subClient.connect()
  return subClient
}

export async function lock(key: string): Promise<void> {
  const queue = queueMap[key]
  if (queue) {
    await new Promise<void>((resolve) => queue.push(resolve))
    return
  }
  queueMap[key] = new Queue()
  const client = await connect()
  const redisKey = `lock:${key}`
  const redisOptions = { NX: true, EX: 30 } as const
  if (await client.set(redisKey, '1', redisOptions) === 'OK') return
  const subClient = await connectSub()
  let resolve: () => void
  let promise = new Promise<void>((resolve_) => resolve = resolve_)
  const listener = () => resolve()
  await subClient.subscribe(redisKey, listener)
  try {
    for (;;) {
      if (await client.set(redisKey, '1', redisOptions) === 'OK') return
      await promise
      promise = new Promise((resolve_) => resolve = resolve_)
    }
  } finally {
    subClient.unsubscribe(redisKey, listener)
  }
}

export async function unlock(key: string): Promise<boolean> {
  const queue = queueMap[key]
  if (!queue) return false
  const resolve = queue.shift()
  if (resolve) {
    resolve()
    return true
  }
  delete queueMap[key]
  const client = await connect()
  const redisKey = `lock:${key}`
  const r = !!await client.del(redisKey)
  if (r) client.publish(redisKey, '1')
  return r
}

export function withLock<P extends unknown[], R>(key: string, f: (...args: P) => Promise<R>): (...args: P) => Promise<R> {
  return async (...args: P) => {
    await lock(key)
    try {
      return await f(...args)
    } finally {
      unlock(key)
    }
  }
}
