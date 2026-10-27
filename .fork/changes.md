# 本地改动清单（fork 相对上游）

> 本文件由 `node .fork/fork.mjs record` 自动生成，请勿手工编辑。
> 生成时间：2026-10-27T22:31:48.832Z（本地时间 2026-10-28 06:31:48）

## 概览

| 项目 | 值 |
| --- | --- |
| 上游 | `origin/master` |
| 上游 head | `22ddee3` Merge pull request #7075 from deepseek-harness/worktree-chatgap |
| 基线（merge-base） | `22ddee3` Merge pull request #7075 from deepseek-harness/worktree-chatgap |
| 本地分支 | `master` |
| 领先 / 落后 | ahead 0 / behind 0 |
| 本地提交数 | 0 |
| 相对基线改动文件数 | 0 |
| 未提交改动文件数 | 123 |
| 双改文件数 | 0 |
| 上游与未提交改动重叠文件数 | 0 |

## 本地提交

当前分支没有相对基线的本地提交。

## 相对基线的改动文件（已提交）

无（本地还没有相对基线的已提交改动）。

## 未提交改动（工作区）

共 123 项未提交改动（已忽略 `.fork/` 下的登记文件）：

### 新增（58）

- `apps/desktop/scripts/verify-macos-bundle-localization.d.mts`
- `apps/desktop/scripts/verify-macos-bundle-localization.mjs`
- `apps/desktop/tests/macos-bundle-localization.spec.ts`
- `huiying-logo/app-icon-1024.png`
- `huiying-logo/build_logo.py`
- `huiying-logo/icon-dark.png`
- `huiying-logo/icon-light.png`
- `huiying-logo/logo-horizontal-dark.png`
- `huiying-logo/logo-vertical-dark.png`
- `huiying-logo/logo-vertical-light.png`
- `huiying-logo/mark-flat-1024.png`
- `huiying-logo/mark-glow-transparent-1024.png`
- `huiying-logo/mark.png`
- `huiying-logo/v1-aperture-glow.png`
- `huiying-logo/v1b-refined.png`
- `huiying-logo/v2-brush-shadow.png`
- `huiying-logo/v3-wordmark.png`
- `packages/client/ui-brand-official/src/client/Brand.module.css`
- `packages/client/ui-brand-official/src/client/assets/company-mark-dark.webp`
- `packages/client/ui-brand-official/src/client/assets/company-mark.webp`
- `packages/client/ui-brand-official/src/client/assets/company-wordmark-dark.webp`
- `packages/client/ui-brand-official/src/client/assets/company-wordmark.webp`
- `packages/client/ui-brand-official/src/css-modules.d.ts`
- `packages/client/ui-directory-picker-browse/src/client/folder-names.ts`
- `packages/client/ui-quick-script/README.i18n.yaml`
- `packages/client/ui-quick-script/README.md`
- `packages/client/ui-quick-script/README.zh.md`
- `packages/client/ui-quick-script/locale/de.json`
- `packages/client/ui-quick-script/locale/en.json`
- `packages/client/ui-quick-script/locale/es.json`
- `packages/client/ui-quick-script/locale/fr.json`
- `packages/client/ui-quick-script/locale/ja.json`
- `packages/client/ui-quick-script/locale/pt.json`
- `packages/client/ui-quick-script/locale/ru.json`
- `packages/client/ui-quick-script/locale/zh.json`
- `packages/client/ui-quick-script/package.json`
- `packages/client/ui-quick-script/src/client/QuickScriptMenu.module.css`
- `packages/client/ui-quick-script/src/client/QuickScriptMenu.tsx`
- `packages/client/ui-quick-script/src/client/card-position.ts`
- `packages/client/ui-quick-script/src/client/index.ts`
- `packages/client/ui-quick-script/src/client/locales.ts`
- `packages/client/ui-quick-script/src/client/quick-script.ts`
- `packages/client/ui-quick-script/src/client/terminal-run.ts`
- `packages/client/ui-quick-script/src/css-modules.d.ts`
- `packages/client/ui-quick-script/src/index.ts`
- `packages/client/ui-quick-script/tests/quick-script.client.spec.tsx`
- `packages/client/ui-quick-script/tsconfig.json`
- `packages/client/ui-quick-script/tsdown.config.ts`
- `packages/experimental/agnes-media/README.md`
- `packages/experimental/agnes-media/cordis.patch.yml`
- `packages/experimental/agnes-media/icon.svg`
- `packages/experimental/agnes-media/locale/en.json`
- `packages/experimental/agnes-media/locale/zh.json`
- `packages/experimental/agnes-media/package.json`
- `packages/experimental/agnes-media/src/index.ts`
- `packages/experimental/agnes-media/tests/index.spec.ts`
- `packages/experimental/agnes-media/tsconfig.json`
- `packages/experimental/agnes-media/tsdown.config.ts`

