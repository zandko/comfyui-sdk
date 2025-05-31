import type { ClientLease, PoolMetrics, PoolNodes, PoolOptions } from '../types'
import PQueue from 'p-queue'
import { Logger, LogLevel } from '../logger'
import { ComfyUIClient } from './client'
import { ArtifactPipeline } from './pipeline'
import { ComfyUISession } from './session'

/**
 * Manages a pool of ComfyUIClient instances, distributing work across them
 * while respecting each node’s maximum concurrency.
 */
export class ComfyUIPool {
  private readonly log: Logger
  private readonly clients: ComfyUIClient[]
  private readonly queues: PQueue[]
  private readonly sessionCounts: number[]
  private readonly maxConcurrencies: number[]

  /**
   * Constructs a new ComfyUIPool.
   *
   * @param nodes - An array of node configurations for creating ComfyUIClient instances.
   * @param options - Optional pool settings:
   *   - logging: whether to enable log output
   *   - logLevel: minimum LogLevel to emit when logging is enabled
   * @throws {Error} If no nodes are provided.
   */
  constructor(nodes: PoolNodes[], options: PoolOptions = {}) {
    if (!nodes.length)
      throw new Error('Must configure at least one client')

    const { logging = false, logLevel = LogLevel.INFO } = options

    this.log = new Logger({
      namespace: 'ComfyUIPool',
      level: logging ? logLevel : LogLevel.NONE,
    })
    this.clients = nodes.map(o => new ComfyUIClient({
      ...o,
      logging,
      logLevel: logging ? logLevel : LogLevel.NONE,
    }))
    this.queues = nodes.map(
      o => new PQueue({ concurrency: o.maxConcurrency ?? 1 }),
    )
    this.sessionCounts = nodes.map(() => 0)
    this.maxConcurrencies = nodes.map(node => node.maxConcurrency ?? 1)

    this.log.info('Pool created', { nodes: nodes.length })
  }

  // private acquire(): ClientLease {
  //   let idx = -1
  //   let minLoad = Infinity
  //   for (let i = 0; i < this.sessionCounts.length; i++) {
  //     const curr = this.sessionCounts[i]!
  //     const limit = this.maxConcurrencies[i]!
  //     if (curr < limit && curr < minLoad) {
  //       minLoad = curr
  //       idx = i
  //     }
  //   }
  //   if (idx < 0) {
  //     return { success: false } as ClientLease
  //   }
  //   this.sessionCounts[idx]!++
  //   const release = () => {
  //     this.sessionCounts[idx]! = Math.max(0, this.sessionCounts[idx]! - 1)
  //   }
  //   return { success: true, client: this.clients[idx]!, queue: this.queues[idx]!, release }
  // }

  /**
   * Selects the least-loaded client that is still under its concurrency limit.
   *
   * Increments the session count for the chosen client and returns a lease
   * object containing the client, its queue, and a release callback.
   *
   * @returns A ClientLease object if a client is available; otherwise null.
   */
  private acquire(): ClientLease | null {
    let best = -1
    let bestRatio = 1
    for (let i = 0; i < this.clients.length; i++) {
      const ratio = this.sessionCounts[i]! / this.maxConcurrencies[i]!
      if (ratio < bestRatio && this.sessionCounts[i]! < this.maxConcurrencies[i]!) {
        bestRatio = ratio
        best = i
      }
    }
    this.sessionCounts[best]!++
    this.log.debug('Acquire', { index: best, sessions: this.sessionCounts[best] })

    return {
      client: this.clients[best]!,
      queue: this.queues[best]!,
      release: () => {
        this.sessionCounts[best]! = Math.max(0, this.sessionCounts[best]! - 1)
        this.log.debug('Release', { index: best, sessions: this.sessionCounts[best] })
      },
    }
  }

  /**
   * Creates a new ComfyUISession with an acquired client lease.
   *
   * @template T - Either ComfyUISession or null.
   * @param pipeline - Optional ArtifactPipeline to attach to the session.
   * @returns A new ComfyUISession, or null if no client was available.
   */
  createSession<T extends ComfyUISession | null = ComfyUISession | null>(pipeline?: ArtifactPipeline): T {
    const lease = this.acquire()
    if (!lease)
      return null as unknown as T
    return new ComfyUISession(lease, pipeline) as T
  }

  /**
   * Convenience helper to run a function using a pooled session.
   * Automatically acquires and releases the session.
   *
   * @template T - Return type of the provided function.
   * @param fn - Async function that receives a ComfyUISession.
   * @param pipeline - Optional ArtifactPipeline to attach to the session.
   * @returns The result of the function `fn`.
   * @throws {Error} If no clients are available in the pool.
   */
  async withSession<T>(
    fn: (s: ComfyUISession) => Promise<T>,
    pipeline?: ArtifactPipeline,
  ): Promise<T> {
    const session = this.createSession(pipeline)
    if (!session) {
      throw new Error('No available clients in pool - all clients have reached their concurrency limit')
    }
    try {
      return await fn(session as unknown as ComfyUISession)
    }
    finally {
      (session as unknown as ComfyUISession).close()
    }
  }

  /**
   * Retrieves current pool metrics for each client.
   *
   * @returns An array of PoolMetrics objects, each containing:
   *   - index: client index
   *   - currentSessions: active session count
   *   - maxConcurrency: configured concurrency limit
   *   - available: boolean indicating if client can accept more sessions
   */
  get metrics(): PoolMetrics[] {
    return this.clients.map((_, i) => ({
      index: i,
      currentSessions: this.sessionCounts[i]!,
      maxConcurrency: this.maxConcurrencies[i]!,
      available: this.sessionCounts[i]! < this.maxConcurrencies[i]!,
    }))
  }
}
