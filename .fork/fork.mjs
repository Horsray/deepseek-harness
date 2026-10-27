#!/usr/bin/env node
// .fork/fork.mjs — 跟进官方主仓库（默认 origin/master）的本地登记 CLI。
// 零外部依赖（只需要 git 与 Node >= 24），用法与设计说明见同目录 README.md。

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const SCHEMA_VERSION = 1
const DEFAULT_UPSTREAM = 'origin/master'
const REGISTRY_DIR = '.fork'
const REGISTRY_JSON = 'upstream.json'
const CHANGES_MD = 'changes.md'
const REGISTRY_REL = `${REGISTRY_DIR}/${REGISTRY_JSON}`
const CHANGES_REL = `${REGISTRY_DIR}/${CHANGES_MD}`
const SHORT_HASH_LENGTH = 7
const FETCH_TIMEOUT_MS = 180_000
const COMMANDS = new Set(['status', 'record', 'check', 'sync'])

/** 可预期的用户错误：带中文说明、可操作提示和退出码。 */
class UserError extends Error {
  /**
   * @param {string} message 错误主信息（中文）。
   * @param {string} [hint] 可操作的处理建议（中文）。
   * @param {number} [exitCode] 进程退出码，默认 1；用法错误用 2。
   */
  constructor(message, hint, exitCode = 1) {
    super(message)
    this.name = 'UserError'
    this.hint = hint
    this.exitCode = exitCode
  }
}

/** 输出一行到 stdout。 */
function print(text = '') {
  process.stdout.write(`${text}\n`)
}

/** 输出一行到 stderr（进度、提示、错误都走这里，保证 --json 的 stdout 干净）。 */
function info(text = '') {
  process.stderr.write(`${text}\n`)
}

/** 取 commit 的短 hash。 */
function shortHash(hash) {
  return typeof hash === 'string' ? hash.slice(0, SHORT_HASH_LENGTH) : ''
}

/** 把本地时间格式化为 YYYYmmdd-HHMMSS，用于备份分支名。 */
function timestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

/** 把 ISO 时间格式化为可读的本地时间。 */
function formatLocalTime(iso) {
  if (typeof iso !== 'string') return '未知'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '未知'
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** 转义 Markdown 表格单元格内容。 */
function escapeCell(text) {
  return String(text ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')
}

/** 用反引号包住路径/引用，避免 Markdown 误解析。 */
function codeSpan(text) {
  return `\`${text}\``
}

/** 把 git 参数拼成可读命令（含空格的参数加引号）。 */
function formatCommand(argv) {
  return ['git', ...argv.map((arg) => (/\s/.test(arg) || arg === '' ? JSON.stringify(arg) : arg))].join(' ')
}

/**
 * 执行一条 git 命令。
 * @param {string} repo 仓库根目录。
 * @param {string[]} argv git 子命令与参数。
 * @param {{allowFailure?: boolean, timeout?: number}} [options] allowFailure 为 true 时不抛错，直接返回结果。
 * @returns {{status: number, stdout: string, stderr: string, ok: boolean}}
 */
function runGit(repo, argv, options = {}) {
  const { allowFailure = false, timeout = 120_000 } = options
  const result = spawnSync('git', argv, {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    timeout,
    windowsHide: true,
  })
  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') {
      throw new UserError(
        `git 命令执行超时（${Math.round(timeout / 1000)} 秒）：${formatCommand(argv)}`,
        '请检查网络或凭据后重试，也可以先在终端手动执行该命令确认问题。',
      )
    }
    throw new UserError(
      `无法执行 git：${result.error.message}`,
      '请确认已安装 git，并且 git 在 PATH 中可用。',
    )
  }
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  if (result.status !== 0 && !allowFailure) {
    const detail = (stderr || stdout).trim()
    throw new UserError(
      `git 命令失败（退出码 ${result.status}）：${formatCommand(argv)}${detail ? `\n${detail}` : ''}`,
      '请先在终端手动执行该命令查看完整输出，排查后重试。',
    )
  }
  return { status: result.status, stdout, stderr, ok: result.status === 0 }
}

/** 执行 git 并返回去掉首尾空白的 stdout。 */
function gitOut(repo, argv, options = {}) {
  return runGit(repo, argv, options).stdout.trim()
}

/**
 * 解析 <remote>/<branch> 形式的上游引用。
 * @param {string} spec 例如 origin/master。
 * @returns {{remote: string, branch: string, ref: string}}
 */
function parseUpstream(spec) {
  const slash = spec.indexOf('/')
  if (slash <= 0 || slash === spec.length - 1) {
    throw new UserError(
      `--upstream 的格式应为 <remote>/<branch>，当前收到：${spec}`,
      '例如：--upstream origin/master 或 --upstream upstream/main。',
      2,
    )
  }
  return { remote: spec.slice(0, slash), branch: spec.slice(slash + 1), ref: spec }
}

/**
 * 定位仓库根目录：默认使用脚本所在目录的父目录，可用 --repo 覆盖。
 * @param {string|null} repoOption --repo 参数。
 * @returns {string} 仓库根目录绝对路径。
 */
