/**
 * The card's tag and version come from the build, which reads them out of
 * package.json. Renaming the card therefore means changing "name" there.
 *
 * The CSS custom properties and the child element tags use their own short
 * prefix (--yacw-, <yacw-clock>) rather than the full name: it keeps every
 * stylesheet readable and `type: custom:...` is long enough already.
 */
declare const __CARD_VERSION__: string;
declare const __CARD_NAME__: string;

export const CARD_TAG = __CARD_NAME__;
export const EDITOR_TAG = `${CARD_TAG}-editor`;
export const CARD_VERSION = __CARD_VERSION__;
export const REPO_URL =
  "https://github.com/julezdean/yet-another-clock-weather-card";

/** Minimum Home Assistant version. Below 2024.4 the weather entity still carried
 *  a legacy `forecast` attribute and two code paths would be needed. */
export const MIN_HA_VERSION = "2024.4.0";

/**
 * Container-query breakpoints, in px of card width.
 *
 * These are not arbitrary. A Home Assistant section is capped at 500px
 * (--ha-view-sections-column-max-width), so a card inside a single section can
 * never reach the wide layout; it needs `column_span: 2` (1032px), a panel view
 * or a wide masonry column.
 */
export const BREAKPOINT_WIDE = 700;
export const BREAKPOINT_MEDIUM = 500;

/**
 * The card has a height band rather than a fixed aspect ratio. A ratio does not
 * survive scaling: at 1400px a 3:1 card would be 466px tall, which is absurd for
 * a clock. A band keeps it ~380px wide-mode regardless of how wide it gets.
 */
export const CARD_MIN_HEIGHT = 320;
export const CARD_TARGET_HEIGHT = 380;
