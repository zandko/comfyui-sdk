import type PQueue from 'p-queue'
import type { ComfyUIClient } from './core/client'
import { LogLevel } from './logger'

/**
 * Configuration options for creating a ComfyUI client instance.
 */
export interface ClientOptions {
  /** Base URL of the ComfyUI server (no trailing slash). */
  baseUrl: string

  /** Optional API key for Bearer authentication. */
  apiKey?: string

  /** Per-request timeout in milliseconds. */
  timeout?: number

  /**
   * Polling configuration overrides:
   *  - interval: initial delay between polls (ms)
   *  - backoffBase: base for exponential backoff (ms)
   *  - backoffCap: maximum backoff delay (ms)
   */
  poll?: {
    /** Initial polling interval in milliseconds. */
    interval?: number
    /** Base delay for exponential backoff in milliseconds. */
    backoffBase?: number
    /** Maximum delay for exponential backoff in milliseconds. */
    backoffCap?: number
  }

  /** Whether to enable internal logging. */
  logging?: boolean

  /** Minimum log level to emit when logging is enabled. */
  logLevel?: LogLevel
}


/**
 * Arbitrary payload representing a workflow definition.
 * Keys map to node identifiers or parameters, values are inputs.
 */
export type WorkflowPayload = Record<string, unknown>

/**
 * Response from the queue endpoint when submitting a workflow.
 */
export interface QueueOutput {
  /** Unique identifier of the queued prompt. */
  prompt_id: string
}

/**
 * Options for controlling file uploads.
 */
export interface UploadOptions {
  /** Whether to overwrite an existing file. */
  override?: boolean
  /** Subfolder on the server in which to place the file. */
  subfolder?: string
  /** Desired filename to use when uploading. */
  filename?: string
}

/**
 * Metadata returned after a successful file upload.
 */
export interface UploadOutput {
  /** Name under which the file was stored. */
  name: string
  /** Subfolder in which the file was placed. */
  subfolder: string
}

/**
 * Detailed record of a single prompt’s history entry.
 */
export interface History {
  /** Original prompt data sent to the server. */
  prompt: unknown[]
  /** Raw outputs returned from each node in the workflow. */
  outputs: Record<string, unknown>
  /** Status information for the prompt execution. */
  status: {
    /** Status string (e.g. "completed", "error"). */
    status_str: string
    /** Whether the workflow has finished. */
    completed: boolean
    /** Any messages or errors returned. */
    messages: unknown[]
  }
  /** Additional metadata about this history record. */
  meta: Record<string, unknown>
}

/**
 * Map of prompt IDs to their History records.
 */
export type Histories = Record<string, History>

/**
 * Manifest describing a binary artifact stored remotely.
 */
export interface BinaryManifest {
  /** Prompt identifier that generated this artifact. */
  promptId: string
  /** Source path or node key from which this artifact originated. */
  from: string
  /** Filename under which the binary is stored. */
  filename: string
  /** Optional subfolder on the server containing the binary. */
  subfolder?: string
  /** MIME type or category string for this binary. */
  type: string

  /** Additional arbitrary metadata fields. */
  [k: string]: unknown
}

/**
 * Manifest describing a text artifact.
 */
export interface TextManifest {
  /** Prompt identifier that generated this artifact. */
  promptId: string
  /** Source path or node key from which this artifact originated. */
  from: string

  /** Additional arbitrary metadata fields. */
  [k: string]: unknown
}

/**
 * Manifest describing a JSON artifact.
 */
export interface JsonManifest {
  /** Prompt identifier that generated this artifact. */
  promptId: string
  /** Source path or node key from which this artifact originated. */
  from: string

  /** Additional arbitrary metadata fields. */
  [k: string]: unknown
}

/**
 * Bus interface for passing data between pipeline nodes.
 */
export interface PipelineBus {}

/**
 * State of a pipeline node.
 */
export type PipelineState = Record<string, unknown> & Partial<PipelineBus>

/**
 * Artifact interface representing a processed data item
 */
// interface PipelineArtifact {
//   pipeline?: PipelineState
// }

/**
 * Artifact interface representing a processed data item.
 */
export type Artifact =
  | { kind: 'binary', payload: ArrayBuffer | Uint8Array | Buffer | Blob, manifest: BinaryManifest, pipeline?: PipelineState }
  | { kind: 'text', payload: string, manifest: TextManifest, pipeline?: PipelineState }
  | { kind: 'json', payload: unknown, manifest: JsonManifest, pipeline?: PipelineState }

// type FileKind = 'image' | 'audio' | 'video' | 'binary';

/**
 * Lease representing exclusive access to a ComfyUIClient instance.
 */
