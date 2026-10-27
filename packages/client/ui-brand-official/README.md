---
description: "HueyingAi (绘影) brand occupants for the sidebar of every client build profile; for users and maintainers choosing or replacing brand presentation."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-brand-official

English | [中文](README.zh.md)

## Summary

This package occupies the sidebar brand slots with the HueyingAi (绘影) company artwork in every client build profile. The expanded brand row shows the wordmark, the collapsed rail shows the square sign, and each surface swaps a light and a dark image with the active theme. The conversation hero keeps the shell's animated fish, which this package leaves on its fallback. It has no runtime state and does not affect model requests.

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

Mount this plugin in the browser roster of the deployment; registration is not gated by the build profile. The shell fallbacks — the fish mark and the local-build label — apply only while this row is absent.

### Choosing the artwork

`sidebar.brand.mark` receives the placement alongside the requested size: `row` for the expanded brand row and `rail` for the collapsed expand button. The row carries the wordmark and the rail carries the square sign cut from the same logo. Both surfaces render a light and a dark image, and `body[data-ds-dark-theme]` selects one, so the artwork follows the theme without JavaScript. The name seat stays empty because the wordmark already carries the company name.

### Replacing the brand

A deployment with another identity replaces this package with one that occupies the same slots — and the hero slot, which this package leaves on its fallback. Occupying a slot is the only composition route; there is no brand configuration surface here.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The two occupants install as one declaration-aware registration set: nested `ctx.slots.inject()` calls wait on the sidebar declaration, so the set works whether this row activates before or after the declarer, withdraws both occupants when the declaration collapses, and leaves no partial brand mix during HMR. Artwork lives in [`src/client/assets/`](src/client/assets/): the build emits each imported file under `lib/assets/` and the browser resolves it through the package asset route. The browser half is [`src/client/index.ts`](src/client/index.ts); the node half is an empty Loader seat. The browser title is a build-environment concern (`DSH_CLIENT_TITLE`), outside the slot system.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the brand surface is not enough. They move from the slots this package occupies to the shell that renders them.

- [ui-sidebar](../ui-sidebar/README.md) — declares `sidebar.brand.mark` and `sidebar.brand.name` and renders their fallbacks.
- [ui-conversation](../ui-conversation/README.md) — declares `conversation.hero.brand.mark` in the hero.
- [Web client architecture](../../../docs/subsystems/web-client.md) — how browser plugin rows load and register slots.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package contributes browser presentation only; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define how brand presentation is supplied. They are current package constraints, not a brand-design comparison or a task backlog.

- **One occupant set** — alternative presentation belongs in another Cordis package occupying the same slots.
- **The browser title is independent** — `DSH_CLIENT_TITLE` selects title text at build time rather than through a UI slot.
- **The wordmark is raster artwork** — the logo ships as pre-rendered WebP images rather than a theme-colored SVG, so a new size needs a new image asset.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
