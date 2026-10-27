/** Model tools for Agnes image and video generation through the domestic API. */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-attachment'
import type {} from '@deepseek-ai/dsh-working-directory'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'

/** Cordis plugin name. */
export const name = 'agnes-media'
/** Services used to register tools and persist generated media. */
export const inject = ['tools', 'workingDirectory', 'attachments']

const DEFAULT_BASE_URL = 'https://api.agnes-ai.cn'
const IMAGE_MODEL = 'agnes-image-2.5-flash'
const VIDEO_MODEL = 'agnes-video-2.5-flash'
const IMAGE_RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16', '2:3', '3:2', '21:9'] as const
const IMAGE_SIZES = ['1K', '2K', '3K', '4K'] as const
const VIDEO_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16'] as const
const MAX_ERROR_BYTES = 8_192
const DEFAULT_API_KEY_FILE = join(homedir(), '.dsh', 'agnes-api-key')

/** Deployment tuning and Agnes credential source. */
export interface Config {
  /** Agnes API key; when omitted, `AGNES_API_KEY` and {@link Config.apiKeyFile} are tried. */
  apiKey?: string
  /** File holding the API key on one line; defaults to `~/.dsh/agnes-api-key`. */
  apiKeyFile?: string
  /** API origin; the domestic site is the default, the international hub uses a different origin. */
  baseUrl: string
  /** Timeout for one image request or one complete asynchronous video task. */
  requestTimeoutMs: number
  /** Interval between asynchronous video task polls. */
  pollIntervalMs: number
}

/** Validated plugin configuration. */
export const Config: z<Config> = z.object({
  apiKey: z.string().description('Agnes API key; defaults to AGNES_API_KEY or apiKeyFile'),
  apiKeyFile: z.string().description('File holding the Agnes API key on one line'),
  baseUrl: z.string().default(DEFAULT_BASE_URL).description('Agnes API origin'),
  requestTimeoutMs: z.natural().min(1_000).default(360_000),
  pollIntervalMs: z.natural().min(500).default(2_000),
})

type JsonRecord = Record<string, unknown>

function record(value: unknown, message: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(message)
  return value as JsonRecord
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Agnes response is missing ${field}`)
  return value
}

function errorDetail(body: string): string {
  return body.length > MAX_ERROR_BYTES ? `${body.slice(0, MAX_ERROR_BYTES)}...` : body
}

async function jsonResponse(response: Response): Promise<JsonRecord> {
  const body = await response.text()
  if (!response.ok) {
    let detail = body
    try {
      const parsed = record(JSON.parse(body), 'invalid error response')
      detail = typeof parsed.message === 'string' ? parsed.message : body
    } catch {
      // Preserve the bounded raw response for non-JSON errors.
    }
    throw new Error(`Agnes API HTTP ${response.status}: ${errorDetail(detail)}`)
  }
  return record(JSON.parse(body), 'Agnes API returned an invalid JSON response')
}

async function resolveApiKey(config: Config): Promise<string> {
  const configured = config.apiKey?.trim()
  if (configured !== undefined && configured.length > 0) return configured
  const environment = process.env.AGNES_API_KEY?.trim()
  if (environment !== undefined && environment.length > 0) return environment
  try {
    const stored = (await readFile(config.apiKeyFile ?? DEFAULT_API_KEY_FILE, 'utf8')).trim()
    if (stored.length > 0) return stored
  } catch {
    // A missing key file is the same configuration gap as an unset variable.
  }
  throw new Error(`Agnes API key is missing: set the plugin's apiKey, AGNES_API_KEY, or ${config.apiKeyFile ?? DEFAULT_API_KEY_FILE}`)
}

function requestSignal(execSignal: AbortSignal, timeoutMs: number): AbortSignal {
  return AbortSignal.any([execSignal, AbortSignal.timeout(timeoutMs)])
}

async function wait(ms: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const timer = setTimeout(resolvePromise, ms)
    const abort = () => {
      clearTimeout(timer)
      reject(signal.reason ?? new Error('operation aborted'))
    }
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  })
}

function localTarget(cwd: string, requested: string | undefined, fallback: string): string {
  const path = requested === undefined ? fallback : requested
  return isAbsolute(path) ? path : join(cwd, path)
}

/**
 * Register the Agnes image and video model tools.
 * @param ctx - Cordis plugin context.
 * @param config - validated credential source and request tuning.
 */
