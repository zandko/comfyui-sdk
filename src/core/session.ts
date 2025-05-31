import type {
  Artifact,
  ClientLease,
  Histories,
  InferOutputType,
  NodeOutput,
  PipelineNode,
  QueueOutput,
  RunOptions,
  UploadOptions,
  UploadOutput,
  WorkflowPayload,
} from '../types'
import { ArtifactPipeline } from './pipeline'

/**
 * Represents a session bound to a specific ComfyUI client lease.
 * Allows running workflows, uploading files, and fetching history
 * within the context of the leased client, and ensures the lease
 * is released when the session is closed.
 */
export class ComfyUISession {
  private closed = false

  /**
   * Initializes a new ComfyUISession.
   * @param lease - The client lease containing the client instance,
   *                task queue, and release callback.
   * @param pipeline - Optional ArtifactPipeline to process raw artifacts.
   */
  constructor(
    private readonly lease: ClientLease,
    private readonly pipeline?: ArtifactPipeline,
  ) { }

  /**
   * Throws an error if the session has already been closed.
   * @private
   */
  private assertOpen() {
    if (this.closed)
      throw new Error('ComfyUISession already closed')
  }

  /**
   * Runs a workflow on the leased client, optionally processes the
   * generated artifacts through the configured pipeline, and returns
   * the final outputs.
   *
   * @template TNode - The type of pipeline node being executed.
   * @param workflow - The payload describing the workflow to run.
   * @param options - Optional run configuration specific to the node type.
   * @returns A promise resolving to:
   *   - If the pipeline outputs an array of NodeOutput, infers the
   *     correct output type via InferOutputType.
   *   - Otherwise, returns an array of Artifact.
   * @throws {Error} If the session is closed or no artifacts are returned.
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
    this.assertOpen()
    const artifacts = await this.lease.queue.add(() =>
      this.lease.client.run(workflow, options),
    )
    if (!artifacts)
      throw new Error('Generation failed')
    if (this.pipeline) {
      return this.pipeline.run(artifacts) as any
    }
    else {
      return artifacts as any
    }
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
    this.assertOpen()
    return this.lease.client.queue(workflow, options)
  }

  /**
   * Uploads a file (Buffer or Blob) via the leased client.
   *
   * @param data - The file data to upload.
   * @param options - Optional upload configuration.
   * @returns A promise resolving to UploadOutput metadata.
   * @throws {Error} If the session is closed.
   */
  async uploadFile(data: Buffer | Blob, options?: UploadOptions): Promise<UploadOutput> {
    this.assertOpen()
    return this.lease.client.uploadFile(data, options)
  }

  /**
   * Retrieves the history for a given prompt identifier.
   *
   * @param promptId - The identifier of the prompt whose history to fetch.
   * @returns A promise resolving to the Histories object.
   * @throws {Error} If the session is closed.
   */
  async getHistory(promptId: string): Promise<Histories> {
    this.assertOpen()
    return this.lease.client.getHistory(promptId)
  }

  /**
   * Closes the session and releases the underlying client lease.
   * Subsequent calls to session methods will throw an error.
   */
  close() {
    if (!this.closed) {
      this.closed = true
      this.lease.release()
    }
  }
}