function resolveRepo(repoOption) {
  const scriptRoot = path.resolve(import.meta.dirname, '..')
  const candidates = repoOption ? [path.resolve(repoOption)] : [scriptRoot, process.cwd()]
  for (const candidate of candidates) {
    const probe = spawnSync('git', ['-C', candidate, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    if (probe.error) {
      throw new UserError(
        `无法执行 git：${probe.error.message}`,
        '请确认已安装 git，并且 git 在 PATH 中可用。',
      )
    }
    if (probe.status === 0) return path.resolve(probe.stdout.trim())
    if (repoOption) break
  }
  if (repoOption) {
    throw new UserError(
      `不是 git 仓库：${path.resolve(repoOption)}`,
      '请用 --repo 指向一个 git 仓库的根目录（或其中任意子目录）。',
    )
  }
  throw new UserError(
    `当前目录不是 git 仓库：${process.cwd()}`,
    '请在仓库内运行本脚本，或用 --repo <path> 指定仓库路径。',
  )
}

/** 确认上游 remote 已配置。 */
function verifyRemote(repo, upstream) {
  const remotes = gitOut(repo, ['remote'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (remotes.includes(upstream.remote)) return
  const hint = remotes.length
    ? `当前仓库已配置的 remote：${remotes.join('、')}。请执行 git remote add ${upstream.remote} <url>，或用 --upstream <remote>/<branch> 指定已有 remote。`
    : '当前仓库还没有配置任何 remote。请先执行 git remote add origin <官方仓库地址>（地址见 .fork/README.md）。'
  throw new UserError(`上游 remote 不存在：${upstream.remote}`, hint)
}

/** 确认上游分支引用（refs/remotes/<remote>/<branch>）存在。 */
function verifyUpstreamRef(repo, upstream) {
  const probe = runGit(repo, ['rev-parse', '--verify', '--quiet', `${upstream.ref}^{commit}`], {
    allowFailure: true,
  })
  if (probe.status !== 0 || probe.stdout.trim() === '') {
    throw new UserError(
      `上游分支不存在：${upstream.ref}`,
      `请先运行 git fetch ${upstream.remote}，确认远端存在 ${upstream.branch} 分支后重试。`,
    )
  }
}

/** 从上游 remote 获取最新引用。 */
function fetchUpstream(repo, upstream) {
  info(`正在从 ${upstream.remote} 获取上游更新…`)
  const result = runGit(repo, ['fetch', upstream.remote], {
    allowFailure: true,
    timeout: FETCH_TIMEOUT_MS,
  })
  if (!result.ok) {
    const detail = (result.stderr || result.stdout).trim()
    throw new UserError(
      `获取上游更新失败：${formatCommand(['fetch', upstream.remote])}（退出码 ${result.status}）${detail ? `\n${detail}` : ''}`,
      `请检查网络、代理或凭据；也可以先手动执行 git fetch ${upstream.remote} 确认。`,
    )
  }
  info('上游引用已更新。')
}

/** 判断某个路径是否属于 fork 登记目录（登记文件不参与工作区改动统计）。 */
function isRegistryPath(filePath) {
  return filePath === REGISTRY_DIR || filePath.startsWith(`${REGISTRY_DIR}/`)
}

/** 拆分 git -z 输出。 */
function splitNul(raw) {
  return raw.split('\0').filter((token) => token !== '')
}

/**
 * 解析 git diff --name-status -z 的输出。
 * @returns {Array<{status: string, path: string, from?: string}>}
 */
function parseDiffNameStatus(raw) {
  const tokens = splitNul(raw)
  const files = []
  for (let index = 0; index < tokens.length; index += 1) {
    const status = tokens[index]
    const code = status[0]
    if (code === 'R' || code === 'C') {
      const from = tokens[index + 1] ?? ''
      const to = tokens[index + 2] ?? ''
      index += 2
      files.push({ status, path: to, from })
      continue
    }
    const filePath = tokens[index + 1] ?? ''
    index += 1
    files.push({ status, path: filePath })
  }
  return files
}

/**
 * 收集工作区改动（排除 .fork/ 登记文件）。
 * @returns {{dirty: boolean, added: string[], modified: string[], deleted: string[], untracked: string[], renamed: Array<{from: string, to: string}>, total: number}}
 */
function collectWorkingTree(repo) {
  const raw = runGit(repo, ['status', '--porcelain=v1', '-z', '-uall']).stdout
  const tokens = splitNul(raw)
  const added = []
  const modified = []
  const deleted = []
  const untracked = []
  const renamed = []
  for (let index = 0; index < tokens.length; index += 1) {
    const entry = tokens[index]
    const xy = entry.slice(0, 2)
    const filePath = entry.slice(3)
    let from = null
    if (xy.includes('R') || xy.includes('C')) {
      from = tokens[index + 1] ?? null
      index += 1
    }
    if (isRegistryPath(filePath) || (from !== null && isRegistryPath(from))) continue
    if (xy === '??') {
      untracked.push(filePath)
      continue
    }
    if (xy.includes('R')) {
      renamed.push({ from: from ?? '', to: filePath })
      continue
    }
    if (xy.includes('D')) {
      deleted.push(filePath)
      continue
    }
    if (xy.includes('A') || xy.includes('C')) {
      added.push(filePath)
      continue
    }
    modified.push(filePath)
  }
  const total = added.length + modified.length + deleted.length + untracked.length + renamed.length
  return { dirty: total > 0, added, modified, deleted, untracked, renamed, total }
}

/** 把工作区改动渲染成可读的几行。 */
function describeWorkingTree(workingTree, indent = '  ') {
  const lines = []
  for (const file of workingTree.added) lines.push(`${indent}A   ${file}`)
  for (const file of workingTree.modified) lines.push(`${indent}M   ${file}`)
  for (const file of workingTree.deleted) lines.push(`${indent}D   ${file}`)
  for (const rename of workingTree.renamed) lines.push(`${indent}R   ${rename.from} → ${rename.to}`)
  for (const file of workingTree.untracked) lines.push(`${indent}??  ${file}`)
  return lines
}

/** 取工作区改动涉及的所有路径（含重命名两侧）。 */
function workingTreePathSet(workingTree) {
  return new Set([
    ...workingTree.added,
    ...workingTree.modified,
    ...workingTree.deleted,
    ...workingTree.untracked,
    ...workingTree.renamed.flatMap((rename) => [rename.from, rename.to]),
  ])
}

/**
 * 列出某个本地提交相对其第一父提交改动的文件。
 * @param {string} repo 仓库根目录。
 * @param {string} hash 提交 hash。
 * @returns {string[]}
 */
function commitChangedFiles(repo, hash) {
  const parentLine = gitOut(repo, ['rev-list', '--parents', '-n', '1', hash])
  const parentCount = parentLine.split(/\s+/).filter(Boolean).length - 1
  const args =
    parentCount > 1
      ? ['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', `${hash}^1`, hash]
      : ['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', '--root', hash]
  return splitNul(runGit(repo, args).stdout)
}

/**
 * 收集相对基线的本地提交。
 * @returns {Array<{hash: string, shortHash: string, subject: string, files: string[]}>}
 */
function collectLocalCommits(repo, mergeBase) {
  const raw = runGit(repo, ['log', '--format=%H%x09%s', `${mergeBase}..HEAD`]).stdout
  const commits = []
  for (const line of raw.split('\n')) {
    if (line.trim() === '') continue
    const tabIndex = line.indexOf('\t')
    const hash = tabIndex === -1 ? line.trim() : line.slice(0, tabIndex).trim()
    const subject = tabIndex === -1 ? '' : line.slice(tabIndex + 1)
    commits.push({
      hash,
      shortHash: shortHash(hash),
      subject: subject === '' ? '（无提交说明）' : subject,
      files: commitChangedFiles(repo, hash),
    })
  }
  return commits
}

/** 读取提交说明。 */
function subjectOf(repo, commit) {
  const subject = gitOut(repo, ['log', '-1', '--format=%s', commit])
  return subject === '' ? '（无提交说明）' : subject
}

/**
 * 采集当前仓库相对上游的完整状态。
 * @param {string} repo 仓库根目录。
 * @param {{remote: string, branch: string, ref: string}} upstream 上游引用。
 */
function collectStatusData(repo, upstream) {
  const headProbe = runGit(repo, ['rev-parse', '--verify', '--quiet', 'HEAD'], { allowFailure: true })
  if (headProbe.status !== 0) {
    throw new UserError(
      '当前仓库还没有任何提交（HEAD 不存在），无法跟随上游。',
      '请先完成第一次提交，再运行本命令。',
    )
  }
  verifyUpstreamRef(repo, upstream)
  const upstreamHead = gitOut(repo, ['rev-parse', '--verify', `${upstream.ref}^{commit}`])
  const upstreamHeadSubject = subjectOf(repo, upstreamHead)

  const branchProbe = runGit(repo, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFailure: true })
  const localBranch = branchProbe.status === 0 ? branchProbe.stdout.trim() : '(detached HEAD)'

  const mergeBaseProbe = runGit(repo, ['merge-base', 'HEAD', upstreamHead], { allowFailure: true })
  const mergeBase = mergeBaseProbe.stdout.trim()
  if (mergeBaseProbe.status !== 0 || mergeBase === '') {
    throw new UserError(
      '无法确定本地分支与上游的共同祖先（git merge-base 失败）。',
      `请手动执行 git merge-base HEAD ${upstream.ref} 排查；确认本地分支与上游确实来自同一仓库历史。`,
    )
  }
  const mergeBaseSubject = subjectOf(repo, mergeBase)

  const counts = gitOut(repo, ['rev-list', '--left-right', '--count', `HEAD...${upstreamHead}`])
    .split(/\s+/)
    .map((value) => Number(value))
  const ahead = Number.isFinite(counts[0]) ? counts[0] : 0
  const behind = Number.isFinite(counts[1]) ? counts[1] : 0

  const localCommits = collectLocalCommits(repo, mergeBase)
  const localDiffFiles = parseDiffNameStatus(
    runGit(repo, ['diff', '--name-status', '-z', `${mergeBase}..HEAD`]).stdout,
  )
  const upstreamChangedFiles = splitNul(
    runGit(repo, ['diff', '--name-only', '-z', `${mergeBase}..${upstreamHead}`]).stdout,
  )
  const workingTree = collectWorkingTree(repo)

  const localCommittedPaths = new Set()
  for (const file of localDiffFiles) {
    localCommittedPaths.add(file.path)
    if (file.from) localCommittedPaths.add(file.from)
  }
  const workingTreePaths = workingTreePathSet(workingTree)
  const upstreamSet = new Set(upstreamChangedFiles)
  const doubleModifiedFiles = [...localCommittedPaths]
    .filter((file) => upstreamSet.has(file))
    .sort()
  const workingTreeOverlapFiles = [...workingTreePaths]
    .filter((file) => upstreamSet.has(file) && !localCommittedPaths.has(file))
    .sort()

  return {
    upstreamHead,
    upstreamHeadSubject,
    localBranch,
    mergeBase,
    mergeBaseSubject,
    ahead,
    behind,
    localCommits,
    localDiffFiles,
    localCommittedPaths,
    upstreamChangedFiles,
    workingTree,
    doubleModifiedFiles,
    workingTreeOverlapFiles,
  }
}

/** 读取登记文件；不存在返回 null，解析失败返回带标记的对象。 */
function readRegistry(repo) {
  const file = path.join(repo, REGISTRY_DIR, REGISTRY_JSON)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return { __parseError: true }
  }
}

/** 把登记里的 files 归一成可比较的 key 列表。 */
function registryFileKeys(registry) {
  const files = registry?.localChanges?.files
  if (!Array.isArray(files)) return null
  const keys = []
  for (const file of files) {
    if (typeof file === 'string') {
      keys.push(`?\u0000${file}`)
      continue
    }
    if (!file || typeof file.path !== 'string') return null
    keys.push(`${file.status ?? '?'}\u0000${file.path}`)
  }
  return keys.sort()
}

/** 对应当前状态的 files key 列表。 */
function currentFileKeys(data) {
  return data.localDiffFiles
    .map((file) => `${file.status}\u0000${file.path}`)
    .sort()
}

/** 两个字符串数组是否完全一致。 */
function sameStringArray(left, right) {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

/** 比较登记的未提交改动与当前工作区是否一致（只比路径集合，不比内容）。 */
function sameWorkingTree(registryWorkingTree, workingTree) {
  if (registryWorkingTree?.dirty !== workingTree.dirty) return false
  const registryPaths = new Set([
    ...(registryWorkingTree.added ?? []),
    ...(registryWorkingTree.modified ?? []),
    ...(registryWorkingTree.deleted ?? []),
    ...(registryWorkingTree.untracked ?? []),
    ...(registryWorkingTree.renamed ?? []).flatMap((rename) => [rename.from, rename.to]),
  ])
  const currentPaths = workingTreePathSet(workingTree)
  if (registryPaths.size !== currentPaths.size) return false
  for (const filePath of currentPaths) {
    if (!registryPaths.has(filePath)) return false
  }
  return true
}

/**
 * 判断登记是否仍然有效（缺失、过期、与当前状态不一致都算无效）。
 * @param {{registry: object|null, upstream: {ref: string}, data: object}} args
 */
function evaluateRegistry({ registry, upstream, data }) {
  const state = {
    path: REGISTRY_REL,
    exists: registry !== null,
    parseError: false,
    expired: false,
    reasons: [],
    warnings: [],
    schemaVersion: null,
    recordedAt: null,
    baseCommit: null,
    upstreamRef: null,
    upstreamHead: null,
  }
  const expire = (reason) => {
    state.expired = true
    state.reasons.push(reason)
  }

  if (registry === null) {
    expire(`登记文件 ${REGISTRY_REL} 不存在`)
    return state
  }
  if (registry.__parseError) {
    state.parseError = true
    expire(`登记文件 ${REGISTRY_REL} 无法解析为 JSON`)
    return state
  }

  state.schemaVersion = typeof registry.schemaVersion === 'number' ? registry.schemaVersion : null
  state.recordedAt = typeof registry.recordedAt === 'string' ? registry.recordedAt : null
  state.baseCommit = typeof registry.baseCommit === 'string' ? registry.baseCommit : null
  const registeredUpstream = registry.upstream ?? {}
  state.upstreamRef =
    typeof registeredUpstream.ref === 'string'
      ? registeredUpstream.ref
      : typeof registeredUpstream.remote === 'string' && typeof registeredUpstream.branch === 'string'
        ? `${registeredUpstream.remote}/${registeredUpstream.branch}`
        : null
  state.upstreamHead = typeof registeredUpstream.head === 'string' ? registeredUpstream.head : null

  if (!state.baseCommit) {
    expire('登记缺少 baseCommit 字段，请重新运行 record')
  } else if (state.baseCommit !== data.mergeBase) {
    expire(
      `baseCommit ${shortHash(state.baseCommit)} 与当前 merge-base ${shortHash(data.mergeBase)} 不一致（本地或上游历史已变化）`,
    )
  }
  if (!state.upstreamRef) {
    expire('登记缺少 upstream 字段，请重新运行 record')
  } else if (state.upstreamRef !== upstream.ref) {
    expire(`登记的上游 ${state.upstreamRef} 与当前使用的 ${upstream.ref} 不一致`)
  }
  if (state.upstreamHead && state.upstreamHead !== data.upstreamHead) {
    if (data.behind > 0) {
      expire(
        `上游 head 已从 ${shortHash(state.upstreamHead)} 变为 ${shortHash(data.upstreamHead)}，本地落后 ${data.behind} 个提交`,
      )
    } else {
      state.warnings.push(
        `上游 head 已从 ${shortHash(state.upstreamHead)} 变为 ${shortHash(data.upstreamHead)}，本地未落后（可能已合并，或上游被强推）`,
      )
    }
  }

  if (typeof registry.ahead === 'number' && registry.ahead !== data.ahead) {
    expire(`本地领先提交数已从 ${registry.ahead} 变为 ${data.ahead}（本地有新提交或历史被改写）`)
  }
  if (typeof registry.localBranch === 'string' && registry.localBranch !== data.localBranch) {
    expire(`本地分支已从 ${registry.localBranch} 变为 ${data.localBranch}`)
  }
  const registeredFileKeys = registryFileKeys(registry)
  if (registeredFileKeys && !sameStringArray(registeredFileKeys, currentFileKeys(data))) {
    expire('相对基线的已提交改动文件与登记不一致（工作区或本地提交有变化）')
  }
  const registeredWorkingTree = registry.localChanges?.workingTree
  if (registeredWorkingTree && !sameWorkingTree(registeredWorkingTree, data.workingTree)) {
    expire('未提交改动的文件清单与登记不一致（工作区有变化）')
  }

  return state
}

/** 构造 upstream.json 的内容。 */
function buildRegistry(upstream, data) {
  return {
    schemaVersion: SCHEMA_VERSION,
    recordedAt: new Date().toISOString(),
    upstream: {
      remote: upstream.remote,
      branch: upstream.branch,
      ref: upstream.ref,
      head: data.upstreamHead,
      headShort: shortHash(data.upstreamHead),
      headSubject: data.upstreamHeadSubject,
    },
    baseCommit: data.mergeBase,
    baseSubject: data.mergeBaseSubject,
    localBranch: data.localBranch,
    ahead: data.ahead,
    behind: data.behind,
    localChanges: {
      commits: data.localCommits.map((commit) => ({
        hash: commit.hash,
        shortHash: commit.shortHash,
        subject: commit.subject,
        files: commit.files,
      })),
      files: data.localDiffFiles.map((file) =>
        file.from
          ? { status: file.status, path: file.path, from: file.from }
          : { status: file.status, path: file.path },
      ),
      workingTreeDirty: data.workingTree.dirty,
      workingTree: {
        dirty: data.workingTree.dirty,
        added: data.workingTree.added,
        modified: data.workingTree.modified,
        deleted: data.workingTree.deleted,
        untracked: data.workingTree.untracked,
        renamed: data.workingTree.renamed,
      },
      doubleModifiedFiles: data.doubleModifiedFiles,
      workingTreeOverlapFiles: data.workingTreeOverlapFiles,
    },
  }
}

/** 生成人读的本地改动清单 changes.md。 */
function renderChangesMarkdown(upstream, data, registry) {
  const lines = []
  const push = (...values) => lines.push(...values)

  push('# 本地改动清单（fork 相对上游）', '')
  push(`> 本文件由 ${codeSpan('node .fork/fork.mjs record')} 自动生成，请勿手工编辑。`)
  push(`> 生成时间：${registry.recordedAt}（本地时间 ${formatLocalTime(registry.recordedAt)}）`, '')

  push('## 概览', '')
  push('| 项目 | 值 |')
  push('| --- | --- |')
  push(`| 上游 | ${codeSpan(upstream.ref)} |`)
  push(`| 上游 head | ${codeSpan(shortHash(data.upstreamHead))} ${escapeCell(data.upstreamHeadSubject)} |`)
  push(`| 基线（merge-base） | ${codeSpan(shortHash(data.mergeBase))} ${escapeCell(data.mergeBaseSubject)} |`)
  push(`| 本地分支 | ${codeSpan(data.localBranch)} |`)
  push(`| 领先 / 落后 | ahead ${data.ahead} / behind ${data.behind} |`)
  push(`| 本地提交数 | ${data.localCommits.length} |`)
  push(`| 相对基线改动文件数 | ${data.localDiffFiles.length} |`)
  push(`| 未提交改动文件数 | ${data.workingTree.total} |`)
  push(`| 双改文件数 | ${data.doubleModifiedFiles.length} |`)
  push(`| 上游与未提交改动重叠文件数 | ${data.workingTreeOverlapFiles.length} |`, '')

  push('## 本地提交', '')
  if (data.localCommits.length === 0) {
    push('当前分支没有相对基线的本地提交。', '')
  } else {
    push(`共 ${data.localCommits.length} 个本地提交（按提交时间倒序）：`, '')
    data.localCommits.forEach((commit, index) => {
      push(`### ${index + 1}. ${codeSpan(commit.shortHash)} ${escapeCell(commit.subject)}`, '')
      if (commit.files.length === 0) {
        push('- （无文件变化，可能是合并提交或空提交）', '')
        return
      }
      for (const file of commit.files) push(`- ${codeSpan(file)}`)
      push('')
    })
  }

  push('## 相对基线的改动文件（已提交）', '')
  if (data.localDiffFiles.length === 0) {
    push('无（本地还没有相对基线的已提交改动）。', '')
  } else {
    push(`共 ${data.localDiffFiles.length} 个文件：`, '')
    push('| 状态 | 文件 |')
    push('| --- | --- |')
    for (const file of data.localDiffFiles) {
      const label = file.from
        ? `${codeSpan(file.from)} → ${codeSpan(file.path)}`
        : codeSpan(file.path)
      push(`| ${file.status} | ${label} |`)
    }
    push('')
  }

  push('## 未提交改动（工作区）', '')
  if (!data.workingTree.dirty) {
    push('工作区干净（已忽略 `.fork/` 下的登记文件）。', '')
  } else {
    push(`共 ${data.workingTree.total} 项未提交改动（已忽略 \`.fork/\` 下的登记文件）：`)
    const groups = [
      ['新增', data.workingTree.added.map((file) => codeSpan(file))],
      ['修改', data.workingTree.modified.map((file) => codeSpan(file))],
      ['删除', data.workingTree.deleted.map((file) => codeSpan(file))],
      [
        '重命名',
        data.workingTree.renamed.map(
          (rename) => `${codeSpan(rename.from)} → ${codeSpan(rename.to)}`,
        ),
      ],
      ['未跟踪', data.workingTree.untracked.map((file) => codeSpan(file))],
    ]
    for (const [title, items] of groups) {
      push('')
      push(`### ${title}（${items.length}）`, '')
      if (items.length === 0) {
        push('无')
        continue
      }
      for (const item of items) push(`- ${item}`)
    }
    push('')
  }

  push('## 双改风险（上游与本地都改过）', '')
  push('> 定义：上游 `merge-base..upstream` 改动的文件 ∩ 本地 `merge-base..HEAD` 改动的文件；未提交改动与上游的重叠单独列出。', '')
  if (data.doubleModifiedFiles.length === 0 && data.workingTreeOverlapFiles.length === 0) {
    push('无：上游与本地相对基线没有同时改动的文件。', '')
  } else {
    if (data.doubleModifiedFiles.length > 0) {
      push(`已提交改动中的双改文件（${data.doubleModifiedFiles.length} 个）：`, '')
      for (const file of data.doubleModifiedFiles) push(`- ${codeSpan(file)}`)
      push('')
    }
    if (data.workingTreeOverlapFiles.length > 0) {
      push(`未提交改动与上游重叠的文件（${data.workingTreeOverlapFiles.length} 个，合并前请先提交或移开）：`, '')
      for (const file of data.workingTreeOverlapFiles) push(`- ${codeSpan(file)}`)
      push('')
    }
    push('同步时这些文件最可能产生冲突，建议先对照官方实现确认本地改造的保留方式。', '')
  }

  push('## 同步提示', '')
  push('- 同步前先提交本地改动，然后运行：`node .fork/fork.mjs sync`。')
  push('- 同步完成后重新运行 `node .fork/fork.mjs record` 更新本清单。')
  push('- 冲突处理原则：以官方实现为基线，逐项保留本地改造，不要整文件丢弃任何一侧。')

  return `${lines.join('\n')}\n`
}

/** 写入 upstream.json 与 changes.md，返回本次采集的数据与登记对象。 */
function writeRegistration(repo, upstream) {
  const data = collectStatusData(repo, upstream)
  const registry = buildRegistry(upstream, data)
  const registryDir = path.join(repo, REGISTRY_DIR)
  mkdirSync(registryDir, { recursive: true })
  writeFileSync(
    path.join(registryDir, REGISTRY_JSON),
    `${JSON.stringify(registry, null, 2)}\n`,
    'utf8',
  )
  writeFileSync(path.join(registryDir, CHANGES_MD), renderChangesMarkdown(upstream, data, registry), 'utf8')
  return { data, registry }
}

/** 本地改动的摘要（用于 JSON 输出）。 */
function summarizeLocalChanges(data) {
  return {
    commitCount: data.localCommits.length,
    commitShortHashes: data.localCommits.map((commit) => commit.shortHash),
    fileCount: data.localDiffFiles.length,
    workingTreeDirty: data.workingTree.dirty,
    workingTreeFileCount: data.workingTree.total,
    workingTree: {
      added: data.workingTree.added.length,
      modified: data.workingTree.modified.length,
      deleted: data.workingTree.deleted.length,
      untracked: data.workingTree.untracked.length,
      renamed: data.workingTree.renamed.length,
    },
    doubleModifiedFileCount: data.doubleModifiedFiles.length,
    doubleModifiedFiles: data.doubleModifiedFiles,
    workingTreeOverlapFiles: data.workingTreeOverlapFiles,
  }
}

/** 上游信息摘要（用于 JSON 输出）。 */
function summarizeUpstream(upstream, data) {
  return {
    remote: upstream.remote,
    branch: upstream.branch,
    ref: upstream.ref,
    head: data.upstreamHead,
    headShort: shortHash(data.upstreamHead),
    headSubject: data.upstreamHeadSubject,
  }
}

/** 解析命令行参数。 */
function parseArgv(argv) {
  const options = {
    command: null,
    repo: null,
    upstream: DEFAULT_UPSTREAM,
    json: false,
    fetch: false,
    help: false,
  }
  const positional = []
  const usageError = (message, hint) => new UserError(message, hint, 2)

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '-h' || arg === '--help') {
      options.help = true
      continue
    }
    if (arg === '--json') {
      options.json = true
      continue
    }
    if (arg === '--fetch') {
      options.fetch = true
      continue
    }
    if (arg === '--repo' || arg === '--upstream') {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('-')) {
        throw usageError(
          `选项 ${arg} 缺少参数值。`,
          '示例：--repo "/path/to/repo"、--upstream origin/master。',
        )
      }
      options[arg === '--repo' ? 'repo' : 'upstream'] = value
      index += 1
      continue
    }
    if (arg.startsWith('--repo=') || arg.startsWith('--upstream=')) {
      const [name, value] = arg.split('=', 2)
      if (value === '') {
        throw usageError(`选项 ${name} 缺少参数值。`, '示例：--upstream origin/master。')
      }
      options[name === '--repo' ? 'repo' : 'upstream'] = value
      continue
    }
    if (arg.startsWith('-')) {
      throw usageError(
        `未知选项：${arg}`,
        '运行 node .fork/fork.mjs --help 查看支持的选项。',
      )
    }
    positional.push(arg)
  }

  if (positional.length > 1) {
    throw usageError(
      `多余的参数：${positional.slice(1).join(' ')}`,
      '用法：node .fork/fork.mjs <命令> [选项]；运行 --help 查看说明。',
    )
  }
  if (positional.length === 1) {
    const command = positional[0]
    if (!COMMANDS.has(command)) {
      throw usageError(
        `未知命令：${command}`,
        `支持的子命令：${[...COMMANDS].join('、')}。运行 node .fork/fork.mjs --help 查看说明。`,
      )
    }
    options.command = command
  }
  return options
}

