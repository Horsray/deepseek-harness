import { createServer, type Server } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { apply } from '../src/index.ts'
import type { Config } from '../src/index.ts'

interface Harness {
  tools: Map<string, ToolDefinition>
  directory: string
  requests: string[]
  server: Server
  close(): Promise<void>
}

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const MP4 = new Uint8Array(2048).fill(7)

let routes: Record<string, (method: string) => { status: number; body: string; binary?: Uint8Array }> = {}

/** Stand-in execution agent: the mocked Working Directory ignores its identity. */
const AGENT = {} as never

/**
 * Build the execution context the tool bodies read.
 * @param signal - per-call cancellation for the tool body.
 * @returns the minimal context these tools consume.
 */
function execution(signal: AbortSignal): ToolRunContext {
  return { signal, agent: AGENT } as never
}

async function harness(config: Partial<Config> = {}): Promise<Harness> {
  const requests: string[] = []
  const tools = new Map<string, ToolDefinition>()
  const directory = await mkdtemp(join(tmpdir(), 'agnes-media-'))
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const key = `${request.method} ${url.pathname}`
    requests.push(`${key}${url.search}`)
    const handler = routes[key]
    if (handler === undefined) {
      response.writeHead(404, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ message: 'no route' }))
      return
    }
    const result = handler(request.method ?? 'GET')
    if (result.binary !== undefined) {
      response.writeHead(result.status, { 'Content-Type': 'video/mp4' })
      response.end(result.binary)
      return
    }
    response.writeHead(result.status, { 'Content-Type': 'application/json' })
    response.end(result.body)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const baseUrl = typeof address === 'object' && address !== null ? `http://127.0.0.1:${address.port}` : ''

  apply({
    tools: { register: (definition: ToolDefinition) => { tools.set(definition.name, definition); return () => {} } },
    workingDirectory: { ensure: async () => directory },
    attachments: { saveFile: async ({ data, name }: { data: Uint8Array; name?: string }) => ({ attachmentId: 'ref', name: name ?? 'file', bytes: data.byteLength }) },
  } as never, { apiKey: 'test-key', baseUrl, requestTimeoutMs: 30_000, pollIntervalMs: 20, ...config })

  return {
    tools,
    directory,
    requests,
    server,
    async close() {
      await new Promise<void>(resolve => server.close(() => resolve()))
      await rm(directory, { recursive: true, force: true })
    },
  }
}

/** Drop the routes each test registered so the next server starts empty. */
afterEach(() => {
  routes = {}
})

describe('agnes media tools', () => {
  it('registers generate_image and generate_video', async () => {
    const test = await harness()
    expect([...test.tools.keys()]).toEqual(['generate_image', 'generate_video'])
    await test.close()
  })

  it('writes a generated image from base64 data', async () => {
    routes['POST /v1/images/generations'] = () => ({
      status: 200,
      body: JSON.stringify({ data: [{ b64_json: Buffer.from(PNG).toString('base64') }] }),
    })
    const test = await harness()
    const tool = test.tools.get('generate_image')!
    const value = await tool.execute({ prompt: 'an apple' }, execution(AbortSignal.timeout(10_000))) as { path: string; bytes: number }
    expect(value.bytes).toBe(PNG.byteLength)
    expect(await readFile(value.path)).toEqual(Buffer.from(PNG))
    await test.close()
  })

  it('downloads a completed video after polling', async () => {
    let polls = 0
    routes['POST /v1/videos'] = () => ({ status: 200, body: JSON.stringify({ video_id: 'vid_1' }) })
    routes['GET /agnesapi'] = () => {
      polls += 1
      return polls < 3
        ? { status: 200, body: JSON.stringify({ status: 'pending', progress: 10 }) }
        : { status: 200, body: JSON.stringify({ status: 'completed', progress: 100, url: `${baseUrlForTest()}/video.mp4` }) }
    }
    routes['GET /video.mp4'] = () => ({ status: 200, body: '', binary: MP4 })
    const test = await harness()
    baseUrlHolder = `http://127.0.0.1:${(test.server.address() as { port: number }).port}`
    const tool = test.tools.get('generate_video')!
    const value = await tool.execute({ prompt: 'lake', seconds: '4' }, execution(AbortSignal.timeout(20_000))) as { path: string; videoId: string; bytes: number }
    expect(value.videoId).toBe('vid_1')
    expect(value.bytes).toBe(MP4.byteLength)
    expect(await readFile(value.path)).toEqual(Buffer.from(MP4))
    expect(polls).toBe(3)
    await test.close()
  })

  it('surfaces a full video queue as an actionable error', async () => {
    routes['POST /v1/videos'] = () => ({ status: 503, body: JSON.stringify({ code: 'video_queue_full', message: '视频队列已满，请稍后重试' }) })
    const test = await harness()
    const tool = test.tools.get('generate_video')!
    await expect(tool.execute({ prompt: 'lake' }, execution(AbortSignal.timeout(10_000))))
      .rejects.toThrow(/503.*视频队列已满/u)
    await test.close()
  })

  it('reports a missing API key with its sources', async () => {
    delete process.env.AGNES_API_KEY
    const test = await harness({ apiKey: '', apiKeyFile: join(tmpdir(), 'agnes-missing-key-file') })
    const tool = test.tools.get('generate_image')!
    await expect(tool.execute({ prompt: 'x' }, execution(AbortSignal.timeout(5_000))))
      .rejects.toThrow(/Agnes API key is missing/u)
    await test.close()
  })
})

let baseUrlHolder = ''
function baseUrlForTest(): string {
  return baseUrlHolder
}
