import { defineOnce } from "../utils/define";
import { LitElement, css, html, svg, nothing, type SVGTemplateResult } from "lit";
import { property } from "lit/decorators.js";
import { asCondition, type WeatherCondition } from "../data/weather";
import {
  VIEWBOX,
  bolt,
  cloudBack,
  cloudFront,
  fogBars,
  hailStones,
  moon,
  rain,
  snow,
  sun,
  unknownMark,
  windStrokes,
} from "../icons/primitives";

/**
 * Only two conditions differ between day and night: the clear sky and the
 * partly clouded one. For rain or fog the moon is not visible anyway, which is
 * why Home Assistant draws those the same at any hour.
 */
function compose(condition: WeatherCondition, night: boolean): SVGTemplateResult {
  const body = night ? moon(24, 25, 10) : sun(24, 25, 9);

  switch (condition) {
    case "sunny":
      return night ? moon() : sun();
    case "clear-night":
      return moon();
    case "partlycloudy":
      return svg`${body}${cloudFront(4, 6)}`;
    case "cloudy":
      return svg`${cloudBack(-4, -3)}${cloudFront(0, 2)}`;
    case "fog":
      return svg`${cloudFront(0, -4)}${fogBars()}`;
    case "rainy":
      return svg`${cloudFront(0, -2)}${rain(3)}`;
    case "pouring":
      return svg`${cloudFront(0, -2)}${rain(5, true)}`;
    case "lightning":
      return svg`${cloudFront(0, -4)}${bolt()}`;
    case "lightning-rainy":
      return svg`${cloudFront(0, -4)}${rain(2)}${bolt()}`;
    case "snowy":
      return svg`${cloudFront(0, -2)}${snow(3)}`;
    case "snowy-rainy":
      return svg`${cloudFront(0, -2)}${snow(2)}${rain(1)}`;
    case "hail":
      return svg`${cloudFront(0, -2)}${hailStones()}`;
    case "windy":
      return windStrokes();
    case "windy-variant":
      return svg`${cloudFront(0, -6)}${windStrokes(true)}`;
    case "exceptional":
    default:
      return unknownMark();
  }
}

export class YacwWeatherIcon extends LitElement {
  @property({ type: String }) condition?: string;
  @property({ type: Boolean }) night = false;
  @property({ type: Boolean }) animated = true;
  /** Screen-reader text. Empty string marks the icon as decorative. */
  @property({ type: String }) label = "";

  protected override render() {
    const condition = asCondition(this.condition);

    // Home Assistant themes may replace weather icons wholesale. Its own card
    // honours this, so a card that ignored it would look out of place on any
    // dashboard using an icon theme.
    const themed = getComputedStyle(this).getPropertyValue(
      `--weather-icon-${condition}`,
    );
    if (themed && themed.trim()) {
      return html`<div
        class="themed"
        style="background-image:${themed.trim()}"
        role=${this.label ? "img" : nothing}
        aria-label=${this.label || nothing}
        aria-hidden=${this.label ? nothing : "true"}
      ></div>`;
    }

    return html`<svg
      viewBox=${VIEWBOX}
      class=${this.animated ? "animated" : ""}
      role=${this.label ? "img" : nothing}
      aria-label=${this.label || nothing}
      aria-hidden=${this.label ? nothing : "true"}
    >
      ${compose(condition, this.night)}
    </svg>`;
  }