/** 解析仓库、上游，并按需 fetch。 */
function prepare(options) {
  const repo = resolveRepo(options.repo)
  const upstream = parseUpstream(options.upstream)
  verifyRemote(repo, upstream)
  if (options.fetch) fetchUpstream(repo, upstream)
  verifyUpstreamRef(repo, upstream)
  return { repo, upstream }
}

/** status 子命令。 */
function commandStatus(options) {
  const { repo, upstream } = prepare(options)
  const data = collectStatusData(repo, upstream)
  const registry = readRegistry(repo)
  const registryState = evaluateRegistry({ registry, upstream, data })

  if (options.json) {
    print(
      JSON.stringify(
        {
          command: 'status',
          repo,
          upstream: summarizeUpstream(upstream, data),
          base: {
            commit: data.mergeBase,
            shortCommit: shortHash(data.mergeBase),
            subject: data.mergeBaseSubject,
          },
          localBranch: data.localBranch,
          ahead: data.ahead,
          behind: data.behind,
          localCommits: data.localCommits.map((commit) => ({
            hash: commit.hash,
            shortHash: commit.shortHash,
            subject: commit.subject,
            files: commit.files,
          })),
          localFiles: data.localDiffFiles,
          workingTree: {
            dirty: data.workingTree.dirty,
            total: data.workingTree.total,
            added: data.workingTree.added,
            modified: data.workingTree.modified,
            deleted: data.workingTree.deleted,
            untracked: data.workingTree.untracked,
            renamed: data.workingTree.renamed,
          },
          upstreamChangedFileCount: data.upstreamChangedFiles.length,
          doubleModifiedFiles: data.doubleModifiedFiles,
          workingTreeOverlapFiles: data.workingTreeOverlapFiles,
          registry: registryState,
        },
        null,
        2,
      ),
    )
    return 0
  }

  print(`仓库：${repo}`)
  print(`上游：${upstream.ref}`)
  print(`  上游 head：${shortHash(data.upstreamHead)} ${data.upstreamHeadSubject}`)
  print(`  基线（merge-base）：${shortHash(data.mergeBase)} ${data.mergeBaseSubject}`)
  print(`本地分支：${data.localBranch}`)
  print(`领先 / 落后：ahead ${data.ahead}，behind ${data.behind}`)
  print('')
  if (data.localCommits.length === 0) {
    print('本地提交（相对基线）：无')
  } else {
    print(`本地提交（相对基线，${data.localCommits.length} 个）：`)
    for (const commit of data.localCommits) print(`  - ${commit.shortHash}  ${commit.subject}`)
  }
  print('')
  if (data.localDiffFiles.length === 0) {
    print('相对基线的改动文件：无')
  } else {
    print(`相对基线的改动文件（${data.localDiffFiles.length} 个）：`)
    for (const file of data.localDiffFiles) {
      print(`  ${file.status}  ${file.from ? `${file.from} → ${file.path}` : file.path}`)
    }
  }
  print('')
  if (!data.workingTree.dirty) {
    print('未提交改动（工作区）：无（已忽略 .fork/ 下的登记文件）')
  } else {
    print(`未提交改动（工作区，${data.workingTree.total} 项）：`)
    print(describeWorkingTree(data.workingTree).join('\n'))
  }
  print('')
  if (data.doubleModifiedFiles.length === 0) {
    print('双改文件（上游与本地已提交改动都改过）：无')
  } else {
    print(`双改文件（上游与本地已提交改动都改过，${data.doubleModifiedFiles.length} 个）：`)
    for (const file of data.doubleModifiedFiles) print(`  - ${file}`)
  }
  if (data.workingTreeOverlapFiles.length > 0) {
    print(`未提交改动与上游重叠的文件（${data.workingTreeOverlapFiles.length} 个，合并前请先提交或移开）：`)
    for (const file of data.workingTreeOverlapFiles) print(`  - ${file}`)
  }
  print('')
  if (!registryState.exists) {
    print(`登记状态：未登记（运行 node .fork/fork.mjs record 生成 ${REGISTRY_REL}）`)
  } else if (registryState.parseError) {
    print(`登记状态：无法解析（${REGISTRY_REL} 不是合法 JSON，运行 record 覆盖）`)
  } else if (registryState.expired) {
    print('登记状态：已过期')
    for (const reason of registryState.reasons) print(`  - ${reason}`)
    print('  建议：运行 node .fork/fork.mjs record 重新登记。')
  } else {
    print(
      `登记状态：有效（记录于 ${registryState.recordedAt ?? '未知时间'}，本地时间 ${formatLocalTime(registryState.recordedAt)}）`,
    )
  }
  for (const warning of registryState.warnings) print(`注意：${warning}`)
  print('')
  print('提示：node .fork/fork.mjs status --fetch 可先更新上游引用；同步请用 node .fork/fork.mjs sync。')
  return 0
}

