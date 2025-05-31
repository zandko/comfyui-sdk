import type { Artifact, NodeInput, NodeOutput, PipelineNode } from './types'

export type ExtractKey<T extends string> = T

export type ExtractOutputKeys<T extends readonly NodeOutput[]> = T[number]['to']

export type PreciseInferOutputType<TOutputs extends readonly NodeOutput[]> =
  TOutputs extends readonly []
    ? Artifact[]
    : {
        [K in ExtractOutputKeys<TOutputs>]: Artifact
      }
export type ExtractInputKeys<T extends readonly NodeInput[]> = T[number]['from']

export type PreciseInferInputType<TInputs extends readonly NodeInput[]> =
  TInputs extends readonly []
    ? Record<string, unknown>
    : {
      [K in TInputs[number] as K['required'] extends true ? K['from'] : never]: unknown
    } & {
      [K in TInputs[number] as K['required'] extends true ? never : K['from']]?: unknown
    }

export function createPipelineConfig<
  TInputs extends readonly { from: string, to: string, required?: boolean, defaultValue?: unknown }[],
  TOutputs extends readonly { from: string, to: string, defaultValue?: unknown }[],
>(config: {
  inputs?: TInputs
  outputs?: TOutputs
}): PipelineNode<TOutputs> {
  return config as PipelineNode<TOutputs>
}

export type ValidateInputs<
  TNode extends PipelineNode,
  TInputs extends Record<string, unknown>,
> = TNode extends PipelineNode<any>
  ? TNode['inputs'] extends readonly { from: infer K, required: true }[]
    ? K extends keyof TInputs
      ? TInputs
      : `Missing required input: ${K extends string ? K : never}`
    : TInputs
  : TInputs

export type CheckRequiredInputs<TNode extends PipelineNode> =
  TNode['inputs'] extends readonly { from: infer K, required: true }[]
    ? K extends string
      ? Record<K, unknown>
      : Record<string, never>
    : Record<string, never>

export function validateInputs<TNode extends PipelineNode>(
  node: TNode,
  inputs: Record<string, unknown>,
): inputs is CheckRequiredInputs<TNode> {
  if (!node.inputs)
    return true

  const requiredInputs = node.inputs.filter(input => input.required)
  const missingInputs = requiredInputs.filter(input => !(input.from in inputs))

  if (missingInputs.length > 0) {
    throw new Error(`Missing required inputs: ${missingInputs.map(i => i.from).join(', ')}`)
  }

  return true
}

/**
 * Defines a pipeline node configuration with strongly typed inputs and outputs.
 *
 * @template TConfig - The configuration shape, consisting of optional:
 *   • inputs: An array of input descriptors, each specifying:
 *       – from: source field name in the workflow payload
 *       – to: parameter name expected by the node implementation
 *       – required: whether this input must be provided (default: false)
 *       – defaultValue: value to use if none is provided
 *   • outputs: An array of output descriptors, each specifying:
 *       – from: key under which the node implementation returns its result
 *       – to: property name to expose on the PipelineNode output
 *       – defaultValue: value to use if the node produces no output
 *
 * @param config - The node configuration object with optional `inputs` and `outputs` arrays.
 * @returns A typed PipelineNode instance that enforces the specified input/output shapes.
 */
export function defineConfig<
  const TConfig extends {
    inputs?: readonly { from: string, to: string, required?: boolean, defaultValue?: unknown }[]
    outputs?: readonly { from: string, to: string, defaultValue?: unknown }[]
  },
>(config: TConfig): PipelineNode<
  TConfig['outputs'] extends readonly NodeOutput[] ? TConfig['outputs'] : readonly [],
  TConfig['inputs'] extends readonly NodeInput[] ? TConfig['inputs'] : readonly []
> {
  return config as any
}
