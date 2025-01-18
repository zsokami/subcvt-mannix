import { getStore, type Store } from "https://esm.sh/@netlify/blobs@8.1.0"
import { connect, type RedisClientType } from './redis.ts'

const _redis = await connect()

export class StoreWithRedis {
  name: string
  store: Store
  redis: RedisClientType
  redisOptions: { EX?: number }

  constructor(name: string, redis: RedisClientType = _redis, EX: number = 604800) {
    this.name = name
    this.store = getStore(name)
    this.redis = redis
    this.redisOptions = { EX }
  }

  async set(key: string, value: string | null): Promise<void> {
    if (value === null) {
      return await this.del(key)
    }
    await this.store.set(key, value)
    if (/^_*null$/.test(value)) {
      value = '_' + value
    }
    await this.redis.set(`${this.name}:${key}`, value, this.redisOptions)
  }

  async get(key: string): Promise<string | null> {
    let value = await this.redis.get(`${this.name}:${key}`)
    if (value === null) {
      value = await this.store.get(key, { consistency: 'strong' })
      if (value === null) {
        await this.redis.set(`${this.name}:${key}`, 'null', this.redisOptions)
        return null
      }
      if (/^_*null$/.test(value)) {
        value = '_' + value
      }
      await this.redis.set(`${this.name}:${key}`, value, this.redisOptions)
    }
    if (/^_*null$/.test(value)) {
      if (value === 'null') return null
      value = value.slice(1)
    }
    return value
  }

  async del(key: string): Promise<void> {
    await this.store.delete(key)
    await this.redis.set(`${this.name}:${key}`, 'null', this.redisOptions)
  }
}