/** record 子命令。 */
function commandRecord(options) {
  const { repo, upstream } = prepare(options)
  const { data, registry } = writeRegistration(repo, upstream)

  if (options.json) {
    print(
      JSON.stringify(
        {
          command: 'record',
          ok: true,
          registryPath: REGISTRY_REL,
          changesPath: CHANGES_REL,
          recordedAt: registry.recordedAt,
          upstream: summarizeUpstream(upstream, data),
          baseCommit: data.mergeBase,
          baseSubject: data.mergeBaseSubject,
          localBranch: data.localBranch,
          ahead: data.ahead,
          behind: data.behind,
          localChanges: summarizeLocalChanges(data),
        },
        null,
        2,
      ),
    )
    return 0
  }

  print(`✔ 登记已更新：${REGISTRY_REL}、${CHANGES_REL}`)
  print(`  记录时间：${registry.recordedAt}（本地时间 ${formatLocalTime(registry.recordedAt)}）`)
  print(`  上游：${upstream.ref} @ ${shortHash(data.upstreamHead)} ${data.upstreamHeadSubject}`)
  print(`  基线：${shortHash(data.mergeBase)} ${data.mergeBaseSubject}`)
  print(`  本地分支：${data.localBranch}，ahead ${data.ahead} / behind ${data.behind}`)
  print(
    `  本地改动：${data.localCommits.length} 个提交、${data.localDiffFiles.length} 个已提交改动文件、${data.workingTree.total} 项未提交改动、${data.doubleModifiedFiles.length} 个双改文件`,
  )
  return 0
}