export interface ClientLease {
  /** The client instance to use for requests. */
  readonly client: ComfyUIClient
  /** Task queue to serialize requests for this client. */
  readonly queue: PQueue
  /** Callback to release the lease and decrement active session count. */
  release: () => void
}

/**
 * Configuration for a pool node, extending client options
 * with an optional concurrency limit.
 */
export interface PoolNodes extends Omit<ClientOptions, 'logging' | 'logLevel'> {
  /** Maximum number of concurrent sessions for this node. */
  maxConcurrency?: number
}

/**
 * Options for configuring a ComfyUI client pool.
 */
export interface PoolOptions {
  /** Whether to enable pool-level logging. */
  logging?: boolean
  /** Minimum log level to emit for pool messages. */
  logLevel?: LogLevel
}

/**
 * Metrics reflecting the current state of a pool node.
 */
export interface PoolMetrics {
  /** Index of the node in the pool. */
  index: number
  /** Current number of active sessions. */
  currentSessions: number
  /** Configured maximum concurrency. */
  maxConcurrency: number
  /** Whether the node can accept additional sessions. */
  available: boolean
}

/**
 * Descriptor for a single node input mapping.
 */
export interface NodeInput {
  /** Source key in the workflow payload. */
  from: string
  /** Parameter name expected by the node implementation. */
  to: string
  /** JSON Schema for validating this input. */
  schema?: JSONSchema
  /** Whether this input is mandatory. */
  required?: boolean
  /** Whether to expose this input in generated UI/config. */
  expose?: boolean
  /** Default value to use if none is provided. */
  defaultValue?: unknown
}

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONObject
  | JSONValue[]
export interface JSONObject { [k: string]: JSONValue }
export interface JSONSchema {
  type?: string | string[]
  properties?: Record<string, JSONSchema>
  items?: JSONSchema | JSONSchema[]
  required?: string[]
  enum?: (string | number)[]
  format?: string
  oneOf?: JSONSchema[]
  allOf?: JSONSchema[]
  anyOf?: JSONSchema[]
  additionalProperties?: boolean | JSONSchema
  [k: string]: any
}

/**
 * Descriptor for a single node input mapping.
 */
export interface NodeInput {
  /** Source key in the workflow payload. */
  from: string
  /** Parameter name expected by the node implementation. */
  to: string
  /** JSON Schema for validating this input. */
  schema?: JSONSchema
  /** Whether this input is mandatory. */
  required?: boolean
  /** Whether to expose this input in generated UI/config. */
  expose?: boolean
  /** Default value to use if none is provided. */
  defaultValue?: unknown
}

/**
 * Descriptor for a single node output mapping.
 */
export interface NodeOutput {
  /** Key under which the node implementation returns its result. */
  from: string
  /** Property name to expose on the resulting Artifact map. */
  to: string
  /** Default value if the node produces no output. */
  defaultValue?: unknown
}

/**
 * Definition of a pipeline node’s input and output schema.
 *
 * @template TOutputs - Array of NodeOutput descriptors.
 * @template TInputs - Array of NodeInput descriptors.
 */
export interface PipelineNode<
  TOutputs extends readonly NodeOutput[] = readonly NodeOutput[],
  TInputs extends readonly NodeInput[] = readonly NodeInput[],
> {
  inputs?: TInputs
  outputs?: TOutputs
}

/**
 * Infers the return payload type based on NodeOutput descriptors.
 *
 * - If no outputs are defined, returns Artifact[].
 * - Otherwise, returns an object mapping `to` keys to Artifact.
 */
export type InferOutputType<TOutputs extends readonly NodeOutput[]> =
  TOutputs extends readonly []
    ? Artifact[]
    : {
        [K in TOutputs[number]['to']]: Artifact
      }
/**
 * Infers the input object shape based on NodeInput descriptors.
 *
 * - Required inputs become mandatory properties.
 * - Optional inputs become optional properties.
 */
export type InferInputType<TInputs extends readonly NodeInput[]> =
  TInputs extends readonly []
    ? Record<string, unknown>
    : {
      [K in TInputs[number] as K['required'] extends true ? K['from'] : never]: unknown
    } & {
      [K in TInputs[number] as K['required'] extends true ? never : K['from']]?: unknown
    }


/**
 * Options for running a pipeline node:
 *  - node: schema describing inputs/outputs
 *  - inputs: values to supply for the defined inputs
 */
export interface RunOptions<TNode extends PipelineNode = PipelineNode> {
  node?: TNode
  inputs?: TNode extends PipelineNode<any, infer TInputs>
    ? TInputs extends readonly NodeInput[]
      ? InferInputType<TInputs>
      : Record<string, unknown>
    : Record<string, unknown>
}
