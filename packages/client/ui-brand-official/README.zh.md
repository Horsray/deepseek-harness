---
description: "面向侧栏的 HueyingAi（绘影）品牌填充，在所有客户端构建 profile 中生效；供选择或替换品牌呈现的用户与维护者阅读。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-brand-official

[English](README.md) | 中文

## 概述

本包在所有客户端构建 profile 中用 HueyingAi（绘影）公司图形占据侧栏品牌 slot。展开的品牌行显示字标，收起的窄条显示从同一 logo 裁出的方形标志，两种画面都随当前主题在浅色与深色图片之间切换。会话首屏仍使用外壳的动画鱼，本包让该 slot 保持回退。本包不保留运行时状态，也不影响模型请求。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

将该插件挂载到部署的浏览器插件名单即可；注册不受构建 profile 门控。外壳回退——鱼形标志与本地构建标签——只在本行缺席时生效。

### 选择画面

`sidebar.brand.mark` 除了请求的尺寸，还会收到画面位置：`row` 表示展开的品牌行，`rail` 表示收起的展开按钮。展开行显示字标，窄条显示从同一 logo 裁出的方形标志。两种画面都渲染一张浅色图与一张深色图，由 `body[data-ds-dark-theme]` 选择其一，因此图形无需 JavaScript 即可跟随主题。名称座位保持为空，因为字标本身已包含公司名称。

### 替换品牌

自有身份的部署用另一个包替换本包，由那个包占据相同的 slot——以及本包留给回退的首屏 slot。占据 slot 是唯一的组合路径；这里不存在任何品牌配置面。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

两个填充作为一组声明感知的注册安装：嵌套的 `ctx.slots.inject()` 调用等待侧栏声明，因此无论本行在声明者之前还是之后激活，这组注册都能工作；声明消失时两个填充一并撤回，HMR 期间也不会留下残缺的品牌混合。图形资源位于 [`src/client/assets/`](src/client/assets/)：构建会把每个被引用的文件输出到 `lib/assets/`，浏览器通过包资源路由解析它。浏览器半部是 [`src/client/index.ts`](src/client/index.ts)；node 半部是一个空 Loader 座位。浏览器标题是构建环境的事（`DSH_CLIENT_TITLE`），不在 slot 系统之内。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当品牌面不够用时阅读以下页面。它们从本包占据的 slot 进入渲染这些 slot 的外壳。

- [ui-sidebar](../ui-sidebar/README.zh.md)——声明 `sidebar.brand.mark` 与 `sidebar.brand.name` 并渲染其回退。
- [ui-conversation](../ui-conversation/README.zh.md)——在首屏声明 `conversation.hero.brand.mark`。
- [Web 客户端架构](../../../docs/subsystems/web-client.zh.md)——浏览器插件行如何加载并注册 slot。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包只贡献浏览器呈现；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制界定了品牌呈现的供给方式。它们是当前包约束，不是品牌设计对比或任务积压。

- **只有一组填充**——替代呈现属于占据相同 slot 的另一个 Cordis 包。
- **浏览器标题独立**——`DSH_CLIENT_TITLE` 在构建时选择标题文本，而非通过 UI slot。
- **字标是位图资源**——logo 以预渲染的 WebP 图片发布，而不是随主题着色的 SVG，因此改变尺寸需要新的图片资源。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