### 修改（35）

- `apps/desktop/scripts/electron-builder-config.mjs`
- `docs/config-catalog.md`
- `docs/config-catalog.zh.md`
- `docs/module-graph.md`
- `docs/module-graph.zh.md`
- `packages/bundle/web-app/cordis.patch.yml`
- `packages/bundle/web-app/package.json`
- `packages/client/ui-brand-official/README.i18n.yaml`
- `packages/client/ui-brand-official/README.md`
- `packages/client/ui-brand-official/README.zh.md`
- `packages/client/ui-brand-official/package.json`
- `packages/client/ui-brand-official/src/client/Brand.tsx`
- `packages/client/ui-brand-official/src/client/index.ts`
- `packages/client/ui-brand-official/tests/browser-plugin.client.spec.tsx`
- `packages/client/ui-directory-picker-browse/README.i18n.yaml`
- `packages/client/ui-directory-picker-browse/README.md`
- `packages/client/ui-directory-picker-browse/README.zh.md`
- `packages/client/ui-directory-picker-browse/src/client/DirectoryBrowser.tsx`
- `packages/client/ui-directory-picker-browse/src/client/index.ts`
- `packages/client/ui-directory-picker-browse/tests/directory-browser.client.spec.tsx`
- `packages/client/ui-sidebar/README.i18n.yaml`
- `packages/client/ui-sidebar/README.md`
- `packages/client/ui-sidebar/README.zh.md`
- `packages/client/ui-sidebar/src/client/SidebarRoot.module.css`
- `packages/client/ui-sidebar/src/client/SidebarRoot.tsx`
- `packages/client/ui-sidebar/src/client/contract/slots.ts`
- `packages/extensions/cordis-client-runner/src/client/slot-catalog.ts`
- `packages/preset/agent-preset/skills/cordis-composition-reference/references/packages.md`
- `pnpm-lock.yaml`
- `scripts/verify-package-readme-model-experience.ts`
- `scripts/verify-repository-references.spec.ts`
- `scripts/verify-repository-references.ts`
- `tsconfig.base.json`
- `tsconfig.client.json`
- `tsconfig.host.json`

### 删除（0）

无

### 重命名（0）

无

### 未跟踪（30）

- `packages/client/ui-attention/README.i18n.yaml`
- `packages/client/ui-attention/README.md`
- `packages/client/ui-attention/README.zh.md`
- `packages/client/ui-attention/locale/de.json`
- `packages/client/ui-attention/locale/en.json`
- `packages/client/ui-attention/locale/es.json`
- `packages/client/ui-attention/locale/fr.json`
- `packages/client/ui-attention/locale/ja.json`
- `packages/client/ui-attention/locale/pt.json`
- `packages/client/ui-attention/locale/ru.json`
- `packages/client/ui-attention/locale/zh.json`
- `packages/client/ui-attention/package.json`
- `packages/client/ui-attention/src/attention-settings.ts`
- `packages/client/ui-attention/src/client/AttentionSettingsRow.module.css`
- `packages/client/ui-attention/src/client/AttentionSettingsRow.tsx`
- `packages/client/ui-attention/src/client/AttentionToast.tsx`
- `packages/client/ui-attention/src/client/attention-detection.ts`
- `packages/client/ui-attention/src/client/attention-store.ts`
- `packages/client/ui-attention/src/client/favicon-badge.ts`
- `packages/client/ui-attention/src/client/index.ts`
- `packages/client/ui-attention/src/client/locales.ts`
- `packages/client/ui-attention/src/client/sound.ts`
- `packages/client/ui-attention/src/css-modules.d.ts`
- `packages/client/ui-attention/src/index.ts`
- `packages/client/ui-attention/tests/attention-badge.client.spec.ts`
- `packages/client/ui-attention/tests/attention-detection.client.spec.ts`
- `packages/client/ui-attention/tests/attention-sound.client.spec.ts`
- `packages/client/ui-attention/tests/attention-store.client.spec.ts`
- `packages/client/ui-attention/tsconfig.json`
- `packages/client/ui-attention/tsdown.config.ts`

## 双改风险（上游与本地都改过）

> 定义：上游 `merge-base..upstream` 改动的文件 ∩ 本地 `merge-base..HEAD` 改动的文件；未提交改动与上游的重叠单独列出。

无：上游与本地相对基线没有同时改动的文件。

## 同步提示

- 同步前先提交本地改动，然后运行：`node .fork/fork.mjs sync`。
- 同步完成后重新运行 `node .fork/fork.mjs record` 更新本清单。
- 冲突处理原则：以官方实现为基线，逐项保留本地改造，不要整文件丢弃任何一侧。
