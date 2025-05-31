import type {
  Artifact,
  BinaryManifest,
  ClientOptions,
  Histories,
  InferOutputType,
  NodeInput,
  NodeOutput,
  PipelineNode,
  QueueOutput,
  RunOptions,
  UploadOptions,
  UploadOutput,
  WorkflowPayload,
} from '../types'
import { isPlainObject, isString } from 'lodash'
import { Logger, LogLevel } from '../logger'
import { request, requestArrayBuffer } from '../request'
import { applyNodeInputs, applyNodeOutputs, exponentialBackoff, isBinaryManifest, sleep, unwrapArtifacts } from '../utils'

/**
 * Client for interacting with a ComfyUI server instance.
 * Handles workflow submission, polling for results, file uploads,
 * and artifact retrieval with retry/backoff logic.
 */
export class ComfyUIClient {
  private static readonly POLL_DEFAULT_MS = 4_000
  private static readonly DEFAULT_TIMEOUT_MS = 90_000

  private readonly log: Logger

  private readonly timeoutMs: number
  private readonly baseUrl: string
  private readonly apiKey?: string
  private readonly pollCfg: Required<ClientOptions['poll']>

  /**
   * Constructs a new ComfyUIClient.
   *
   * @param options - Client configuration:
   *   - baseUrl: URL of the ComfyUI server
   *   - apiKey: optional API key for authenticated requests
   *   - timeout: per-request timeout in milliseconds (default: 90_000)
   *   - poll: optional polling overrides:
   *       • interval: initial poll interval (default: 4_000)
   *       • backoffBase: base milliseconds for exponential backoff (default: 2_000)
   *       • backoffCap: maximum backoff delay (default: 15_000)
   *   - logging: whether to enable internal debug/info logs (default: false)
   *   - logLevel: minimum LogLevel to emit when logging is enabled
   */
  constructor(options: ClientOptions) {
    const { logging = false, logLevel = LogLevel.INFO } = options

    this.log = new Logger({
      namespace: 'ComfyUIClient',
      level: logging ? logLevel : LogLevel.NONE,
    })

    this.timeoutMs = options.timeout ?? ComfyUIClient.DEFAULT_TIMEOUT_MS
    this.pollCfg = {
      interval: options.poll?.interval ?? ComfyUIClient.POLL_DEFAULT_MS,
      backoffBase: options.poll?.backoffBase ?? 2_000,
      backoffCap: options.poll?.backoffCap ?? 15_000,
    }
    // Remove any trailing slashes from the base URL
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.apiKey = options.apiKey
  }

