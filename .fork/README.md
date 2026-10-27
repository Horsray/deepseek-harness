# `.fork/` — 官方主仓库跟进登记

本目录是本仓库（fork）用来**持续跟进官方主仓库**的本地登记中心：记录当前跟随的官方基线、本地相对基线的全部改动、上游与本地都要改的文件（双改风险），并提供一条命令完成差异报告与安全同步。

- 官方主仓库：`origin` = <https://github.com/deepseek-ai/deepseek-harness.git>
- 默认上游引用：`origin/master`
- 原则：官方仓库是基线，本地改造做在本地分支上；定期把 `origin/master` 合并进来，冲突时**以官方实现为基线、逐项保留本地改造**。
- 本目录由 fork 维护，官方仓库没有这套登记；它不依赖任何 npm 包，也不参与官方校验。

## 目录与文件

| 文件 | 说明 |
| --- | --- |
| `README.md` | 本说明。 |
| `fork.mjs` | 零依赖 CLI（纯 Node ESM，`node >= 24`；用 `node:child_process` 调 git）。 |
| `upstream.json` | 机器可读登记：上游 head、基线 commit、本地改动快照。由 `record` 生成，请勿手改。 |
| `changes.md` | 人读的本地改动清单：提交、文件、未提交改动、双改风险。由 `record` 生成，请勿手改。 |

建议把 `.fork/` 一起纳入 fork 的版本管理（`git add .fork && git commit`），这样登记随分支可追溯；`record` 更新 `upstream.json` / `changes.md` 时，把它们和代码改动一起提交即可。

## 前置条件

- `node --version` ≥ 24（脚本使用 ESM、`import.meta.dirname`）。
- 已安装 git（建议 ≥ 2.20；用到 `status --porcelain=v1 -z`、`diff --name-status -z`、`-uall`）。
- `origin` 指向官方主仓库：`git remote -v` 应能看到 `origin	https://github.com/deepseek-ai/deepseek-harness.git`。
- 无需 `pnpm install`，无需任何第三方依赖。

## 快速开始

```sh
node .fork/fork.mjs --help
node .fork/fork.mjs status
node .fork/fork.mjs status --fetch
node .fork/fork.mjs status --json
node .fork/fork.mjs record
node .fork/fork.mjs check; echo $?
node .fork/fork.mjs sync
```

通用选项：

| 选项 | 说明 |
| --- | --- |
| `--upstream <remote>/<branch>` | 上游引用，默认 `origin/master`。 |
| `--repo <path>` | 目标仓库路径，默认脚本所在仓库；可指向任意 git 仓库（例如另一个 clone）。 |
| `--json` | 以纯 JSON 输出到 stdout，进度/提示/错误走 stderr。 |
| `--fetch` | 先执行 `git fetch <remote>`（`status` / `record` / `check` 可用）。 |
| `-h`, `--help` | 帮助。 |

退出码：`0` = 成功 / 登记有效 / 已是最新；`1` = 登记缺失或无效、命令失败、同步遇到冲突；`2` = 参数或用法错误。

## 日常流程（改代码 → record → 同步）

1. 照常在**本地分支**上改代码，提交到本地分支（不要直接往 `origin` 推送）。
2. 一批改动完成后运行 `node .fork/fork.mjs record`，让登记反映当前基线、提交和未提交改动；`upstream.json` / `changes.md` 可以和代码一起提交。
3. 需要跟进官方时，先看状态：

   ```sh
   node .fork/fork.mjs status --fetch
   ```

   关注 `ahead` / `behind`、双改文件列表，以及“登记状态”。
4. 确认工作区干净（有未提交改动先 commit 或 `git stash push -u`），然后同步：

   ```sh
   node .fork/fork.mjs sync
   ```

5. `sync` 会：`git fetch origin` → 创建备份分支 `backup/<当前分支>-<YYYYmmdd-HHMMSS>` → `git merge --no-commit origin/master`。
   - **无冲突**：自动创建中文合并提交（包含上游短 hash 与标题），并自动 `record`。
   - **有冲突**：停在冲突状态，列出冲突文件，给出处理建议；**不会**自动 `checkout`、`reset` 或丢弃任何一侧改动。
