import { svg, type SVGTemplateResult } from "lit";

/**
 * Icon building blocks on a 64x64 canvas.
 *
 * Every condition icon is composed from these rather than drawn separately --
 * fifteen hand-drawn files would be fifteen places to fix a colour or an
 * animation. Shapes within one layer are opaque and share a fill so their
 * overlaps union cleanly instead of showing seams.
 */

export const VIEWBOX = "0 0 64 64";

export const sun = (cx = 32, cy = 32, r = 11): SVGTemplateResult => svg`
  <g class="sun">
    <g class="sun-rays">
      ${[0, 45, 90, 135, 180, 225, 270, 315].map(
        (angle) => svg`
          <rect
            class="ray"
            x="${cx - 1.6}" y="${cy - r - 9}"
            width="3.2" height="5.5" rx="1.6"
            transform="rotate(${angle} ${cx} ${cy})"
          />`,
      )}
    </g>
    <circle class="sun-disc" cx="${cx}" cy="${cy}" r="${r}" />
  </g>`;

export const moon = (cx = 32, cy = 32, r = 12): SVGTemplateResult => svg`
  <g class="moon">
    <path
      class="moon-disc"
      d="M ${cx + r * 0.25} ${cy - r}
         a ${r} ${r} 0 1 0 ${r * 0.72} ${r * 1.4}
         a ${r * 0.82} ${r * 0.82} 0 1 1 ${-r * 0.72} ${-r * 1.4} z"
    />
  </g>`;

/** The pale layer that peeks out behind the main cloud. */
export const cloudBack = (dx = 0, dy = 0): SVGTemplateResult => svg`
  <g class="cloud-back">
    <g transform="translate(${dx} ${dy})">
      <circle cx="23" cy="30" r="8" />
      <circle cx="33" cy="25" r="11" />
      <circle cx="43" cy="30" r="7.5" />
      <rect x="23" y="30" width="20" height="8" rx="4" />
    </g>
  </g>`;

export const cloudFront = (dx = 0, dy = 0): SVGTemplateResult => svg`
  <g class="cloud-front">
    <g transform="translate(${dx} ${dy})">
      <circle cx="21" cy="37" r="9" />
      <circle cx="32" cy="31" r="12.5" />
      <circle cx="44" cy="37" r="8.5" />
      <rect x="21" y="37" width="23" height="9" rx="4.5" />
    </g>
  </g>`;

const DROP_X = [22, 32, 42, 27, 37];

export const rain = (count = 3, heavy = false): SVGTemplateResult => svg`
  <g class="rain ${heavy ? "rain-heavy" : ""}">
    ${DROP_X.slice(0, count).map(
      (x, i) => svg`
        <line
          class="drop" style="--i:${i}"
          x1="${x}" y1="49" x2="${x - 2}" y2="57"
        />`,
    )}
  </g>`;

export const snow = (count = 3): SVGTemplateResult => svg`
  <g class="snow">
    ${DROP_X.slice(0, count).map(
      (x, i) => svg`
        <g class="flake" style="--i:${i}">
          <g transform="translate(${x} 52)">
            <line x1="-3" y1="0" x2="3" y2="0" />
            <line x1="0" y1="-3" x2="0" y2="3" />
            <line x1="-2.1" y1="-2.1" x2="2.1" y2="2.1" />
            <line x1="-2.1" y1="2.1" x2="2.1" y2="-2.1" />
          </g>
        </g>`,
    )}
  </g>`;

export const bolt = (): SVGTemplateResult => svg`
  <path class="bolt" d="M 34 44 L 26 56 L 32 56 L 28 64 L 40 50 L 33 50 L 38 44 Z" />`;

export const fogBars = (): SVGTemplateResult => svg`
  <g class="fog">
    ${[46, 52, 58].map(
      (y, i) => svg`
        <line
          class="fog-bar" style="--i:${i}"
          x1="${14 + i * 3}" y1="${y}" x2="${50 - i * 2}" y2="${y}"
        />`,
    )}
  </g>`;

export const windStrokes = (variant = false): SVGTemplateResult => svg`
  <g class="wind">
    <path class="gust" style="--i:0"
      d="M 12 28 h 22 a 5 5 0 1 0 -5 -5" />
    <path class="gust" style="--i:1"
      d="M 14 38 h 28 a 6 6 0 1 1 -6 6" />
    ${
      variant
        ? svg`<path class="gust" style="--i:2" d="M 16 48 h 16 a 4.5 4.5 0 1 0 -4.5 -4.5" />`
        : ""
    }
  </g>`;

export const hailStones = (): SVGTemplateResult => svg`
  <g class="hail">
    ${DROP_X.slice(0, 3).map(
      (x, i) =>
        svg`<circle class="stone" style="--i:${i}" cx="${x}" cy="52" r="2.6" />`,
    )}
  </g>`;

/** Shown when the condition is missing or not one Home Assistant defines. */
export const unknownMark = (): SVGTemplateResult => svg`
  <g class="unknown">
    <circle cx="32" cy="32" r="18" />
    <line x1="32" y1="23" x2="32" y2="35" />
    <circle class="dot" cx="32" cy="41" r="1.8" />
  </g>`;