export function apply(ctx: Context, config: Config): void {
  const timeoutMs = config.requestTimeoutMs
  const pollIntervalMs = config.pollIntervalMs
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/u, '')

  ctx.tools.register(defineTool({
    name: 'generate_image',
    description: 'Generate an image with Agnes Image 2.5 Flash. Supports text-to-image and image editing with public image URLs or Data URI references.',
    parameters: {
      prompt: { type: 'string', required: true, description: 'Image description or editing instruction.' },
      size: { type: 'string', enum: [...IMAGE_SIZES], description: 'Output tier. Defaults to 2K.' },
      ratio: { type: 'string', enum: [...IMAGE_RATIOS], description: 'Aspect ratio. Defaults to 1:1.' },
      image: { type: 'array', items: { type: 'string' }, description: 'Optional public image URLs or Data URI references.' },
      output_path: { type: 'string', description: 'Optional output path relative to the session working directory.' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          bytes: { type: 'integer', required: true },
          mediaType: { type: 'string', required: true },
          attachmentId: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    timeoutMs,
    async execute(args, exec) {
      if (exec.agent === undefined) throw new Error('generate_image requires a calling agent')
      const cwd = await ctx.workingDirectory.ensure(exec.agent, exec.signal)
      const authorization = `Bearer ${await resolveApiKey(config)}`
      const response = await fetch(`${baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: IMAGE_MODEL,
          prompt: args.prompt,
          size: args.size ?? '2K',
          ratio: args.ratio ?? '1:1',
          ...(args.image === undefined ? {} : { extra_body: { image: args.image, response_format: 'b64_json' } }),
          ...(args.image === undefined ? { return_base64: true } : {}),
        }),
        signal: requestSignal(exec.signal, timeoutMs),
      })
      const body = await jsonResponse(response)
      const data = body.data
      if (!Array.isArray(data) || data.length === 0) throw new Error('Agnes image response contained no data')
      const item = record(data[0], 'invalid Agnes image item')
      const encoded = typeof item.b64_json === 'string' ? item.b64_json : undefined
      let bytes: Uint8Array
      if (encoded !== undefined) bytes = Buffer.from(encoded, 'base64')
      else {
        const url = text(item.url, 'data[0].url')
        const downloaded = await fetch(url, { signal: requestSignal(exec.signal, timeoutMs) })
        if (!downloaded.ok) throw new Error(`Agnes image download HTTP ${downloaded.status}`)
        bytes = new Uint8Array(await downloaded.arrayBuffer())
      }
      if (bytes.byteLength === 0) throw new Error('Agnes returned an empty image')
      const target = localTarget(cwd, args.output_path, `agnes-image-${Date.now()}.png`)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, bytes)
      const attachment = await ctx.attachments.saveFile({ data: bytes, name: target.split('/').pop() ?? 'agnes-image.png' })
      return { path: resolve(target), bytes: bytes.byteLength, mediaType: 'image/png', attachmentId: attachment.attachmentId }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'generate_video',
    description: 'Generate a video with Agnes Video 2.5 Flash. Uses text-to-video mode, waits for the asynchronous task, downloads the MP4, and returns its file path.',
    parameters: {
      prompt: { type: 'string', required: true, description: 'Video scene and motion description.' },
      seconds: { type: 'string', enum: ['4', '5', '6', '7', '8', '9', '10', '11', '12'], description: 'Duration in seconds. Defaults to 5.' },
      aspect_ratio: { type: 'string', enum: [...VIDEO_RATIOS], description: 'Video aspect ratio. Defaults to 16:9.' },
      seed: { type: 'integer', description: 'Optional deterministic seed.' },
      output_path: { type: 'string', description: 'Optional MP4 output path relative to the session working directory.' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          bytes: { type: 'integer', required: true },
          videoId: { type: 'string', required: true },
          status: { type: 'string', required: true },
          seconds: { type: 'string', required: true },
          size: { type: 'string', required: true },
          aspectRatio: { type: 'string', required: true },
          attachmentId: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    timeoutMs,
    async execute(args, exec) {
      if (exec.agent === undefined) throw new Error('generate_video requires a calling agent')
      const prompt = args.prompt.trim()
      if (prompt.length === 0) throw new Error('prompt must be non-empty')
      const seconds = args.seconds ?? '5'
      const aspectRatio = args.aspect_ratio ?? '16:9'
      const signal = requestSignal(exec.signal, timeoutMs)
      const authorization = `Bearer ${await resolveApiKey(config)}`
      const headers = { Authorization: authorization, 'Content-Type': 'application/json' }
      const created = await jsonResponse(await fetch(`${baseUrl}/v1/videos`, {
        method: 'POST', headers, signal,
        body: JSON.stringify({ model: VIDEO_MODEL, prompt, seconds, mode: 'text', size: '720P', aspect_ratio: aspectRatio, ...(args.seed === undefined ? {} : { seed: args.seed }) }),
      }))
      const videoId = text(created.video_id, 'video_id')
      let result: JsonRecord | undefined
      while (result === undefined) {
        const current = await jsonResponse(await fetch(`${baseUrl}/agnesapi?video_id=${encodeURIComponent(videoId)}&model_name=${encodeURIComponent(VIDEO_MODEL)}`, {
          headers: { Authorization: authorization }, signal,
        }))
        const status = text(current.status, 'status')
        if (status === 'failed') throw new Error(`Agnes video task failed: ${String(current.error ?? 'unknown error')}`)
        if (status === 'completed') result = current
        else await wait(pollIntervalMs, signal)
      }
      const url = text(result.url, 'url')
      const downloaded = await fetch(url, { signal })
      if (!downloaded.ok) throw new Error(`Agnes video download HTTP ${downloaded.status}`)
      const bytes = new Uint8Array(await downloaded.arrayBuffer())
      if (bytes.byteLength === 0) throw new Error('Agnes returned an empty video')
      const cwd = await ctx.workingDirectory.ensure(exec.agent, exec.signal)
      const target = localTarget(cwd, args.output_path, `agnes-video-${Date.now()}.mp4`)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, bytes)
      const attachment = await ctx.attachments.saveFile({ data: bytes, name: target.split('/').pop() ?? 'agnes-video.mp4' })
      return { path: resolve(target), bytes: bytes.byteLength, videoId, status: 'completed', seconds, size: '720P', aspectRatio, attachmentId: attachment.attachmentId }
    },
  }))
}