6. 按“以官方实现为基线、逐项保留本地改造”的方针对冲突文件逐个处理：去掉 `<<<<<<<` / `=======` / `>>>>>>>` 标记，`git add <文件>`，全部解决后 `git commit`。
7. 无论自动还是手工解决，完成后重新登记并自检：

   ```sh
   node .fork/fork.mjs record
   node .fork/fork.mjs check
   ```

8. 重建与验证（本仓库）：

   ```sh
   pnpm install
   pnpm run build
   pnpm run test
   ```

## 手工同步步骤（不使用 `sync` 时）

`sync` 只是把下面的流程脚本化；需要更细粒度控制（例如先在 worktree 里试合并）时可以手工执行：

```sh
# 1. 确认当前状态与上游引用
node .fork/fork.mjs status --fetch

# 2. 工作区必须干净；否则先提交，或 git stash push -u
git status --porcelain

# 3. 记录同步前的状态（方便对照和回退）
node .fork/fork.mjs record

# 4. 获取上游并创建备份分支
git fetch origin
BACKUP="backup/$(git branch --show-current)-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP" HEAD

# 5. 合并上游，停在提交前（--no-commit 便于检查）
git merge --no-commit origin/master

# 6a. 无冲突：检查暂存内容后提交
git diff --cached --stat
git commit -m "merge: 同步上游 origin/master"

# 6b. 有冲突：查看冲突文件，逐个解决
git diff --name-only --diff-filter=U
#    ……按“官方为基线 + 保留本地改造”修改每个文件……
git add <已解决的文件>
git commit            # 使用默认合并信息，或改成中文

# 6c. 需要放弃本次同步：回到同步前状态（备份分支仍保留）
git merge --abort

# 7. 重新登记并校验
node .fork/fork.mjs record
node .fork/fork.mjs check

# 8. 重建与验证
pnpm install && pnpm run build && pnpm run test
```

回退提示：如需完全回到同步前，可 `git reset --hard "$BACKUP"`。这会丢弃当前未提交改动，执行前务必确认。备份分支不会自动清理，确认同步结果无误后可用 `git branch -D <备份分支>` 删除。

## `check` 的用法（提交前 / 打包前）

`check` 用来回答一个问题：**当前登记是否仍然描述这个仓库的真实状态？** 它比对登记里的 `baseCommit`（merge-base）、上游 ref/head、本地分支、`ahead`、已提交改动文件清单和未提交改动清单。

- 提交前自检：

  ```sh
  node .fork/fork.mjs record && node .fork/fork.mjs check || { echo "登记不一致，请先查看原因"; exit 1; }
  ```

  （如果只想校验、不想改文件，直接 `node .fork/fork.mjs check; echo $?`。）

- 打包 / 发布前自检：先确认工作区状态已被登记（必要时先 `record`），再跑 `check`；`check` 返回 0 才继续打包。

- `check` 判定为非零的情况：登记文件缺失；`baseCommit` 与当前 merge-base 不一致；登记的上游 ref 与当前 `--upstream` 不一致；上游 head 已变化且本地落后；本地分支、`ahead`、已提交改动文件、未提交改动的文件清单与登记不一致。

- 局限：`check` 比较的是**路径与状态快照**，不比较文件内容；同一路径、同一状态下的内容修改不会让登记失效。

- 退出码：`0` 有效；`1` 缺失/失效；`2` 参数错误。可放进 pre-push hook 或 CI 的打包前置步骤。

## `upstream.json` 字段含义