/** check 子命令。 */
function commandCheck(options) {
  const { repo, upstream } = prepare(options)
  const data = collectStatusData(repo, upstream)
  const registry = readRegistry(repo)
  const registryState = evaluateRegistry({ registry, upstream, data })
  const ok = !registryState.expired

  if (options.json) {
    print(
      JSON.stringify(
        {
          command: 'check',
          ok,
          registry: registryState,
          upstream: summarizeUpstream(upstream, data),
          baseCommit: data.mergeBase,
          localBranch: data.localBranch,
          ahead: data.ahead,
          behind: data.behind,
          localChanges: summarizeLocalChanges(data),
        },
        null,
        2,
      ),
    )
    return ok ? 0 : 1
  }

  if (ok) {
    print(`✔ 登记有效：${REGISTRY_REL} 与当前仓库状态一致。`)
    print(`  记录时间：${registryState.recordedAt ?? '未知'}`)
    print(`  上游：${upstream.ref} @ ${shortHash(data.upstreamHead)} ${data.upstreamHeadSubject}`)
    print(`  基线：${shortHash(data.mergeBase)} ${data.mergeBaseSubject}`)
    print(`  本地分支：${data.localBranch}，ahead ${data.ahead} / behind ${data.behind}`)
    print(
      `  本地改动：${data.localCommits.length} 个提交、${data.localDiffFiles.length} 个已提交改动文件、${data.workingTree.total} 项未提交改动`,
    )
    for (const warning of registryState.warnings) print(`  注意：${warning}`)
    return 0
  }

  print('✖ 登记无效或不一致，不能作为提交前/打包前的自检依据。')
  print('  原因：')
  for (const reason of registryState.reasons) print(`    - ${reason}`)
  if (registryState.warnings.length > 0) {
    print('  注意：')
    for (const warning of registryState.warnings) print(`    - ${warning}`)
  }
  print(`  处理：运行 node .fork/fork.mjs record 重新生成登记（只写 .fork/ 下的文件，不改动代码）。`)
  return 1
}