  /**
   * Submits a workflow to the server and returns its outputs.
   *
   * @template TNode - The PipelineNode type specifying inputs/outputs.
   * @param workflow - The payload describing nodes and connections.
   * @param options - Optional run-time overrides:
   *   - node.inputs: specific node input overrides
   *   - inputs: values for those node inputs
   *   - node.outputs: output mapping to apply
   * @returns A promise resolving to:
   *   • Inferred node outputs if outputs schema provided
   *   • Otherwise, a flat array of Artifact
   * @throws {Error} If the prompt submission or generation fails.
   */
  async run<TNode extends PipelineNode>(
    workflow: WorkflowPayload,
    options?: RunOptions<TNode>,
  ): Promise<TNode extends PipelineNode<infer TOutputs>
      ? TOutputs extends readonly NodeOutput[]
        ? TOutputs extends readonly []
          ? Artifact[]
          : InferOutputType<TOutputs>
        : Artifact[]
      : Artifact[]> {
    const startTime = Date.now()

    // Apply node-specific input overrides if provided
    const preparedPayload = options?.node ? applyNodeInputs(workflow, options.node.inputs as NodeInput[], options?.inputs) : workflow

    this.log.debug('Prepared workflow', { prepared: preparedPayload })

    const { prompt_id } = await request<QueueOutput>(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prompt: preparedPayload }),
      timeout: this.timeoutMs,
    })

    // const prompt_id = 'cd2f2b02-4c2e-4ad0-b354-bfbfe02125a2'

    this.log.info('Workflow queued', { promptId: prompt_id })

    const rawOutputs = await this.pollUntilDone(prompt_id)
    const artifacts = unwrapArtifacts(rawOutputs) as Artifact[]

    this.log.info('Workflow finished', {
      promptId: prompt_id,
      artifacts: artifacts.length,
      durationMs: Date.now() - startTime,
    })

    return (options?.node?.outputs?.length
      ? applyNodeOutputs(artifacts, options.node.outputs)
      : artifacts) as any
  }

  /**
   * Queues a workflow for execution.
   *
   * @param workflow - The payload describing nodes and connections.
   * @param options - Optional run-time overrides:
   *   - node.inputs: specific node input overrides
   *   - inputs: values for those node inputs
   * @returns A promise resolving to the QueueOutput.
   */
  async queue(workflow: WorkflowPayload, options?: RunOptions): Promise<QueueOutput> {
    const preparedPayload = options?.node ? applyNodeInputs(workflow, options.node.inputs as NodeInput[], options?.inputs) : workflow
    this.log.debug('Prepared workflow', { prepared: preparedPayload })
    const response = await request<QueueOutput>(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prompt: preparedPayload }),
      timeout: this.timeoutMs,
    })
    this.log.info('Workflow queued', { promptId: response.prompt_id })
    return response
  }

  /**
   * Uploads a file (buffer or blob) to the server.
   *
   * @param file - The file data to upload.
   * @param options - Upload options:
   *   - override: whether to overwrite existing file (default: false)
   *   - subfolder: target folder on server (default: "uploaded")
   *   - filename: desired file name (default: "upload_<timestamp>")
   * @returns A promise resolving to metadata about the uploaded file.
   */
  async uploadFile(file: Buffer | Blob, options: UploadOptions = {}): Promise<UploadOutput> {
    const { override = false, subfolder = 'uploaded', filename = `upload_${Date.now()}` } = options
    const fd = new FormData()
    if (file instanceof Blob) {
      fd.append('image', file, filename)
    }
    else {
      const uint8view = new Uint8Array(file)
      const blob = new Blob([uint8view])
      fd.append('image', blob, filename)
    }
    fd.append('subfolder', subfolder)
    fd.append('override', String(override))

    this.log.debug('Uploading file', { filename, subfolder, override })

    const out = await request<UploadOutput>(`${this.baseUrl}/upload/image`, {
      method: 'POST',
      body: fd,
      headers: this.headers(),
      timeout: this.timeoutMs,
    })

    this.log.info('File uploaded', { filename: out.name, subfolder })
    return out
  }

  /**
   * Retrieves generation history for a given prompt identifier.
   *
   * @param promptId - The prompt identifier to query.
   * @returns A promise resolving to the Histories map.
   * @throws {Error} If the prompt record indicates an error status.
   */
  async getHistory(promptId: string): Promise<Histories> {
    this.log.debug('Fetching history', { promptId })

    const histories = await request<Histories>(`${this.baseUrl}/history/${promptId}`, {
      timeout: this.timeoutMs,
      headers: this.headers(),
    })

    const rec = histories[promptId]

    if (rec && rec.status?.status_str === 'error') {
      this.log.error('Prompt error', { promptId, messages: rec.status.messages })
      throw new Error(`Prompt ${promptId} failed: ${JSON.stringify(rec.status.messages || '{}')}`)
    }
    else {
      this.log.warn('No history found', { promptId })
    }

    return histories
  }

  /**
   * Polls the server until the generation completes and outputs are available.
   *
   * @param promptId - The prompt identifier to poll.
   * @returns A promise resolving to the raw outputs mapping of nodeId to artifacts array.
   */
  private async pollUntilDone(promptId: string): Promise<Record<string, Artifact[]>> {
    const pollStart = Date.now()
    let attempt = 0
    while (true) {
      const waitMs = exponentialBackoff(attempt, this.pollCfg!.interval, this.pollCfg!.backoffCap)
      this.log.debug('Polling', { promptId, attempt, waitMs })
      await sleep(waitMs)
      attempt++
      const histories = await this.getHistory(promptId)
      const rec = histories[promptId]

      if (rec?.status.completed && rec.outputs && Object.keys(rec.outputs).length) {
        const pollDuration = Date.now() - pollStart
        this.log.info('Polling completed', { promptId, attempts: attempt, durationMs: pollDuration })
        return this.extractArtifacts(rec.outputs, promptId)
      }
    }
  }

  /**
   * Downloads a binary resource based on its manifest entry.
   *
   * @param manifest - The BinaryManifest describing filename, type, and optional subfolder.
   * @returns A Buffer containing the downloaded bytes.
   */
  private async loadResourceBuffer(manifest: BinaryManifest): Promise<Buffer> {
    const url = new URL(`${this.baseUrl}/view`)
    url.searchParams.set('filename', manifest.filename)
    url.searchParams.set('type', manifest.type)
    if (manifest.subfolder)
      url.searchParams.set('subfolder', manifest.subfolder)
    this.log.debug('Downloading binary', {
      filename: manifest.filename,
      subfolder: manifest.subfolder,
      type: manifest.type,
    })
    const ab = await requestArrayBuffer(url, {
      headers: this.headers(),
      timeout: this.timeoutMs * 3,
    })
    return Buffer.from(ab)
  }

  /**
   * Constructs HTTP headers for requests, including Authorization if apiKey is set.
   *
   * @param extra - Additional headers to merge.
   * @returns A headers object for fetch.
   */
  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return this.apiKey ? { Authorization: `Bearer ${this.apiKey}`, ...extra } : extra
  }

  /**
   * Extracts Artifact arrays from the raw outputs map by walking leaves.
   *
   * @param outputs - Raw node outputs from the server.
   * @param promptId - Prompt identifier to include in artifact manifests.
   * @returns A promise resolving to a mapping from nodeId to Artifact array.
   */
  private async extractArtifacts(outputs: Record<string, unknown>, promptId: string): Promise<Record<string, Artifact[]>> {
    const entries = Object.entries(outputs)
    const pairs = await Promise.all(
      entries.map(async ([nodeId, nodeOut]) => {
        if (!isPlainObject(nodeOut)) {
          return [nodeId, [] as Artifact[]] as const
        }
        const leaves = [...this.walkLeaves(nodeOut, nodeId)]
        const artifacts = await Promise.all(leaves.map(leaf => this.leafToArtifact(leaf, promptId)))
        return [nodeId, artifacts] as const
      }),
    )
    return Object.fromEntries(pairs)
  }

  /**
   * Recursively yields leaf values and their source paths from a nested structure.
   *
   * @param node - Current node to inspect.
   * @param path - Path string indicating position in workflow (e.g., "nodeId.field").
   */
  private* walkLeaves(
    node: unknown,
    path: string,
  ): Generator<{ value: unknown, from: string }> {
    if (isBinaryManifest(node)) {
      yield { value: node, from: path }
    }
    else if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        yield* this.walkLeaves(node[i], `${path}[${i}]`)
      }
    }
    else if (isString(node)) {
      yield { value: node, from: path }
    }
    else if (isPlainObject(node)) {
      for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
        yield* this.walkLeaves(val, `${path}.${key}`)
      }
    }
  }

  /**
   * Converts a leaf descriptor into an Artifact, downloading binary data if needed.
   *
   * @param leaf - Object containing the raw value and its path.
   * @param promptId - The prompt identifier to attach to the artifact manifest.
   * @returns A promise resolving to an Artifact instance.
   */
  private async leafToArtifact(leaf: { value: unknown, from: string }, promptId: string): Promise<Artifact> {
    const { value, from } = leaf
    if (isBinaryManifest(value)) {
      const buffer = await this.loadResourceBuffer(value)
      return {
        kind: 'binary',
        payload: buffer,
        manifest: { ...value, from, promptId },
      }
    }
    return {
      kind: 'text',
      payload: String(value),
      manifest: { from, promptId },
    }
  }
}
