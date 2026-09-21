import { css } from "lit";

/**
 * Card tokens.
 *
 * Surfaces and text follow the Home Assistant theme, so the card sits in any
 * dashboard. The chart and icon colours do NOT: a theme is free to set
 * --primary-color to anything, and a temperature ramp built on an unknown hue
 * cannot be held to a contrast or colour-vision gate. They are a fixed pair
 * (warm = temperature, cool = precipitation) validated against both surfaces,
 * and every one of them is overridable per card.
 *
 * Dark mode is keyed off the [dark] host attribute, which the card sets from
 * hass.themes.darkMode -- not off prefers-color-scheme. Home Assistant's dark
 * mode is a user setting independent of the operating system.
 */
export const tokens = css`
  :host {
    /* -- surfaces & text: from the theme -------------------------------- */
    --yacw-surface: var(
      --ha-card-background,
      var(--card-background-color, #fcfcfb)
    );
    --yacw-text: var(--primary-text-color, #0b0b0b);
    --yacw-text-muted: var(--secondary-text-color, #52514e);
    --yacw-divider: var(--divider-color, rgba(0, 0, 0, 0.12));
    --yacw-accent: var(--yacw-user-accent, var(--primary-color, #03a9f4));

    /* -- chart series: fixed, validated --------------------------------- */
    --yacw-temp: #eb6834;
    --yacw-temp-soft: rgba(235, 104, 52, 0.16);
    --yacw-precip: #2a78d6;
    --yacw-precip-soft: rgba(42, 120, 214, 0.22);
    --yacw-grid: rgba(0, 0, 0, 0.08);

    /* -- icons ----------------------------------------------------------- */
    --yacw-icon-sun: #bd7d00;
    --yacw-icon-moon: #7d8797;
    --yacw-icon-cloud: #7d8490;
    --yacw-icon-cloud-back: #c2c8d0;
    --yacw-icon-rain: var(--yacw-precip);
    --yacw-icon-snow: #5688b8;
    --yacw-icon-bolt: var(--yacw-icon-sun);
    --yacw-icon-fog: var(--yacw-icon-cloud);

    /* -- metrics --------------------------------------------------------- */
    --yacw-radius: var(--ha-card-border-radius, 12px);
    --yacw-padding: 16px;
    --yacw-gap: 16px;
    --yacw-icon-size: 40px;
  }

  :host([dark]) {
    --yacw-temp: #d95926;
    --yacw-temp-soft: rgba(217, 89, 38, 0.2);
    --yacw-precip: #3987e5;
    --yacw-precip-soft: rgba(57, 135, 229, 0.26);
    --yacw-grid: rgba(255, 255, 255, 0.1);

    --yacw-icon-sun: #e0a51f;
    --yacw-icon-moon: #c3cbd9;
    --yacw-icon-cloud: #79818e;
    --yacw-icon-cloud-back: #4a505a;
    --yacw-icon-snow: #8fb6dc;
  }
`;

/** Shared type scale and helpers used by more than one child component. */
export const shared = css`
  * {
    box-sizing: border-box;
  }
  .muted {
    color: var(--yacw-text-muted);
  }
  .section-title {
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--yacw-text-muted);
    margin: 0 0 2px;
  }
  /* Visible to screen readers, not to the eye. Every chart ships a table so
     the data is reachable without reading the graphic. */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
`;