/** sync 子命令：fetch → 备份 → merge；无冲突自动提交并 record，有冲突停在冲突状态。 */
function commandSync(options) {
  const repo = resolveRepo(options.repo)
  const upstream = parseUpstream(options.upstream)
  verifyRemote(repo, upstream)

  const mergeHeadProbe = runGit(repo, ['rev-parse', '--quiet', '--verify', 'MERGE_HEAD'], {
    allowFailure: true,
  })
  if (mergeHeadProbe.status === 0) {
    throw new UserError(
      '当前仓库有进行中的 merge（MERGE_HEAD 存在），无法开始新的同步。',
      '请先完成该 merge（git commit）或放弃（git merge --abort），然后重试。',
    )
  }

  const branchProbe = runGit(repo, ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
    allowFailure: true,
  })
  if (branchProbe.status !== 0) {
    throw new UserError(
      '当前处于 detached HEAD 状态（没有本地分支），无法安全同步。',
      '请先切换到一个本地分支（例如 git switch master），再运行 sync。',
    )
  }
  const localBranch = branchProbe.stdout.trim()

  const dirtyBefore = collectWorkingTree(repo)
  if (dirtyBefore.dirty) {
    throw new UserError(
      `工作区不干净（${dirtyBefore.total} 项未提交改动），已停止同步，未做任何 git 操作。`,
      `请先提交、git stash push -u 暂存，或运行 node .fork/fork.mjs record 记录当前改动后再处理。\n当前未提交改动：\n${describeWorkingTree(dirtyBefore).join('\n')}`,
    )
  }

  fetchUpstream(repo, upstream)
  verifyUpstreamRef(repo, upstream)
  const before = collectStatusData(repo, upstream)

  if (before.behind === 0) {
    if (options.json) {
      print(
        JSON.stringify(
          {
            command: 'sync',
            ok: true,
            upToDate: true,
            upstream: summarizeUpstream(upstream, before),
            localBranch,
            ahead: before.ahead,
            behind: 0,
          },
          null,
          2,
        ),
      )
    } else {
      print(
        `✔ 已是最新：${upstream.ref} @ ${shortHash(before.upstreamHead)} ${before.upstreamHeadSubject}`,
      )
      print('  当前分支已包含上游全部提交，无需合并。')
    }
    return 0
  }

  const backupBranch = `backup/${localBranch}-${timestamp()}`
  const backup = runGit(repo, ['branch', backupBranch, 'HEAD'], { allowFailure: true })
  if (!backup.ok) {
    const detail = (backup.stderr || backup.stdout).trim()
    throw new UserError(
      `创建备份分支失败：${backupBranch}${detail ? `\n${detail}` : ''}`,
      '工作区尚未做任何改动。请检查上面 git 的输出（例如同名分支已存在），处理后重试。',
    )
  }
  info(`已创建备份分支：${backupBranch}`)

  info(`正在合并上游：git merge --no-commit ${upstream.ref}`)
  const merge = runGit(repo, ['merge', '--no-commit', upstream.ref], { allowFailure: true })
  const conflictFiles = splitNul(
    runGit(repo, ['diff', '--name-only', '--diff-filter=U', '-z'], { allowFailure: true }).stdout,
  )
  const mergeHeadExists =
    runGit(repo, ['rev-parse', '--quiet', '--verify', 'MERGE_HEAD'], { allowFailure: true }).status === 0

  if (conflictFiles.length > 0) {
    const lines = [
      `✖ 同步中断：合并 ${upstream.ref} 时产生 ${conflictFiles.length} 个冲突文件。`,
      '  已按原样保留冲突状态：没有自动解决冲突，也没有丢弃任何一侧的改动。',
      '  冲突文件：',
      ...conflictFiles.map((file) => `    - ${file}`),
      '  建议处理方式（以官方实现为基线，逐项保留本地改造）：',
      '    1. 逐个打开冲突文件，阅读 <<<<<<< / ======= / >>>>>>> 标记，先理解官方的新实现；',
      '    2. 把本地改造逐项重新应用到官方实现之上，不要整文件选择一方；',
      '    3. 解决后执行 git add <文件>；全部解决后执行 git commit 完成合并提交；',
      '    4. 如需暂时放弃本次同步：git merge --abort（回到同步前状态，备份分支仍然保留）。',
      '  不要使用 git checkout --ours/--theirs 整文件丢弃另一侧改动。',
      `  解决完成后运行 node .fork/fork.mjs record 更新登记。备份分支：${backupBranch}`,
    ]
    for (const line of lines) info(line)
    if (options.json) {
      print(
        JSON.stringify(
          {
            command: 'sync',
            ok: false,
            conflict: true,
            upstream: summarizeUpstream(upstream, before),
            localBranch,
            conflictFiles,
            backupBranch,
          },
          null,
          2,
        ),
      )
    }
    return 1
  }

  if (!merge.ok && !mergeHeadExists) {
    const detail = (merge.stderr || merge.stdout).trim()
    throw new UserError(
      `合并上游失败：${formatCommand(['merge', '--no-commit', upstream.ref])}（退出码 ${merge.status}）${detail ? `\n${detail}` : ''}`,
      `已创建备份分支：${backupBranch}。本次合并没有留下冲突状态，请按上面的 git 输出排查原因，或手动执行该命令复现。`,
    )
  }

  if (!mergeHeadExists) {
    info(`合并结果为空（上游已包含在当前分支中），未创建合并提交。备份分支保留：${backupBranch}`)
    if (options.json) {
      print(
        JSON.stringify(
          {
            command: 'sync',
            ok: true,
            upToDate: true,
            upstream: summarizeUpstream(upstream, before),
            localBranch,
            backupBranch,
          },
          null,
          2,
        ),
      )
    } else {
      print('✔ 已是最新：无需创建合并提交。')
    }
    return 0
  }

  const commitMessage = [
    `merge: 同步上游 ${upstream.ref}`,
    '',
    `上游提交：${shortHash(before.upstreamHead)} ${before.upstreamHeadSubject}`,
    `同步范围：本地领先 ${before.ahead} 个提交，落后 ${before.behind} 个提交`,
    `备份分支：${backupBranch}`,
    '',
    '由 node .fork/fork.mjs sync 自动创建。',
  ].join('\n')
  info('正在创建合并提交…')
  const commit = runGit(repo, ['commit', '-m', commitMessage], { allowFailure: true })
  if (!commit.ok) {
    const detail = (commit.stderr || commit.stdout).trim()
    throw new UserError(
      `合并结果已暂存，但创建合并提交失败（退出码 ${commit.status}）${detail ? `\n${detail}` : ''}`,
      `请检查上面的输出了解失败原因（例如 pre-commit 钩子）；处理后执行 git commit 完成提交，或 git merge --abort 放弃。备份分支：${backupBranch}。`,
    )
  }
  const mergeCommit = gitOut(repo, ['rev-parse', 'HEAD'])
  info(`已创建合并提交：${shortHash(mergeCommit)}`)

  let recordResult
  try {
    recordResult = writeRegistration(repo, upstream)
  } catch (error) {
    const message = error instanceof UserError ? error.message : String(error)
    throw new UserError(
      `同步已完成（合并提交 ${shortHash(mergeCommit)}），但自动 record 失败：${message}`,
      '请手动运行 node .fork/fork.mjs record 更新登记；本次同步本身已提交。',
    )
  }

  if (options.json) {
    print(
      JSON.stringify(
        {
          command: 'sync',
          ok: true,
          upstream: summarizeUpstream(upstream, before),
          localBranch,
          before: {
            baseCommit: before.mergeBase,
            ahead: before.ahead,
            behind: before.behind,
            upstreamHead: before.upstreamHead,
          },
          backupBranch,
          mergeCommit,
          mergeCommitShort: shortHash(mergeCommit),
          recorded: true,
          registryPath: REGISTRY_REL,
          changesPath: CHANGES_REL,
          localChanges: summarizeLocalChanges(recordResult.data),
        },
        null,
        2,
      ),
    )
    return 0
  }

  print('✔ 同步完成')
  print(`  上游：${upstream.ref} @ ${shortHash(before.upstreamHead)} ${before.upstreamHeadSubject}`)
  print(
    `  合并范围：上游新增 ${before.behind} 个提交（${shortHash(before.mergeBase)} → ${shortHash(before.upstreamHead)}）`,
  )
  print(`  备份分支：${backupBranch}`)
  print(`  合并提交：${shortHash(mergeCommit)}`)
  print(`  登记已更新：${REGISTRY_REL}、${CHANGES_REL}`)
  print('  后续建议：pnpm install && pnpm run build && pnpm run test')
  return 0
}