| 字段 | 含义 |
| --- | --- |
| `schemaVersion` | 登记格式版本，当前为 `1`。 |
| `recordedAt` | 生成时间（ISO 8601，UTC）。 |
| `upstream.remote` / `upstream.branch` / `upstream.ref` | 上游 remote 名、分支名、完整引用，例如 `origin` / `master` / `origin/master`。 |
| `upstream.head` / `upstream.headShort` / `upstream.headSubject` | `record` 时上游 head 的完整 hash、短 hash 和标题。 |
| `baseCommit` / `baseSubject` | 基线：`record` 时本地分支与上游的 merge-base（共同祖先）及标题。 |
| `localBranch` | `record` 时的本地分支名（detached 时是字面量 `(detached HEAD)`）。 |
| `ahead` / `behind` | 相对上游 head：本地领先 / 落后的提交数。 |
| `localChanges.commits[]` | 相对基线的本地提交：`hash`、`shortHash`、`subject`、`files`（相对第一父提交的改动文件）。 |
| `localChanges.files[]` | 相对基线的已提交改动文件：`status`（`A`/`M`/`D`/`R…`）、`path`，重命名时另有 `from`。 |
| `localChanges.workingTreeDirty` | 是否有未提交改动（`workingTree.dirty` 的便捷副本）。 |
| `localChanges.workingTree` | 未提交改动分类：`dirty`、`added`、`modified`、`deleted`、`untracked`、`renamed`。 |
| `localChanges.doubleModifiedFiles` | 双改文件：上游 `merge-base..upstream` 与本地 `merge-base..HEAD` 改动文件的交集。 |
| `localChanges.workingTreeOverlapFiles` | 未提交改动中与上游改动重叠的文件（合并前应先提交或移开）。 |

注意：以上统计都**忽略 `.fork/` 下的文件**，避免登记自身把工作区弄脏或产生假的双改。

## 如何修改默认上游

- 临时用另一个分支：`node .fork/fork.mjs status --upstream origin/main`、`node .fork/fork.mjs sync --upstream origin/main`。
- 增加第二个 remote（例如保留官方 remote，同时跟踪另一个镜像）：

  ```sh
  git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
  git fetch upstream
  node .fork/fork.mjs status --upstream upstream/master
  ```

- 永久修改默认值：编辑 `fork.mjs` 顶部的 `const DEFAULT_UPSTREAM = 'origin/master'`，改成目标引用（例如 `upstream/master`），或直接调整 `origin` 的 URL（`git remote set-url origin <url>`）。
- 改完默认上游后必须重新 `record`；`check` 会发现登记的上游 ref 与当前 `--upstream` 不一致并报错。

## 安全边界与已知限制

- `fork.mjs` 只写 `.fork/upstream.json` 与 `.fork/changes.md`，不会修改仓库其它文件。
- `status` / `record` / `check` 默认不联网；只有 `--fetch` 和 `sync` 会执行 `git fetch`。
- `sync` 在开始前检查工作区是否干净（忽略 `.fork/`），要求没有进行中的 merge；同步前先创建备份分支；遇到冲突时停留在冲突状态，绝不自动解决或丢弃一侧改动。
- `sync` 无冲突时会自动创建合并提交（可能触发仓库的 pre-commit 钩子）；若提交失败，合并结果会保留为已暂存状态，按提示手工 `git commit` 或 `git merge --abort` 即可。
- `--json` 的 stdout 只有 JSON；所有进度、警告和错误都在 stderr。数据里没有随机内容，便于脚本消费。
- `record` 每次都会刷新 `recordedAt`，即使没有实质变化也会产生一次文件改动；提交时一并带上即可。

## 常见问题

- **提示“不是 git 仓库”**：在仓库内运行，或用 `--repo <仓库路径>` 指向正确的 clone。
- **提示“上游 remote 不存在”**：`git remote add origin https://github.com/deepseek-ai/deepseek-harness.git`，或用 `--upstream` 指向已有 remote。
- **提示“上游分支不存在”**：先 `git fetch origin`，确认远端分支名（本仓库官方分支是 `master`）。
- **`sync` 拒绝执行（工作区不干净）**：先 commit，或 `git stash push -u` 暂存；也可以先 `record` 记录现状，清理后再同步。
- **同步后 `check` 失败**：多半是同步后有新的本地提交或未提交改动，重新 `record` 即可；若提示登记的上游不一致，检查 `--upstream` 是否和登记时相同。
- **遇到冲突想退出**：`git merge --abort` 回到同步前状态（本工具不会阻止你这样做，备份分支也还在）。
