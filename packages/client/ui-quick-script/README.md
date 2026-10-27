---
description: "Composer quick-script launcher: the play menu before the model selector that runs saved shell scripts in a fresh right-sidebar terminal."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-quick-script

English | [中文](README.zh.md)

## Summary

The Web GUI keeps a per-browser catalog of shell scripts and runs one from the composer's tool row. A play button sits immediately before the model selector; its menu lists the saved scripts, adds entries inline, and deletes them. Running a script opens a new right-sidebar terminal in that Session, switches the shell to the script's directory, and types the command there.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The Web bundle includes this plugin; Desktop uses that bundle too. It has no configuration fields.

The play button renders only inside a Session's composer, before the model selector. Its menu lists the saved catalog in saved order. **Add script** opens two fields — a menu label and the script's absolute path — and **Save** appends the entry; blank fields keep the form open with an inline message. Hovering a row reveals its delete control. An empty catalog shows a single empty-state line.

Running a row expands the right sidebar with a new terminal page, waits for that shell to become writable, then types `cd "<script directory>" && bash "<script path>"`. The menu closes on a successful handoff and stays open with a message when the Session has no sidebar surface to open.

The catalog persists per browser under localStorage key `dsh.quick-script.v1`; it is not Session state, not a Host setting, and not shared between browsers or profiles. Disable the following row through a profile patch to hide the control:

```yaml
- id: ui-quick-script
  disabled: true
```

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The browser entry injects `conversation.input.right`, the list seat the composer renders immediately before the `conversation.input.model` seat, so the control needs no change to the composer itself. The component owns the catalog as local state seeded from localStorage and persists every add and delete; the plugin declares no store because no other entry reads it.

The injected face carries the terminal handoff. It compares the Session's committed tab list before and after `sidebarRight.openTabIn(sessionId, 'terminal')`, takes the new page's model through `webTerminals.view()`, and writes the command on the first `connected` and writable snapshot. A 30-second deadline drops a page that never attaches, and the subscription and deadline are released with the plugin fiber. Dictionaries and the slot registration leave with the plugin. The Host entry only makes the browser package available to the Loader.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

These packages own the seats and services this launcher composes.

- [Right Sidebar](../ui-sidebar-right/README.md) — the column, its tab types, and `ctx.sidebarRight`.
- [Sidebar terminal](../ui-sidebar-terminal/README.md) — the terminal page whose shell receives the command.
- [Terminal controller](../../api/terminal-controller/README.md) — the browser terminal model and its input commands.
- [Conversation](../ui-conversation/README.md) — the composer tool row and its input seats.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package only drives browser controls and a user terminal; it adds no model-visible input, tool, or Session event.

#### KV Cache effect

None; the plugin sends no provider requests and changes no cached prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The command line is POSIX-shaped (`cd … && bash …`). A Windows shell without `bash` reports the failure in its own terminal tab rather than falling back to another interpreter.
- Entries can be added and deleted but not edited in place; correcting a path means deleting the row and adding it again.
- The catalog is browser-local, so switching browsers or clearing site data starts from an empty list.
- A terminal that never attaches leaves the new tab open with no command typed; the 30-second deadline drops only the pending write.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The control deliberately opens a fresh terminal per run instead of reusing the focused one: concurrent scripts then keep separate stdin and output, and an interactive script cannot be interleaved with a previous run's process.

</details>
