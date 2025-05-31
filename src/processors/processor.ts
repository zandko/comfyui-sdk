import type { Artifact } from '../types'

/**
 * Abstract base class for processors that operate on Artifact objects.
 * Subclasses must provide a unique name and implement the processing logic.
 */
export abstract class ArtifactProcessor {
  /**
   * Unique name of the processor, used as the key in artifact.pipeline state.
   */
  abstract readonly name: string

  /**
   * Determines whether this processor should run on the given artifact.
   * Subclasses may override to add conditional logic.
   *
   * @param artifact - The Artifact to check.
   * @returns A promise resolving to true if the processor should run; false otherwise.
   * @default Always returns true.
   */
  async shouldRun(_artifact: Artifact): Promise<boolean> {
    return true 
  }


  /**
   * Executes the processing logic on the artifact.
   * Subclasses must implement this to produce their processing results.
   *
   * @param artifact - The Artifact to process.
   * @returns A promise resolving to a record of result values, keyed by this.name.
   */
  abstract run(artifact: Artifact): Promise<Record<string, unknown>>
}
