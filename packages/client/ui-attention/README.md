---
description: "Browser attention reminders: an overlay toast, a synthesized chime, and a page-icon count for pending interactions and completed background Sessions."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-attention

English | [中文](README.zh.md)

## Summary

The Web GUI has two states that need the user back: a Session waiting on an approval, plan review, or answer, and a background Session that finished a Turn the user has not looked at. This package turns both into one reminder — an app-wide toast, a short synthesized chime, and a count on the page icon — switchable from Settings → General.

The reminder never fires for the Session in front of the user, whose asking card is already on screen. The page-icon count still covers it once the user switches away.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

The Web bundle includes this plugin; Desktop uses that bundle too. Four preferences live in the `ui-attention` user-settings namespace and appear under Settings → General:

| Field | Default | Effect |
|---|---|---|
| `interactionToast` | `true` | Toast when a Session starts waiting for approval, plan review, or an answer |
| `completionToast` | `true` | Toast when a background Session finishes a Turn |
| `soundEnabled` | `true` | Play the chime alongside a reminder toast |
| `badgeEnabled` | `true` | Count unacknowledged reminders on the page icon |

All four apply to the open browser immediately; none needs a Host restart. Disable the whole plugin through a profile patch to remove the reminders and the Settings rows:

```yaml
- id: ui-attention
  disabled: true
```

The chime cannot start before the page has seen a user gesture, which browsers require for audio. The first pointer press, key press, or touch unlocks it; until then reminders are still shown, they simply stay silent. A reminder that arrived before the unlock is not replayed afterwards.

The page-icon count paints a red badge with the number over the shipped favicon and asks the Badging API in parallel. It reaches zero when the asking interactions are answered and the finished Sessions are opened again.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The browser half subscribes to `ctx.uiSession.sessionStatus`, the unified status source that combines running state, the highest-precedence pending interaction of each domain, and the completion reminder set. The first snapshot is adopted silently as a baseline, so a page load never replays reminders that were already true.

An interaction is announced once per request key and re-announced only after the request settles and a new one arrives. A completion is announced once per Session until `completionUnread` clears, which happens when the main view opens that Session. The count is derived from the same snapshot on every change, plus tab-visibility changes, so it always mirrors the two facts rather than accumulating announcements.

The banner is one `shell.overlay` entry rendering the shared toast primitive; the notice queue lives in a plugin-owned store, so a burst of reminders shows one sentence at a time instead of overwriting the one being read. The Settings rows register into `settings.general.item`, and their writes go through `ctx.configForms.get('ui-attention')`. The chime synthesizes two short tones with WebAudio, so the package ships no audio asset. The page-icon badge paints the shipped icon plus the number onto a canvas and swaps each `<link rel="icon">` `href` for a PNG data URL, restoring the original hrefs at zero.

Reminder resources — the audio context, the gesture listeners, the painted icons, and the queue — are released with the plugin fiber.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Session UI](../ui-session/README.md) — the status source that combines running, pending-interaction, and completion facts.
- [Layout](../ui-layout/README.md) — the frame-wide `shell.overlay` layer the banner occupies.
- [UI settings](../ui-settings/README.md) — the configuration form service and the Settings slots.
- [UI primitives](../ui-primitives/README.md) — the toast and switch controls this package reuses.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package only renders browser feedback and changes no model-visible input, tool, or Session event.

#### KV Cache effect

None; the plugin sends no provider requests and changes no cached prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The Desktop app icon (Dock badge or taskbar overlay) is not updated: the preload bridge exposes no badge channel, so only the in-page favicon and the Badging API carry the count.
- The Badging API takes effect only for an installed app; in an ordinary browser tab it is a no-op and the favicon badge is the visible count.
- The chime has one fixed tone and volume; there is no per-event sound choice or volume control.
- A reminder suppressed because its Session was in the foreground is not re-raised when the user switches away afterwards; the page-icon count is the remaining cue.
- Painting the badge requires a canvas implementation and a same-origin icon; an embedded webview without canvas keeps the shipped icon while the Badging API still receives the count.
