export class Queue<T> {
  private readonly queue: T[]
  private offset = 0

  constructor(...items: T[]) {
    this.queue = items
  }

  get size(): number {
    return this.queue.length - this.offset
  }

  push(...items: T[]): void {
    this.queue.push(...items)
  }

  shift(): T | undefined {
    const { queue } = this
    if (!queue.length) return undefined
    let { offset } = this
    const first = queue[offset++]
    if (offset * 2 >= queue.length) {
      queue.splice(0, offset)
      offset = 0
    }
    this.offset = offset
    return first
  }

  first(): T | undefined {
    return this.queue[this.offset]
  }
}
