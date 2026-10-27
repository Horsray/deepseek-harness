---
description: "浏览器提醒：待处理交互与后台会话完成时，在浮层显示 toast、播放合成提示音，并在页面图标上显示计数。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-attention

[English](README.md) | 中文

## 摘要

Web GUI 有两类需要用户回来的状态：会话在等待审批、计划审阅或回答，以及后台会话完成了一轮用户尚未查看的工作。本包把两者变成同一种提醒——shell 浮层里的全局 toast、一段合成的短提示音，以及页面图标上的计数。每个部分都能在「设置 → 通用」里开关。

提醒不做焦点过滤。桌面窗口在用户切到别的应用后仍报告自己可见，按可见性抑制恰好会丢掉最该提醒的那些；新出现的请求与结束的一轮各播报一次，不论用户在看哪里。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与待办](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

Web bundle 包含本插件，Desktop 复用同一个 bundle。四个偏好项位于用户设置的 `ui-attention` 命名空间，显示在「设置 → 通用」：

| 字段 | 默认值 | 作用 |
|---|---|---|
| `interactionToast` | `true` | 会话开始等待审批、计划审阅或回答时显示 toast |
| `completionToast` | `true` | 后台会话完成一轮时显示 toast |
| `soundEnabled` | `true` | 提醒 toast 同时播放提示音 |
| `soundPreset` | `glass` | 提示音音色：`glass`、`ascending` 或 `marimba` |
| `badgeEnabled` | `true` | 在页面图标上显示未确认提醒数 |

四项都对当前浏览器立即生效，都不需要重启 Host。通过 profile patch 关闭整个插件可同时移除提醒与设置行：

```yaml
- id: ui-attention
  disabled: true
```

浏览器要求用户手势后才能播放音频，因此页面首次收到指针按下、按键或触摸之前，提示音保持静音。这段时间内的提醒照常显示，只是没有声音；解锁后也不会补播先前到达的提醒。

选择音色会立即试听；「测试提醒」会按当前音色显示一条横幅，因此不必等待真实请求就能确认整条提醒链路。

页面图标计数会在随包发布的 favicon 上绘制带数字的红色徽标，同时请求 Badging API；桌面应用还会通过 shell 桥设置 Dock 徽标。待回答的交互被回答、已完成的会话被重新打开后，计数归零。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节 — 点击展开</summary>

浏览器半边订阅 `ctx.uiSession.sessionStatus`，这是合并了运行状态、各域最高优先级的待处理交互、以及完成提醒集合的统一状态源。首次快照被静默采纳为基线，因此页面加载不会重放本来就已经成立的提醒。

每个请求键只播报一次交互提醒；请求结束后新的请求才会再次触发。完成提醒按会话只播报一次，直到 `completionUnread` 清除（主视图打开该会话时清除）。计数在每次快照变化以及标签页可见性变化时从同一份快照推导，因此它始终镜像这两类事实，而不是累加播报次数。

toast 是 `shell.overlay` 里的一个条目，渲染共享的 toast 原语；提醒队列放在插件自有的 store 里，所以连续到达的提醒逐条显示，不会覆盖正在阅读的那一条。设置行注册进 `settings.general.item`，写入经由 `ctx.configForms.get('ui-attention')`。提示音用 WebAudio 合成两个短音，因此本包不带音频资源。图标徽标把原图标与数字画到 canvas 上，把每个 `<link rel="icon">` 的 `href` 换成 PNG data URL，计数归零时恢复原始 href。

音频上下文、手势监听、已绘制的图标和队列都随插件 fiber 释放。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [会话 UI](../ui-session/README.zh.md) —— 合并运行中、待处理交互与完成事实的状态源。
- [布局](../ui-layout/README.zh.md) —— toast 所在的框架级 `shell.overlay` 层。
- [UI 设置](../ui-settings/README.zh.md) —— 配置表单服务与设置 slot。
- [UI 原语](../ui-primitives/README.zh.md) —— 本包复用的 toast 与开关控件。

-----

<a id="model-experience"></a>
## 模型体验

无。本包只渲染浏览器反馈，不新增模型可见输入、工具或 Session 事件。

#### KV Cache 影响

无。插件不发送模型请求，也不改变缓存的提示词前缀。

## 已知限制与待办

<a id="known-limitations-and-deferred-work"></a>

- Windows 的任务栏覆盖徽标未绘制：`app.setBadgeCount` 在 Windows 是空操作，只有页内计数可用。
- Badging API 只对已安装的应用生效；普通浏览器标签页里它是空操作，可见计数来自 favicon 徽标。
- 提示音只有一种固定音色与音量，没有按事件选择音效或调节音量的入口。
- 用户主动停止的一轮也会按「已完成」播报：客户端状态源只给出 running→idle 边沿，无法区分取消与正常完成。
- 绘制徽标需要 canvas 实现与同源图标；没有 canvas 的内嵌 webview 会保留原图标，Badging API 仍能收到计数。