  static override styles = css`
    :host {
      display: block;
      width: var(--yacw-icon-size, 40px);
      height: var(--yacw-icon-size, 40px);
      flex: 0 0 auto;
    }
    svg,
    .themed {
      width: 100%;
      height: 100%;
      display: block;
    }
    .themed {
      background-size: contain;
      background-position: center;
      background-repeat: no-repeat;
    }

    /* ---- colour ---------------------------------------------------------- */
    .sun-disc,
    .ray {
      fill: var(--yacw-icon-sun);
    }
    .moon-disc {
      fill: var(--yacw-icon-moon);
    }
    .cloud-back > g > * {
      fill: var(--yacw-icon-cloud-back);
    }
    .cloud-front > g > * {
      fill: var(--yacw-icon-cloud);
    }
    .drop {
      stroke: var(--yacw-icon-rain);
      stroke-width: 3;
      stroke-linecap: round;
    }
    .flake line {
      stroke: var(--yacw-icon-snow);
      stroke-width: 1.4;
      stroke-linecap: round;
    }
    .stone {
      fill: var(--yacw-icon-snow);
    }
    .bolt {
      fill: var(--yacw-icon-bolt);
    }
    .fog-bar {
      stroke: var(--yacw-icon-fog);
      stroke-width: 3.4;
      stroke-linecap: round;
    }
    .gust {
      fill: none;
      stroke: var(--yacw-icon-fog);
      stroke-width: 3.4;
      stroke-linecap: round;
    }
    .unknown circle,
    .unknown line {
      fill: none;
      stroke: var(--yacw-icon-fog);
      stroke-width: 3;
      stroke-linecap: round;
    }
    .unknown .dot {
      fill: var(--yacw-icon-fog);
    }

    /* ---- motion ---------------------------------------------------------- */
    /* Animated groups never carry a transform attribute: in SVG a CSS
       transform overrides the attribute, which would reset the positioning. */
    .animated .sun-rays,
    .animated .cloud-back,
    .animated .cloud-front,
    .animated .drop,
    .animated .flake,
    .animated .stone,
    .animated .bolt,
    .animated .fog-bar,
    .animated .gust {
      transform-box: fill-box;
      transform-origin: center;
    }
    .animated .sun-rays {
      animation: yacw-spin 42s linear infinite;
    }
    .animated .cloud-back {
      animation: yacw-drift 11s ease-in-out infinite alternate;
    }
    .animated .cloud-front {
      animation: yacw-drift 8s ease-in-out infinite alternate-reverse;
    }
    .animated .drop,
    .animated .stone {
      animation: yacw-fall 1.5s linear infinite;
      animation-delay: calc(var(--i, 0) * 0.28s);
    }
    .animated .rain-heavy .drop {
      animation-duration: 0.95s;
    }
    .animated .flake {
      animation: yacw-snowfall 3.4s linear infinite;
      animation-delay: calc(var(--i, 0) * 0.55s);
    }
    .animated .bolt {
      animation: yacw-flash 4s steps(1, end) infinite;
    }
    .animated .fog-bar,
    .animated .gust {
      animation: yacw-gust 6s ease-in-out infinite alternate;
      animation-delay: calc(var(--i, 0) * 0.5s);
    }

    @keyframes yacw-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @keyframes yacw-drift {
      from {
        transform: translateX(-1.4px);
      }
      to {
        transform: translateX(1.4px);
      }
    }
    @keyframes yacw-fall {
      0% {
        opacity: 0;
        transform: translateY(-4px);
      }
      25% {
        opacity: 1;
      }
      75% {
        opacity: 1;
      }
      100% {
        opacity: 0;
        transform: translateY(6px);
      }
    }
    @keyframes yacw-snowfall {
      0% {
        opacity: 0;
        transform: translateY(-4px) rotate(0deg);
      }
      25% {
        opacity: 1;
      }
      75% {
        opacity: 1;
      }
      100% {
        opacity: 0;
        transform: translateY(7px) rotate(140deg);
      }
    }
    @keyframes yacw-flash {
      0%,
      90%,
      100% {
        opacity: 0.3;
      }
      92%,
      96% {
        opacity: 1;
      }
      94% {
        opacity: 0.3;
      }
    }
    @keyframes yacw-gust {
      from {
        transform: translateX(-2px);
        opacity: 0.7;
      }
      to {
        transform: translateX(2px);
        opacity: 1;
      }
    }

    /* Not slowed down, not softened -- off. An animation a reduced-motion user
       cannot switch off is the accessibility failure, not its speed. */
    @media (prefers-reduced-motion: reduce) {
      .animated * {
        animation: none !important;
      }
    }
  `;
}

defineOnce("yacw-weather-icon", YacwWeatherIcon);

declare global {
  interface HTMLElementTagNameMap {
    "yacw-weather-icon": YacwWeatherIcon;
  }
}
