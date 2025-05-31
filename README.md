# comfyui-sdk

[![npm downloads](https://img.shields.io/npm/dw/comfyui-sdk.svg)](https://www.npmjs.com/package/comfyui-sdk)  
[![npm version](https://badge.fury.io/js/comfyui-sdk.svg)](https://www.npmjs.com/package/comfyui-sdk)  
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)  
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)

A battle-tested, TypeScript-first client for interacting with ComfyUI. Designed for large-scale Node.js applications, **comfyui-sdk** offers:

- 🔄 **Type-safe Workflow Execution**  
  Fully typed payloads and results, ensuring end-to-end type safety when invoking ComfyUI workflows.

- 📁 **Streamlined File Management**  
  Upload, overwrite, and organize files on the ComfyUI server. Automatic format inference, custom subfolders, and overwrite flags.

- 🏊 **High-throughput Connection Pooling**  
  Distribute requests across multiple ComfyUI instances with configurable concurrency limits and built-in load balancing.

- 📝 **Flexible, Configurable Logging**  
  Built-in logging framework with adjustable log levels (NONE, ERROR, WARN, INFO, DEBUG).

- ⚡ **Robust Retry & Polling**  
  Exponential backoff, configurable retry caps, and efficient polling loops to handle long-running workflows.

- 🔐 **Built-in Authentication**  
  Simple API-key support for secure communication.

- 📦 **Advanced Pipeline Support**  
  Define reusable, type-safe input/output mappings for complex pipelines; integrate processors for artifact transformation.

- 🌐 **Cloud Storage Integrations**  
  Native AWS S3 and Tencent COS uploaders, complete with signing and URL generation.

- 🎯 **Session & Resource Management**  
  Automatic session pooling, resource cleanup, and artifact pipelines that handle uploads, transformations, and metadata collection.

- 🔧 **Modular Artifact Processors**  
  Build custom processors with fine-grained `shouldRun` logic and type-safe state propagation via `PipelineBus`.



## 🔧 Installation

Install via your preferred package manager:

```bash
npm install comfyui-sdk
````

```bash
yarn add comfyui-sdk
```

```bash
pnpm add comfyui-sdk
```



## 🚀 Quick Start

### 1. Initialize the Client

```typescript
import { ComfyUIClient, LogLevel } from 'comfyui-sdk'

const client = new ComfyUIClient({
  baseUrl: 'http://localhost:8188',     // ComfyUI server URL
  apiKey: 'your-api-key-here',          // Optional API key
  timeout: 90_000,                      // Request timeout (ms)
  logging: true,                        // Enable logging
  logLevel: LogLevel.INFO               // Adjust log verbosity
})
```

### 2. Define & Execute a Workflow

```typescript
// A minimal workflow: encode text and load a checkpoint
const simpleWorkflow = {
  1: {
    inputs: { text: 'A serene mountain landscape' },
    class_type: 'CLIPTextEncode'
  },
  2: {
    inputs: { ckpt_name: 'sd_base_1.0.safetensors' },
    class_type: 'CheckpointLoaderSimple'
  }
}

async function runSimple() {
  try {
    const artifacts = await client.run(simpleWorkflow)
    console.log('Artifacts:', artifacts)
  } catch (err) {
    console.error('Workflow execution failed:', err)
  }
}

runSimple()
```

### 3. Upload a File

```typescript
import fs from 'node:fs'

// Read a local image into a Buffer
const buffer = fs.readFileSync('input.jpg')

async function uploadExample() {
  const result = await client.uploadFile(buffer, {
    filename: 'input.jpg',  // Custom name on server
    subfolder: 'images',    // Place under `uploaded/images/`
    override: true          // Overwrite if file exists
  })
  console.log('Uploaded as:', result.name)
}

uploadExample()
```



## 📚 API Reference

### ComfyUIClient

The primary class to interface with ComfyUI. All network requests, logging, and pooling are managed here.

#### Constructor: `new ComfyUIClient(options: ClientOptions)`

```typescript
interface ClientOptions {
  baseUrl: string                    // E.g., 'http://localhost:8188'
  apiKey?: string                    // Optional API key
  timeout?: number                   // Request timeout in milliseconds (default: 90_000)
  poll?: {
    interval?: number               // Polling interval in ms (default: 4_000)
    backoffBase?: number            // Exponential backoff base in ms (default: 2_000)
    backoffCap?: number             // Max backoff per retry in ms (default: 15_000)
  }
  logging?: boolean                  // Enable or disable logging (default: false)
  logLevel?: LogLevel                // One of NONE, ERROR, WARN, INFO, DEBUG (default: INFO)
}
```

#### Methods



##### `run<TNode>(workflow: WorkflowPayload, options?: RunOptions<TNode>): Promise<Artifact[]>`

Execute a ComfyUI workflow. Returns an array of `Artifact` objects (binary, text, or JSON). Optionally, specify a type-safe mapping using `defineConfig`.

* **Parameters**

  * `workflow`: An object whose keys are node IDs (strings or numbers) and whose values define `class_type` and `inputs`.
  * `options` *(optional)*:

    ```typescript
    interface RunOptions<TNode> {
      node?: TNode                 // A typed pipeline/node definition (from defineConfig)
      inputs?: Record<string, unknown> // Values for required/optional pipeline inputs
    }
    ```

* **Returns**
  `Promise<Artifact[]>`

  * If using `defineConfig`, you’ll receive a strongly typed result object (with named outputs).

* **Example: Basic Execution**

  ```typescript
  const artifacts = await client.run({
    1: { class_type: 'CLIPTextEncode', inputs: { text: 'hello world' } }
  })
  console.log(artifacts)
  ```

* **Example: Type-safe Pipeline**

  ```typescript
  import { defineConfig } from 'comfyui-sdk'

  const textToImageConfig = defineConfig({
    inputs: [
      { from: 'prompt', to: '1.inputs.text', required: true },
      { from: 'seed', to: '2.inputs.seed', defaultValue: 42 }
    ] as const,
    outputs: [
      { from: '5', to: 'image' }
    ] as const
  })

  // Workflow must match the node mapping above
  const workflow = {
    1: { class_type: 'CLIPTextEncode', inputs: { text: 'A cosmic vista' } },
    2: { class_type: 'RandomSeed', inputs: { seed: 123 } },
    // ... other nodes up to node 5 that produce an image
  }

  const { image } = await client.run(workflow, {
    node: textToImageConfig,
    inputs: {
      prompt: 'A vibrant galaxy',
      seed: 2025
    }
  })
  console.log('Generated image artifact:', image)
  ```



##### `uploadFile(file: Buffer | Blob, options?: UploadOptions): Promise<UploadOutput>`

Upload a binary to ComfyUI’s file repository. Automatically handles file naming, subfolders, and overwrites.

* **Parameters**

  * `file`: A Node.js `Buffer` or a browser `Blob`.
  * `options`:

    ```typescript
    interface UploadOptions {
      override?: boolean       // Overwrite if a file with the same name already exists (default: false)
      subfolder?: string       // Subfolder inside `uploaded/`; auto-creates directories (default: 'uploaded')
      filename?: string        // Custom filename; if omitted, a UUID-based name is generated
    }
    ```
* **Returns**
  `Promise<UploadOutput>`

  ```typescript
  interface UploadOutput {
    name: string               // Full path on server, e.g., 'uploaded/images/foo.jpg'
    manifest: {
      contentType: string      // MIME type (e.g., 'image/jpeg')
      filename: string         // The final filename on server
      size: number             // File size in bytes
      // ... other manifest fields
    }
  }
  ```
* **Example**

  ```typescript
  import fs from 'node:fs'

  const imageBuffer = fs.readFileSync('avatar.png')
  const result = await client.uploadFile(imageBuffer, {
    subfolder: 'avatars',
    filename: 'user123.png',
    override: true
  })
  console.log('File URL/name:', result.name)
  ```



##### `getHistory(promptId: string): Promise<Histories>`

Fetch the full execution history for a given prompt UUID.

* **Parameters**

  * `promptId`: The string identifier returned by a previous workflow execution.
* **Returns**
  `Promise<Histories>`

  * An object mapping prompt IDs to status details, timestamps, logs, and node-level progress.
* **Example**

  ```typescript
  const history = await client.getHistory('c2f9a8d2-1b3e-4e7c-9a11-abcdef123456')
  console.log('Status:', history['c2f9a8d2-1b3e-4e7c-9a11-abcdef123456'].status)
  ```



### ComfyUIPool

A pool of `ComfyUIClient` instances for load balancing across multiple ComfyUI servers.

#### Constructor: `new ComfyUIPool(instances: InstanceConfig[], options?: PoolOptions)`

* **Parameters**

  ```typescript
  interface InstanceConfig {
    baseUrl: string            // ComfyUI server URL, e.g. 'https://comfyui-1.example.com'
    apiKey?: string            // Optional API key for that instance
    maxConcurrency: number     // Maximum concurrent workflows on this instance
    timeout?: number           // Override default timeout (ms)
  }

  interface PoolOptions {
    logging?: boolean          // Enable logging for pool activities
    logLevel?: LogLevel        // Log level for pooled clients
  }
  ```
* **Example**

  ```typescript
  const pool = new ComfyUIPool([
    { baseUrl: 'http://server1:8188', maxConcurrency: 2 },
    { baseUrl: 'http://server2:8188', maxConcurrency: 3 },
    { baseUrl: 'http://server3:8188', maxConcurrency: 1 }
  ], {
    logging: true,
    logLevel: LogLevel.INFO
  })
  ```

#### Methods



##### `lease(): Promise<ClientLease>`

Acquire a leased client from the pool.

* **Returns**
  `Promise<ClientLease>`

  ```typescript
  interface ClientLease {
    client: ComfyUIClient
    release: () => void       // Must be called when done, to return the client to the pool
  }
  ```
* **Example**

  ```typescript
  async function useLease() {
    const lease = await pool.lease()
    try {
      const results = await lease.client.run(workflow)
      console.log('Results:', results)
    } finally {
      lease.release()
    }
  }
  ```


##### `createSession(pipeline: ArtifactPipeline): ComfyUISession | null`

Start a session that ties together a leased client + artifact pipeline. Allows you to run multiple workflows in sequence, automatically cleaning up resources and running the pipeline on each artifact.

* **Parameters**

  * `pipeline`: An `ArtifactPipeline` containing one or more `ArtifactProcessor`s.
* **Returns**
  `ComfyUISession | null` if no clients are currently available.
* **Example**

  ```typescript
  import { ArtifactPipeline, CosUploader } from 'comfyui-sdk'

  const pipeline = new ArtifactPipeline([
    new CosUploader({
      secretId: process.env.COS_SECRET_ID!,
      secretKey: process.env.COS_SECRET_KEY!,
      bucket: 'my-bucket',
      region: 'ap-shanghai',
      prefix: 'comfyui-exports/',
      domain: 'cdn.example.com'
    })
  ])

  const session = pool.createSession(pipeline)
  if (!session) throw new Error('No available ComfyUI clients')

  try {
    const artifacts = await session.run(workflow)
    console.log('Session artifacts:', artifacts)
  } finally {
    session.close()
  }
  ```



##### `withSession<T>(fn: (session: ComfyUISession) => Promise<T>, pipeline: ArtifactPipeline): Promise<T>`

Convenience wrapper: automatically acquires a session, runs your callback, then closes the session.

* **Example**

  ```typescript
  import { ArtifactPipeline, CosUploader } from 'comfyui-sdk'

  const pipeline = new ArtifactPipeline([/* processors */])

  const result = await pool.withSession(async session => {
    return session.run(workflow, { node: myConfig, inputs: { prompt: 'Auto' } })
  }, pipeline)

  console.log('Result from withSession:', result)
  ```



### ArtifactPipeline & Processors

The `ArtifactPipeline` enables you to chain multiple `ArtifactProcessor` instances. Each processor can:

* Inspect and transform artifacts
* Upload results to cloud storage
* Emit metadata or new artifacts
* Use fine-grained `shouldRun` logic to skip irrelevant artifacts
* Propagate state through a shared `PipelineBus`

#### Creating a Pipeline

```typescript
import { ArtifactPipeline, CosUploader, defineConfig } from 'comfyui-sdk'

// 1. Define custom or built-in processors
const uploader = new CosUploader({
  secretId: 'AKID...',
  secretKey: 'SECRET...',
  bucket: 'comfyui-bucket',
  region: 'ap-guangzhou',
  prefix: 'outputs/',
  signExpires: 0,
  domain: 'cdn.example.com'
})

// 2. Instantiate the pipeline with an ordered list of processors
const pipeline = new ArtifactPipeline([
  uploader,
  // ... you can add more custom processors here
])
```

#### Built-in Processors

* **CosUploader** (Tencent Cloud Object Storage)
  Uploads binary artifacts to COS and attaches `artifact.pipeline.cosUploader.url`.

* **S3Uploader** (AWS S3)
  Equivalent functionality for AWS: configure `bucket`, `region`, optional `prefix`, `ACL`, etc.

* **(Custom Processors)**
  Extend `ArtifactProcessor` to build your own. See “📜 Custom Processors” below.



## ⚡ Enhanced Pipeline System

### What’s New

1. **`ProcessorOutput<M>` Interface**
   Each processor now returns:

   ```typescript
   interface ProcessorOutput<M = unknown> {
     output: M                     // Metadata or intermediate data
     next?: Pick<Artifact, 'kind' | 'payload' | 'manifest'> // Optional transformed artifact
   }
   ```

   This allows you to both store processing data *and* replace the artifact payload/manifest in one step.

2. **Artifact Transformation**
   Use the `next` property to pass a new `Artifact` shape downstream:

   ```typescript
   class WebPConverter extends ArtifactProcessor {
     readonly name = 'webpConverter'

     async run(artifact: Artifact): Promise<ProcessorOutput<{ originalFormat: string; newFormat: string }>> {
       if (artifact.kind !== 'binary') {
         return { output: { originalFormat: 'n/a', newFormat: 'n/a' } }
       }
       // Imagine convertToWebP returns a Buffer
       const convertedBuffer = await this.convertToWebP(artifact.payload as Buffer)
       return {
         output: {
           originalFormat: artifact.manifest.contentType,
           newFormat: 'image/webp'
         },
         next: {
           kind: 'binary',
           payload: convertedBuffer,
           manifest: {
             ...artifact.manifest,
             filename: artifact.manifest.filename.replace(/\.[^.]+$/, '.webp'),
             contentType: 'image/webp'
           }
         }
       }
     }

     private async convertToWebP(buffer: Buffer): Promise<Buffer> {
       // Conversion logic...
       return buffer
     }
   }
   ```

3. **`shouldRun` Hooks**
   Each processor can override `shouldRun(artifact: Artifact): Promise<boolean>` to decide if it should process that artifact:

   ```typescript
   class LargeFileProcessor extends ArtifactProcessor {
     readonly name = 'largeFileProcessor'
     async shouldRun(artifact: Artifact): Promise<boolean> {
       return artifact.kind === 'binary' && (artifact.payload as Buffer).byteLength > 1_000_000
     }
     async run(artifact: Artifact): Promise<ProcessorOutput<Record<string, unknown>>> {
       // Process large binaries only...
       return { output: { processed: true } }
     }
   }
   ```

4. **Pipeline State Management**
   Processors can share state via the `artifact.pipeline` object (typed by extending the `PipelineBus` interface).

   ```typescript
   // Extend PipelineBus in a declaration file or at top of your code
   declare module 'comfyui-sdk/types' {
     interface PipelineBus {
       customProcessor?: CustomProcessorOutput
     }
   }

   class CustomProcessor extends ArtifactProcessor {
     readonly name = 'customProcessor'
     async run(artifact: Artifact): Promise<ProcessorOutput<CustomProcessorOutput>> {
       const start = Date.now()
       // ...process artifact.payload
       const duration = Date.now() - start
       return {
         output: { duration, size: (artifact.payload as Buffer).byteLength }
       }
     }
   }
   ```



## 📦 Type Definitions

All key types are exported for maximum TypeScript support:

```ts
// Artifact can be a binary (Buffer/Blob), text, or JSON result
type Artifact =
  | { kind: 'binary'; payload: ArrayBuffer | Uint8Array | Buffer | Blob; manifest: BinaryManifest; pipeline?: PipelineState }
  | { kind: 'text'; payload: string; manifest: TextManifest; pipeline?: PipelineState }
  | { kind: 'json'; payload: unknown; manifest: JsonManifest; pipeline?: PipelineState }

interface BinaryManifest {
  filename: string
  contentType: string
  size: number
  // Additional fields: promptId, nodeId, etc.
}

interface TextManifest {
  filename: string
  contentType: string
  size: number
  // Additional metadata
}

interface JsonManifest {
  filename: string
  contentType: string
  // Additional metadata
}

interface PipelineBus {}
type PipelineState = Record<string, unknown> & Partial<PipelineBus>

interface ProcessorOutput<M = unknown> {
  output: M
  next?: Pick<Artifact, 'kind' | 'payload' | 'manifest'>
}

abstract class ArtifactProcessor {
  abstract readonly name: string
  async shouldRun(artifact: Artifact): Promise<boolean>
  abstract run(artifact: Artifact): Promise<ProcessorOutput>
}

interface RunOptions<TNode> {
  node?: TNode
  inputs?: Record<string, unknown>
}

interface ClientOptions { /* ... as above ... */ }
interface UploadOptions { /* ... as above ... */ }
interface UploadOutput { /* ... as above ... */ }

interface ComfyUISession {
  run: <TNode>(workflow: WorkflowPayload, options?: RunOptions<TNode>) => Promise<Artifact[]>
  uploadFile: (data: Buffer | Blob, options?: UploadOptions) => Promise<UploadOutput>
  getHistory: (promptId: string) => Promise<Histories>
  close: () => void
}

class ArtifactPipeline {
  constructor(processors: ArtifactProcessor[])
  run(artifacts: Artifact[] | Record<string, Artifact>): Promise<Artifact[] | Record<string, Artifact>>
}
```



## 🛠 Configuration Examples

### Development Client

```ts
import { ComfyUIClient, LogLevel } from 'comfyui-sdk'

const devClient = new ComfyUIClient({
  baseUrl: 'http://localhost:8188',
  logging: true,
  logLevel: LogLevel.DEBUG,
  timeout: 60_000,
  poll: { interval: 1_000 }
})
```

### Production Pool

```ts
import { ComfyUIPool, LogLevel } from 'comfyui-sdk'

const prodPool = new ComfyUIPool([
  {
    baseUrl: 'https://comfyui-1.example.com',
    apiKey: process.env.COMFYUI_API_KEY,
    maxConcurrency: 5,
    timeout: 180_000
  },
  {
    baseUrl: 'https://comfyui-2.example.com',
    apiKey: process.env.COMFYUI_API_KEY,
    maxConcurrency: 3,
    timeout: 180_000
  }
], {
  logging: true,
  logLevel: LogLevel.INFO
})
```



## 📖 Complete Examples

### 1. End-to-End Text-to-Image Workflow with Pipeline

```ts
import {
  ComfyUIClient,
  ComfyUIPool,
  CosUploader,
  ArtifactPipeline,
  defineConfig,
  LogLevel
} from 'comfyui-sdk'

// 1. Configure pool of ComfyUI servers
const pool = new ComfyUIPool([
  { baseUrl: 'http://localhost:8188', maxConcurrency: 2 }
], {
  logging: true,
  logLevel: LogLevel.INFO
})

// 2. Build an artifact pipeline: convert to WebP → upload to COS → collect metadata
class WebPConverter extends ArtifactProcessor {
  readonly name = 'webpConverter'
  async run(artifact: Artifact) {
    if (artifact.kind !== 'binary') return { output: {} }
    const converted = artifact.payload as Buffer  // pretend conversion
    return {
      output: { original: artifact.manifest.contentType, converted: 'image/webp' },
      next: {
        kind: 'binary',
        payload: converted,
        manifest: {
          ...artifact.manifest,
          contentType: 'image/webp',
          filename: artifact.manifest.filename.replace(/\.\w+$/, '.webp')
        }
      }
    }
  }
}

// Tencent COS uploader
const cosUploader = new CosUploader({
  secretId: process.env.COS_SECRET_ID!,
  secretKey: process.env.COS_SECRET_KEY!,
  bucket: 'comfyui-bucket',
  region: 'ap-guangzhou',
  prefix: 'outputs/',
  signExpires: 0,
  domain: 'cdn.example.com'
})

// Metadata collector
class MetadataCollector extends ArtifactProcessor {
  readonly name = 'metadataCollector'
  async run(artifact: Artifact) {
    const uploadInfo = artifact.pipeline?.cosUploader
    const webpInfo = artifact.pipeline?.webpConverter
    const metadata = {
      timestamp: new Date().toISOString(),
      filename: artifact.manifest.filename,
      size: artifact.kind === 'binary' ? (artifact.payload as Buffer).byteLength : 0,
      uploadUrl: uploadInfo?.url || null,
      conversion: webpInfo || null
    }
    return {
      output: metadata,
      next: {
        kind: 'json',
        payload: metadata,
        manifest: {
          from: artifact.manifest.from,
          promptId: artifact.manifest.promptId,
          filename: `metadata_${artifact.manifest.filename}.json`,
          contentType: 'application/json'
        }
      }
    }
  }
}

// Assemble the pipeline
const pipeline = new ArtifactPipeline([new WebPConverter(), cosUploader, new MetadataCollector()])

// 3. Define a type-safe text-to-image pipeline
const textToImageConfig = defineConfig({
  inputs: [
    { from: 'prompt', to: '6.inputs.text', required: true },
    { from: 'negative_prompt', to: '7.inputs.text', defaultValue: '' },
    { from: 'width', to: '5.inputs.width', defaultValue: 1024 },
    { from: 'height', to: '5.inputs.height', defaultValue: 1024 },
    { from: 'steps', to: '3.inputs.steps', defaultValue: 20 },
    { from: 'cfg', to: '3.inputs.cfg', defaultValue: 7 },
    { from: 'seed', to: '3.inputs.seed', defaultValue: 42 }
  ] as const,
  outputs: [
    { from: '9', to: 'image' },
    { from: '12', to: 'metadata' }
  ] as const
} as const)

// 4. The SDXL text-to-image workflow
const sdxlWorkflow = {
  4: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' } },
  5: { class_type: 'EmptyLatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
  6: { class_type: 'CLIPTextEncode', inputs: { text: 'sunset over ocean', clip: ['4', 1] } },
  7: { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['4', 1] } },
  3: {
    class_type: 'KSampler',
    inputs: {
      seed: 42,
      steps: 20,
      cfg: 7,
      sampler_name: 'euler',
      scheduler: 'normal',
      denoise: 1,
      model: ['4', 0],
      positive: ['6', 0],
      negative: ['7', 0],
      latent_image: ['5', 0]
    }
  },
  8: { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
  9: { class_type: 'SaveImage', inputs: { filename_prefix: 'ComfyUI', images: ['8', 0] } },
  12: { class_type: 'SaveJSON', inputs: { data: ['8', 0], filename: 'metadata.json' } }
}

// 5. Execute within a session so artifacts flow through the pipeline
async function generateImage() {
  const session = pool.createSession(pipeline)
  if (!session) throw new Error('No available clients')

  try {
    const { image, metadata } = await session.run(sdxlWorkflow, {
      node: textToImageConfig,
      inputs: {
        prompt: 'A majestic dragon soaring above clouds',
        width: 1920,
        height: 1080,
        steps: 30
      }
    })

    console.log('Final Image Artifact:', image)
    console.log('Metadata JSON:', metadata)
  } catch (err) {
    console.error('Generation error:', err)
  } finally {
    session.close()
  }
}

generateImage()
```



## 🔍 Custom Artifact Processors

Extend the base `ArtifactProcessor` to implement bespoke processing logic:

```typescript
import { ArtifactProcessor, ProcessorOutput } from 'comfyui-sdk'

interface CustomProcessorOutput {
  processed: boolean
  originalSize: number
  processedSize: number
  timestamp: number
  durationMs: number
}

class CustomImageProcessor extends ArtifactProcessor {
  readonly name = 'customImageProcessor'

  async shouldRun(artifact: Artifact): Promise<boolean> {
    return artifact.kind === 'binary'
  }

  async run(artifact: Artifact): Promise<ProcessorOutput<CustomProcessorOutput>> {
    const startTime = Date.now()
    const buffer = artifact.payload as Buffer

    // Placeholder for real image processing
    const processedBuffer = await this.processImage(buffer)

    return {
      output: {
        processed: true,
        originalSize: buffer.byteLength,
        processedSize: processedBuffer.byteLength,
        timestamp: Date.now(),
        durationMs: Date.now() - startTime
      },
      next: {
        kind: 'binary',
        payload: processedBuffer,
        manifest: {
          ...artifact.manifest,
          filename: `processed_${artifact.manifest.filename}`,
          contentType: 'image/png'
        }
      }
    }
  }

  private async processImage(buffer: Buffer): Promise<Buffer> {
    // Insert actual processing here (e.g., resizing, filtering)
    return buffer
  }
}

// To enable full type safety on pipeline state:
declare module 'comfyui-sdk/types' {
  interface PipelineBus {
    customImageProcessor: CustomProcessorOutput
  }
}

// Usage
const pipeline = new ArtifactPipeline([
  new CustomImageProcessor(),
  new CosUploader({ /* ...config */ })
])
```



## 🤝 Contributing

We welcome contributions! To get started:

1. **Fork the repository**
2. **Install dependencies**: `npm install`
3. **Lint & type-check**: `npm run lint && npm run build`
4. **Run tests**: `npm test`
5. **Submit a pull request** with clear descriptions of the changes.

Please review our [CONTRIBUTING.md](https://github.com/zandko/comfyui-sdk/blob/main/CONTRIBUTING.md) before opening issues or PRs.



## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for full details.



## 🔗 Useful Links

* **ComfyUI (Core)**: [https://github.com/comfyanonymous/ComfyUI](https://github.com/comfyanonymous/ComfyUI)
* **comfyui-sdk**: [https://github.com/zandko/comfyui-sdk](https://github.com/zandko/comfyui-sdk)
* **Issue Tracker**: [https://github.com/zandko/comfyui-sdk/issues](https://github.com/zandko/comfyui-sdk/issues)
* **npm Package**: [https://www.npmjs.com/package/comfyui-sdk](https://www.npmjs.com/package/comfyui-sdk)



*Crafted with care by Zane*
*Node.js 18+ | TypeScript 4.5+*