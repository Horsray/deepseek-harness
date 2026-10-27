/** Viewport placement for the composer's portalled quick-script card. */

/** Space kept between the card and the viewport edges. */
const VIEWPORT_MARGIN = 12

/** Gap between the trigger and the card above it. */
const ANCHOR_GAP = 8

/** The card's measured size and the viewport it must stay inside. */
export interface CardPlacementInput {
  /** Trigger rect in viewport coordinates. */
  readonly anchor: { readonly right: number; readonly top: number }
  /** Measured card size; zero before the card has laid out. */
  readonly size: { readonly width: number; readonly height: number }
  /** Viewport size. */
  readonly viewport: { readonly width: number; readonly height: number }
}

/**
 * Place the card above its trigger, right-aligned, then clamp it inside the
 * viewport. A card that has not laid out yet keeps the unclamped offset so the
 * first paint lands near the trigger instead of the viewport corner.
 * @param input - anchor rect, measured card size, and viewport size.
 * @returns the fixed-position `left`/`top` for the card.
 */
export function cardPosition(input: CardPlacementInput): { readonly left: number; readonly top: number } {
  const { anchor, size, viewport } = input
  let left = anchor.right - size.width
  let top = anchor.top - ANCHOR_GAP - size.height
  if (size.width > 0) left = Math.min(Math.max(left, VIEWPORT_MARGIN), viewport.width - size.width - VIEWPORT_MARGIN)
  if (size.height > 0) top = Math.min(Math.max(top, VIEWPORT_MARGIN), viewport.height - size.height - VIEWPORT_MARGIN)
  return { left, top }
}
