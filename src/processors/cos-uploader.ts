import type { Artifact, BinaryManifest } from '../types'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join as joinPath } from 'node:path'
import COS from 'cos-nodejs-sdk-v5'
import { extractFileExtension } from '../utils'
import { ArtifactProcessor } from './processor'

export interface CosUploaderOptions {
  bucket: string
  region: string
  secretId?: string
  secretKey?: string
  prefix?: string
  sliceThreshold?: number
  sliceSize?: number
  domain?: string
  signExpires?: number
}

export class CosUploader extends ArtifactProcessor {
  readonly name = 'cosUploader'
  private readonly cos: COS

  constructor(private readonly options: CosUploaderOptions) {
    super()
    this.cos = new COS({ SecretId: options.secretId, SecretKey: options.secretKey })
  }

  async shouldRun(a: Artifact) {
    return a.kind === 'binary'
  }

  async run(artifact: Artifact) {
    const buffer = artifact.payload as Buffer
    const manifest = artifact.manifest as BinaryManifest

    const extension = extractFileExtension(manifest.filename)
    const Key = `${this.options.prefix}${manifest.promptId}_${Date.now()}.${extension}`

    if (buffer.length < (this.options.sliceThreshold ?? 0)) {
      await new Promise<void>((res, rej) =>
        this.cos.putObject(
          { Bucket: this.options.bucket, Region: this.options.region, Key, Body: buffer, ContentLength: buffer.length },
          err => err ? rej(err) : res(),
        ),
      )
    }
    else {
      const tmp = joinPath(tmpdir(), `cos_${randomUUID()}.${extension}`)
      await fs.writeFile(tmp, buffer)
      try {
        await new Promise<void>((res, rej) =>
          this.cos.uploadFile(
            { Bucket: this.options.bucket, Region: this.options.region, Key, FilePath: tmp, SliceSize: this.options.sliceSize },
            err => err ? rej(err) : res(),
          ),
        )
      }
      finally { fs.unlink(tmp).catch(() => { }) }
    }

    const url = this.options.signExpires
      ? await new Promise<string>((res, rej) =>
        this.cos.getObjectUrl(
          { Bucket: this.options.bucket, Region: this.options.region, Key, Sign: true, Expires: this.options.signExpires },
          (e, d) => e ? rej(e) : res(d.Url),
        ),
      )
      : this.urlForKey(Key)

    return { url }
  }

  private urlForKey = (k: string) =>
    this.options.domain
      ? `https://${this.options.domain}/${k}`
      : `https://${this.options.bucket}.cos.${this.options.region}.myqcloud.com/${encodeURIComponent(k)}`
}
