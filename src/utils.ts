import type { Artifact, BinaryManifest, NodeInput, NodeOutput } from './types'
import { promisify } from 'node:util'
import { isPlainObject, isString, isUndefined, set } from 'lodash'

export const sleep = promisify(setTimeout)

export function isBinaryManifest(v: unknown): v is BinaryManifest {
  return (
    isPlainObject(v)
    && typeof (v as BinaryManifest).filename === 'string'
    && typeof (v as BinaryManifest).type === 'string'
  )
}

export function isArtifact(node: unknown): node is Artifact {
  return isPlainObject(node) && 'kind' in (node as unknown as Artifact) && 'payload' in (node as unknown as Artifact)
}

export function exponentialBackoff(attempt: number, base: number, cap: number) {
  return Math.min(base * 2 ** attempt, cap)
}

export function extractFileExtension(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') {
    throw new Error('Invalid input: fileName must be a non-empty string.')
  }
  const index = fileName.lastIndexOf('.')
  if (index === -1 || index === 0) {
    return ''
  }
  return fileName.substring(index + 1).toLowerCase()
}

export function unwrapArtifacts(outputs: Record<string, Artifact[]>): Artifact[] {
  return Object.values(outputs).flatMap(artifacts => artifacts)
}

export function applyNodeInputs<T extends object>(
  originalWorkflow: T,
  node: NodeInput[] = [],
  inputs: Record<string, unknown> = {},
): T {
  const cloned: T = typeof globalThis.structuredClone === 'function'
    ? structuredClone(originalWorkflow)
    : (JSON.parse(JSON.stringify(originalWorkflow)) as T)
  node.forEach(({ from, to, defaultValue }) => {
    const value = inputs[from] ?? defaultValue
    if (!isUndefined(value))
      set(cloned as unknown as object, to.split('.'), value)
  })
  return cloned
}

export function applyNodeOutputs(
  artifacts: Artifact [],
  outputs: readonly NodeOutput[],
) {
  const byFrom = new Map<string, Artifact>()
  for (const art of artifacts) {
    const from = art.manifest?.from
    if (isString(from))
      byFrom.set(from, art)
  }
  const response: Record<string, unknown> = {}
  outputs?.forEach(({ from, to, defaultValue }) => {
    const art = byFrom.get(from)
    const value = art ? art.payload : defaultValue
    if (!isUndefined(value))
      set(response, to.split('.'), { ...art, payload: value })
  })
  return response
}
