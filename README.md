# comfyui-sdk

[![](https://img.shields.io/npm/dw/comfyui-sdk.svg)](https://www.npmjs.com/package/comfyui-sdk)
[![npm version](https://badge.fury.io/js/comfyui-sdk.svg)](https://www.npmjs.com/package/comfyui-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

A professional TypeScript client library for ComfyUI, providing robust workflow execution, file management, and connection pooling capabilities.

## 🚀 Features

- 🔄 **Workflow Execution**: Execute ComfyUI workflows with full type safety
- 📁 **File Management**: Upload and manage files with automatic format detection
- 🏊 **Connection Pooling**: Manage multiple ComfyUI instances with automatic load balancing
- 📝 **Comprehensive Logging**: Built-in logging system with configurable levels
- ⚡ **Performance Optimized**: Exponential backoff, retry mechanisms, and efficient polling
- 🔐 **Authentication**: Built-in API key support
- 📦 **Pipeline Support**: Type-safe input/output mapping for complex workflows
- 🌐 **Cloud Storage**: Integrated support for AWS S3 and Tencent COS
- 🎯 **Session Management**: Advanced session management with automatic resource cleanup

## 📦 Installation

```bash
npm install comfyui-sdk
```

```bash
yarn add comfyui-sdk
```

```bash
pnpm add comfyui-sdk
```

## 🔧 Quick Start

### Basic Usage

```typescript
import { ComfyUIClient } from 'comfyui-sdk'

// Initialize the client
const client = new ComfyUIClient({
  baseUrl: 'http://localhost:8188',
  apiKey: 'your-api-key', // optional
  timeout: 90000, // 90 seconds
  logging: true
})

// Execute a simple workflow
const workflow = {
  1: {
    inputs: {
      text: 'A beautiful sunset over mountains',
      clip: ['2', 0]
    },
    class_type: 'CLIPTextEncode'
  },
  2: {
    inputs: {
      ckpt_name: 'sd_xl_base_1.0.safetensors'
    },
    class_type: 'CheckpointLoaderSimple'
  }
  // ... more workflow nodes
}

const results = await client.run(workflow)
console.log('Generated artifacts:', results)
```

### File Upload

```typescript
import fs from 'node:fs'

// Upload an image file
const imageBuffer = fs.readFileSync('input.jpg')
const uploadResult = await client.uploadFile(imageBuffer, {
  filename: 'my-input.jpg',
  subfolder: 'inputs',
  override: true
})

console.log('Uploaded file:', uploadResult.name)
```

## 📚 API Reference

### ComfyUIClient

The main client class for interacting with ComfyUI.

#### Constructor Options

```typescript
interface ClientOptions {
  baseUrl: string // ComfyUI server URL
  apiKey?: string // API key for authentication
  timeout?: number // Request timeout in milliseconds (default: 90000)
  poll?: {
    interval?: number // Polling interval in ms (default: 4000)
    backoffBase?: number // Exponential backoff base in ms (default: 2000)
    backoffCap?: number // Max backoff time in ms (default: 15000)
  }
  logging?: boolean // Enable logging (default: false)
  logLevel?: LogLevel // Log level (default: INFO)
}
```

#### Methods

##### `run<TNode>(workflow: WorkflowPayload, options?: RunOptions<TNode>)`

Execute a ComfyUI workflow with optional type-safe input/output mapping.

**Parameters:**

- `workflow`: The ComfyUI workflow definition
- `options`: Optional configuration for typed inputs/outputs

**Returns:** `Promise<Artifact[]>` or typed output based on node configuration

**Example:**

```typescript
// Basic workflow execution
// Type-safe execution with defineConfig
import { defineConfig } from 'comfyui-sdk'

const artifacts = await client.run({
  1: {
    inputs: { text: 'hello world' },
    class_type: 'CLIPTextEncode'
  }
})

const textToImageConfig = defineConfig({
  inputs: [
    { from: 'prompt', to: '1.inputs.text', required: true },
    { from: 'seed', to: '2.inputs.seed', defaultValue: 42 }
  ] as const,
  outputs: [
    { from: '5', to: 'image' }
  ] as const
})

const result = await client.run(workflow, {
  node: textToImageConfig,
  inputs: {
    prompt: 'A beautiful landscape',
    seed: 12345 // optional, has default
  }
})

// result.image is now type-safe and contains the artifact
```

##### `uploadFile(file: Buffer | Blob, options?: UploadOptions)`

Upload a file to ComfyUI server.

**Parameters:**

- `file`: File data as Buffer or Blob
- `options`: Upload configuration

**Options:**

```typescript
interface UploadOptions {
  override?: boolean // Overwrite existing file (default: false)
  subfolder?: string // Subfolder path (default: 'uploaded')
  filename?: string // Custom filename (default: auto-generated)
}
```

**Example:**

```typescript
// Upload with custom options
const result = await client.uploadFile(imageBuffer, {
  filename: 'portrait.jpg',
  subfolder: 'portraits',
  override: true
})

// Use uploaded file in workflow
const workflow = {
  1: {
    inputs: {
      image: result.name
    },
    class_type: 'LoadImage'
  }
}
```

##### `getHistory(promptId: string)`

Retrieve execution history for a specific prompt.

**Returns:** `Promise<Histories>`

```typescript
const history = await client.getHistory('prompt-uuid')
console.log('Execution status:', history['prompt-uuid'].status)
```

### Connection Pool

For high-performance applications, use the connection pool to manage multiple ComfyUI instances.

```typescript
import { ComfyUIPool } from 'comfyui-sdk'

const pool = new ComfyUIPool([
  { baseUrl: 'http://server1:8188', maxConcurrency: 2 },
  { baseUrl: 'http://server2:8188', maxConcurrency: 3 },
  { baseUrl: 'http://server3:8188', maxConcurrency: 1 }
], {
  logging: true,
  logLevel: LogLevel.INFO
})

// Get a client lease
const lease = await pool.lease()
try {
  const results = await lease.client.run(workflow)
  console.log('Results:', results)
}
finally {
  lease.release() // Always release the lease
}

// Or use the convenient execute method
const results = await pool.execute(workflow, options)
```

### Session Management

Use sessions for efficient resource management and built-in pipeline processing:

```typescript
import { ArtifactPipeline, ComfyUIPool, CosUploader } from 'comfyui-sdk'

// Create a processing pipeline
const pipeline = new ArtifactPipeline([
  new CosUploader({
    secretId: 'your-secret-id',
    secretKey: 'your-secret-key',
    bucket: 'your-bucket',
    region: 'ap-guangzhou',
    prefix: 'comfyui/',
    signExpires: 0,
    domain: 'example.com',
  }),
])

const pool = new ComfyUIPool([
  { baseUrl: 'http://localhost:8188', maxConcurrency: 2 }
])

// Create a session with pipeline
const session = pool.createSession(pipeline)
if (!session) {
  throw new Error('No available clients')
}

try {
  // Run workflow - artifacts will be automatically processed through the pipeline
  const results = await session.run(workflow)

  // Access processed results (e.g., uploaded URLs)
  for (const artifact of results) {
    if (artifact.kind === 'binary') {
      const uploadedUrl = artifact.pipeline?.cosUploader?.url
      console.log('Uploaded image URL:', uploadedUrl)
    }
  }
}
finally {
  session.close() // Always close the session
}

// Or use the convenient withSession method
await pool.withSession(async (session) => {
  const results = await session.run(workflow)
  return results
}, pipeline)
```

### Pipeline Definition with defineConfig

Create reusable, type-safe pipeline definitions using `defineConfig`:

```typescript
import { defineConfig } from 'comfyui-sdk'

// Define a text-to-image pipeline with full type safety
const textToImagePipeline = defineConfig({
  inputs: [
    { from: 'prompt', to: '6.inputs.text', required: true },
    { from: 'negative_prompt', to: '7.inputs.text', defaultValue: '' },
    { from: 'width', to: '5.inputs.width', defaultValue: 1024 },
    { from: 'height', to: '5.inputs.height', defaultValue: 1024 },
    { from: 'steps', to: '3.inputs.steps', defaultValue: 20 },
    { from: 'cfg', to: '3.inputs.cfg', defaultValue: 8 },
    { from: 'seed', to: '3.inputs.seed', defaultValue: -1 }
  ] as const,
  outputs: [
    { from: '9', to: 'image' },
    { from: '12', to: 'metadata' }
  ] as const
} as const)

// Use the pipeline with full TypeScript support
const result = await client.run(sdxlWorkflow, {
  node: textToImagePipeline,
  inputs: {
    prompt: 'A majestic dragon soaring through clouds',
    width: 1920,
    height: 1080,
    steps: 30
    // Other inputs will use default values
  }
})

// TypeScript knows result.image and result.metadata exist
console.log('Generated image:', result.image)
console.log('Metadata:', result.metadata)
```

### Artifact Processing Pipeline

Process generated artifacts with custom processors:

```typescript
import { ArtifactPipeline, CosUploader } from 'comfyui-sdk'

// Setup cloud storage uploader
const uploader = new CosUploader({
  secretId: 'your-secret-id',
  secretKey: 'your-secret-key',
  bucket: 'your-bucket',
  region: 'ap-guangzhou',
  prefix: 'comfyui/',
  signExpires: 0,
  domain: 'example.com',
})

// Create artifact processing pipeline
const pipeline = new ArtifactPipeline([
  uploader, // Upload to cloud storage
  // Add more processors as needed
])

// Process artifacts through pipeline
const artifacts = await client.run(workflow)
const processedArtifacts = await pipeline.run(artifacts)

console.log('Processed artifacts:', processedArtifacts)
```

### Custom Artifact Processors

Create your own artifact processors:

```typescript
import { ArtifactProcessor } from 'comfyui-sdk'

class CustomImageProcessor extends ArtifactProcessor {
  readonly name = 'customImageProcessor'

  async shouldRun(artifact: Artifact): Promise<boolean> {
    // Only process binary artifacts (images)
    return artifact.kind === 'binary'
  }

  async run(artifact: Artifact): Promise<Record<string, unknown>> {
    // Your custom processing logic here
    const buffer = artifact.payload as Buffer

    // Example: apply some image processing
    const processedBuffer = await this.processImage(buffer)

    // Return metadata that will be stored in artifact.pipeline[this.name]
    return {
      processed: true,
      originalSize: buffer.length,
      processedSize: processedBuffer.length,
      timestamp: Date.now()
    }
  }

  private async processImage(buffer: Buffer): Promise<Buffer> {
    // Your image processing implementation
    return buffer
  }
}

// Use your custom processor
const pipeline = new ArtifactPipeline([
  new CustomImageProcessor(),
  new CosUploader({ /* ... */ })
])
```

## 🔍 Advanced Usage

### Custom Logging

```typescript
import { LogLevel } from 'comfyui-sdk'

const client = new ComfyUIClient({
  baseUrl: 'http://localhost:8188',
  logging: true,
  logLevel: LogLevel.DEBUG // Available: NONE, ERROR, WARN, INFO, DEBUG
})
```

### Error Handling

```typescript
try {
  const results = await client.run(workflow)
}
catch (error) {
  if (error.message.includes('Prompt') && error.message.includes('failed')) {
    console.error('Workflow execution failed:', error.message)
    // Handle specific workflow errors
  }
  else {
    console.error('Unexpected error:', error)
    // Handle network or other errors
  }
}
```

### Timeout Configuration

```typescript
const client = new ComfyUIClient({
  baseUrl: 'http://localhost:8188',
  timeout: 300000, // 5 minutes for long-running workflows
  poll: {
    interval: 2000, // Check every 2 seconds
    backoffBase: 1000, // Start backoff at 1 second
    backoffCap: 30000 // Max 30 second intervals
  }
})
```

## 🔧 Configuration Examples

### Development Setup

```typescript
const devClient = new ComfyUIClient({
  baseUrl: 'http://localhost:8188',
  logging: true,
  logLevel: LogLevel.DEBUG,
  timeout: 60000,
  poll: { interval: 1000 }
})
```

### Production Setup

```typescript
const prodPool = new ComfyUIPool([
  {
    baseUrl: 'https://comfyui-1.example.com',
    apiKey: process.env.COMFYUI_API_KEY,
    maxConcurrency: 5,
    timeout: 180000
  },
  {
    baseUrl: 'https://comfyui-2.example.com',
    apiKey: process.env.COMFYUI_API_KEY,
    maxConcurrency: 3,
    timeout: 180000
  }
], {
  logging: true,
  logLevel: LogLevel.INFO
})
```

## 📋 Type Definitions

The library provides comprehensive TypeScript definitions:

```typescript
// Workflow artifacts
type Artifact =
  | { kind: 'binary', payload: ArrayBuffer | Uint8Array | Buffer | Blob, manifest: BinaryManifest }
  | { kind: 'text', payload: string, manifest: TextManifest }
  | { kind: 'json', payload: unknown, manifest: JsonManifest }

// Pipeline node definitions with defineConfig
interface PipelineNode<TOutputs, TInputs> {
  inputs?: TInputs
  outputs?: TOutputs
}

// Type-safe input inference
type InferInputType<TInputs> = {
  [K in RequiredInputs]: unknown
} & {
  [K in OptionalInputs]?: unknown
}

// Session interface
interface ComfyUISession {
  run: <TNode extends PipelineNode>(workflow: WorkflowPayload, options?: RunOptions<TNode>) => Promise<Artifact[]>
  uploadFile: (data: Buffer | Blob, options?: UploadOptions) => Promise<UploadOutput>
  getHistory: (promptId: string) => Promise<Histories>
  close: () => void
}
```

## 🛠️ Requirements

- Node.js >= 16.0.0
- TypeScript >= 4.5.0 (if using TypeScript)
- ComfyUI server instance

## 📖 Examples

### Complete Text-to-Image Workflow with Pipeline

```typescript
import { ArtifactPipeline, ComfyUIClient, CosUploader, defineConfig } from 'comfyui-sdk'

const client = new ComfyUIClient({
  baseUrl: 'http://localhost:8188',
  logging: true
})

// Define workflow configuration with type safety
const sdxlConfig = defineConfig({
  inputs: [
    { from: 'prompt', to: '6.inputs.text', required: true },
    { from: 'negative', to: '7.inputs.text', defaultValue: 'blurry, low quality' },
    { from: 'width', to: '5.inputs.width', defaultValue: 1024 },
    { from: 'height', to: '5.inputs.height', defaultValue: 1024 },
    { from: 'steps', to: '3.inputs.steps', defaultValue: 20 },
    { from: 'seed', to: '3.inputs.seed', defaultValue: 42 }
  ] as const,
  outputs: [
    { from: '9', to: 'image' }
  ] as const
} as const)

// SDXL workflow definition
const sdxlWorkflow = {
  4: {
    inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' },
    class_type: 'CheckpointLoaderSimple'
  },
  5: {
    inputs: { width: 1024, height: 1024, batch_size: 1 },
    class_type: 'EmptyLatentImage'
  },
  6: {
    inputs: { text: 'beautiful sunset', clip: ['4', 1] },
    class_type: 'CLIPTextEncode'
  },
  7: {
    inputs: { text: 'blurry, low quality', clip: ['4', 1] },
    class_type: 'CLIPTextEncode'
  },
  3: {
    inputs: {
      seed: 42,
      steps: 20,
      cfg: 8,
      sampler_name: 'euler',
      scheduler: 'normal',
      denoise: 1,
      model: ['4', 0],
      positive: ['6', 0],
      negative: ['7', 0],
      latent_image: ['5', 0]
    },
    class_type: 'KSampler'
  },
  8: {
    inputs: { samples: ['3', 0], vae: ['4', 2] },
    class_type: 'VAEDecode'
  },
  9: {
    inputs: { filename_prefix: 'ComfyUI', images: ['8', 0] },
    class_type: 'SaveImage'
  }
}

async function generateImage() {
  try {
    // Run with type-safe configuration
    const result = await client.run(sdxlWorkflow, {
      node: sdxlConfig,
      inputs: {
        prompt: 'A beautiful landscape with mountains and sunset',
        width: 1920,
        height: 1080,
        steps: 30
      }
    })

    // TypeScript knows about result.image
    console.log('Generated image:', result.image)
  }
  catch (error) {
    console.error('Generation failed:', error)
  }
}

generateImage()
```

### Complete Example with Pool and Session

```typescript
import { ArtifactPipeline, ComfyUIPool, CosUploader, defineConfig } from 'comfyui-sdk'

// Setup processing pipeline
const pipeline = new ArtifactPipeline([
  new CosUploader({
    secretId: process.env.COS_SECRET_ID!,
    secretKey: process.env.COS_SECRET_KEY!,
    bucket: 'my-bucket',
    region: 'ap-shanghai',
    prefix: 'comfyui-outputs/',
    domain: 'cdn.example.com'
  })
])

// Setup connection pool
const pool = new ComfyUIPool([
  { baseUrl: 'http://server1:8188', maxConcurrency: 3 },
  { baseUrl: 'http://server2:8188', maxConcurrency: 2 }
])

// Define reusable workflow configuration
const portraitConfig = defineConfig({
  inputs: [
    { from: 'description', to: '1.inputs.text', required: true },
    { from: 'style', to: '2.inputs.style', defaultValue: 'photorealistic' }
  ] as const,
  outputs: [
    { from: '10', to: 'portrait' },
    { from: '11', to: 'metadata' }
  ] as const
} as const)

// Use session for automatic resource management
async function generatePortrait(description: string) {
  return pool.withSession(async (session) => {
    const result = await session.run(portraitWorkflow, {
      node: portraitConfig,
      inputs: { description }
    })

    // Access uploaded URL from pipeline processing
    const uploadedUrl = result.portrait.pipeline?.cosUploader?.url

    return {
      imageUrl: uploadedUrl,
      metadata: result.metadata
    }
  }, pipeline)
}

// Usage
const portrait = await generatePortrait('A professional headshot of a businesswoman')
console.log('Portrait URL:', portrait.imageUrl)
```

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [ComfyUI Repository](https://github.com/comfyanonymous/ComfyUI)

---

Made with ❤️ by the Zane
