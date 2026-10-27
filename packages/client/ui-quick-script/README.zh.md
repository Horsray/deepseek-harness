---
description: "输入区快捷脚本启动器：在模型选择器之前的播放菜单，把已保存的 shell 脚本放到新建的右侧栏终端中运行。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-quick-script

[English](README.md) | 中文

## 概述

Web 图形界面为每个浏览器保存一份 shell 脚本目录，并可从输入框工具栏运行其中一个。播放按钮位于模型选择器正前方；其菜单列出已保存的脚本，支持内联新增与删除。运行脚本会在当前会话新建一个右侧栏终端，把 shell 切换到脚本所在目录，并在其中输入命令。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发者说明](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

Web 捆绑包已包含本插件，桌面端同样使用该捆绑包。它没有配置字段。

播放按钮仅在会话的输入框中、模型选择器之前渲染。菜单按保存顺序列出脚本目录。**添加脚本**会打开两个字段——菜单名称与脚本绝对路径——点击**保存**追加条目；字段为空时表单保持打开并显示内联提示。悬停某一行会显示其删除控件。目录为空时只显示一行空状态。

点击某一行会展开右侧栏并新建一个终端页面，等该 shell 可写后输入 `cd "<脚本目录>" && bash "<脚本路径>"`。交接成功时菜单关闭；当前会话没有可打开的侧栏面板时，菜单保持打开并给出提示。

目录按浏览器保存在 localStorage 的 `dsh.quick-script.v1` 键下；它既不是会话状态，也不是 Host 设置，不会在浏览器或配置文件之间共享。在 profile 补丁中停用以下条目即可隐藏该控件：

```yaml
- id: ui-quick-script
  disabled: true
```

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节——点击展开</summary>

浏览器半边注入 `conversation.input.right`：输入框把该列表座位渲染在 `conversation.input.model` 座位之前，因此控件本身不需要改动输入框。组件以 localStorage 为初值把目录作为局部状态持有，并在每次新增、删除时持久化；插件不声明 store，因为其他条目不会读取它。

注入面承载终端交接：它比较 `sidebarRight.openTabIn(sessionId, 'terminal')` 前后的会话标签列表，取新页面的模型 `webTerminals.view()`，在第一个 `connected` 且可写的快照上写入命令。30 秒期限会放弃始终未附着的页面，订阅与期限随插件 fiber 一起释放。字典与插槽注册随插件卸载。Host 半边只负责让 Loader 能加载浏览器包。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

本启动器组合的座位与服务由以下包拥有。

- [右侧栏](../ui-sidebar-right/README.zh.md) —— 该列、它的标签类型与 `ctx.sidebarRight`。
- [侧栏终端](../ui-sidebar-terminal/README.zh.md) —— 接收命令的终端页面。
- [终端控制器](../../api/terminal-controller/README.zh.md) —— 浏览器终端模型及其输入命令。
- [会话](../ui-conversation/README.zh.md) —— 输入框工具行及其输入座位。

-----

<a id="model-experience"></a>
## 模型体验

无：本包只驱动浏览器控件和用户终端，不新增模型可见输入、工具或会话事件。

#### KV 缓存影响

无；本插件不发送供应商请求，也不改动已缓存的提示前缀。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- 命令行按 POSIX 形式生成（`cd … && bash …`）。缺少 `bash` 的 Windows shell 会在自己的终端标签里报告失败，而不会回退到其他解释器。
- 条目支持新增与删除，但不支持就地编辑；修正路径需要删除后重新添加。
- 目录保存在浏览器本地，切换浏览器或清除站点数据后会从空列表开始。
- 始终未附着的终端会留下一个没有输入命令的新标签；30 秒期限只放弃挂起的写入。

<a id="dev-note"></a>
### 开发者说明

<details>
<summary>维护者工作背景——点击展开</summary>

该控件每次运行都新建终端而不复用当前终端：并发脚本因此各自拥有独立的 stdin 与输出，交互式脚本也不会与上一次运行的进程交叠。

</details>
