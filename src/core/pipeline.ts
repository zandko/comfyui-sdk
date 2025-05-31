import type { Artifact } from '../types'
import { isPlainObject } from 'lodash'
import { ArtifactProcessor } from '../processors/processor'
import { isArtifact } from '../utils'

export class ArtifactPipeline {
  /**
   * Constructs a new ArtifactPipeline.
   * @param processors - An ordered array of ArtifactProcessor instances.
   *                     Each processor may conditionally run on artifacts.
   */
  constructor(private readonly processors: ArtifactProcessor[] = []) { }

  /**
   * Traverses the provided artifacts structure (array or keyed object),
   * applying all configured processors to each Artifact encountered.
   *
   * @param artifacts - A list of Artifact objects or a mapping from string keys to Artifact.
   * @returns A promise that resolves to the same artifacts structure,
   *          with each artifact’s `pipeline` property populated with processor results.
   */
  async run(artifacts: Artifact[] | Record<string, Artifact>) {
    /**
     * Recursively walks the node, processing arrays, objects, and artifacts.
     *
     * @param node - The current node in the traversal.
     */
    const walk = async (node: unknown) => {
      if (Array.isArray(node)) {
        for (const x of node) await walk(x)
      }
      else if (isPlainObject(node)) {
        if (isArtifact(node)) {
          await this.processArtifact(node)
        }
        else {
          for (const v of Object.values(node as unknown as Record<string, unknown>)) await walk(v)
        }
      }
    }
    await walk(artifacts)
    return artifacts
  }

  /**
   * Applies each processor to a single Artifact if its `shouldRun` check passes
   * and the processor has not already been applied.
   *
   * Results of each processor are stored on artifact.pipeline under the processor’s name.
   *
   * @param artifact - The Artifact to process.
   */
  private async processArtifact(artifact: Artifact) {
    const state = artifact.pipeline ?? (artifact.pipeline = {})

    for (const processor of this.processors) {
      if (state[processor.name] || !(await processor.shouldRun(artifact)))
        continue
      const { output, next } = await processor.run(artifact)
      state[processor.name] = output

      if (next) {
        Object.assign(artifact, next)
      }
    }
  }
}