const HELP_TEXT = `fork.mjs — 跟进官方主仓库的本地登记工具（零依赖，需要 Node >= 24 与 git）

用法：
  node .fork/fork.mjs <命令> [选项]

命令：
  status   查看上游 / 基线 / 本地提交 / 改动文件 / 双改文件 / 登记状态
  record   生成或更新 .fork/upstream.json 与 .fork/changes.md
  check    校验登记是否缺失、过期或与当前状态不一致（提交前、打包前自检）
  sync     安全同步上游：fetch → 备份分支 → merge（无冲突自动合并提交并 record）

全局选项：
  --upstream <remote>/<branch>  上游引用，默认 origin/master
  --repo <path>                 仓库路径，默认脚本所在仓库（可指向任意 git 仓库）
  --json                        以纯 JSON 输出到 stdout（进度/提示/错误走 stderr）
  --fetch                       先执行 git fetch <remote>（status/record/check 可用）
  -h, --help                    显示本帮助

示例：
  node .fork/fork.mjs status
  node .fork/fork.mjs status --fetch
  node .fork/fork.mjs status --json
  node .fork/fork.mjs record
  node .fork/fork.mjs check; echo $?
  node .fork/fork.mjs sync

退出码：
  0  成功 / 登记有效 / 已是最新
  1  登记缺失或无效 / 命令执行失败 / 同步遇到冲突
  2  参数或用法错误

说明：
  - 本工具只写 .fork/ 下的 upstream.json 与 changes.md，不会修改其它文件。
  - status/record/check 默认不联网；sync 总会先 git fetch 上游 remote。
  - sync 要求工作区干净，并会先创建备份分支；有冲突时停在冲突状态，绝不自动解决或丢弃改动。
  - .fork/ 下的登记文件不计入工作区改动与双改统计，避免登记自身污染结果。
  详细流程与字段说明见 .fork/README.md。`

/** 入口。 */
function main(argv) {
  const options = parseArgv(argv)
  if (options.help) {
    print(HELP_TEXT)
    return 0
  }
  if (!options.command) {
    info('✖ 未指定子命令。')
    print(HELP_TEXT)
    return 2
  }
  switch (options.command) {
    case 'status':
      return commandStatus(options)
    case 'record':
      return commandRecord(options)
    case 'check':
      return commandCheck(options)
    case 'sync':
      return commandSync(options)
    default:
      throw new UserError(
        `未知命令：${options.command}`,
        '运行 node .fork/fork.mjs --help 查看支持的子命令。',
        2,
      )
  }
}

try {
  process.exitCode = main(process.argv.slice(2))
} catch (error) {
  if (error instanceof UserError) {
    info(`✖ ${error.message}`)
    if (error.hint) info(`  → ${error.hint}`)
    process.exitCode = error.exitCode ?? 1
  } else {
    info(`✖ 未预期的错误：${error && error.stack ? error.stack : String(error)}`)
    process.exitCode = 1
  }
}
