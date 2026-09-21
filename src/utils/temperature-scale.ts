/**
 * Diverging temperature colour scale: cool blue -> neutral -> warm red.
 *
 * Two decisions worth stating, because both have a wrong answer that looks
 * better at first glance:
 *
 * 1. NOT a rainbow. Blue-green-yellow-red is the reflex for temperature and it
 *    is the classic mis-encoding: the hue order carries no perceptual ordering,
 *    so readers cannot tell which of two colours is warmer without a legend.
 *    This is a two-hue diverging ramp with a neutral midpoint -- warm and cool
 *    read as opposites, and lightness carries distance from the middle.
 *
 * 2. The domain is ABSOLUTE, not the displayed data range. A scale normalised
 *    to "today's coldest and warmest" would paint 15 degrees deep blue in July
 *    and deep red in January. The colour has to mean a temperature, not a rank,
 *    so the domain is configured once and does not move with the forecast.
 *
 * Lightness rises monotonically from both ends towards the midpoint (verified
 * in OKLab), which is what makes the two arms readable as a single scale.
 */

export interface RampStop {
  /** -1 = coldest, 0 = midpoint, +1 = warmest */
  position: number;
  color: string;
}

/**
 * The inner stops sit at +-0.3, not +-0.5: with them at the halfway mark the
 * neutral zone swallowed everything within a few degrees of the midpoint and a
 * mild week rendered almost white.
 *
 * The light midpoint `#aa9c86` is 2.62:1 on a white card. A diverging ramp needs
 * its lightest step in the middle and on a light surface that step cannot also
 * clear 3:1. It is legal here only under the relief rule: every mark carries its
 * value as visible text and each chart ships a data table, so colour never
 * carries a number on its own.
 *
 * Lightness rises monotonically from both ends to the midpoint and the two ends
 * match to within 0.002 in OKLab -- that symmetry is what lets a reader compare
 * a cool and a warm mark without a legend.
 */
export const RAMP_LIGHT: RampStop[] = [
  { position: -1, color: "#06489c" },
  { position: -0.3, color: "#2880c2" },
  { position: 0, color: "#aa9c86" },
  { position: 0.3, color: "#bb5c0c" },
  { position: 1, color: "#8f1714" },
];

export const RAMP_DARK: RampStop[] = [
  { position: -1, color: "#3f7fd4" },
  { position: -0.3, color: "#63a5e4" },
  { position: 0, color: "#bdae96" },
  { position: 0.3, color: "#d9803a" },
  { position: 1, color: "#c05043" },
];

/** Defaults per unit. A 0-35 domain in Celsius is nonsense in Fahrenheit. */
/**
 * -5..35 rather than 0..35: the midpoint is the colour-neutral temperature, and
 * at 0..35 that lands on 17.5 degrees -- exactly where ordinary weather sits, so
 * a normal week came out colourless. At -5..35 the midpoint is 15 and a mild day
 * already reads warm.
 */
export const DEFAULT_DOMAIN = {
  celsius: { min: -5, max: 35 },
  fahrenheit: { min: 23, max: 95 },
};

export function defaultDomain(unit: string | undefined): {
  min: number;
  max: number;
} {
  return unit && unit.toUpperCase().includes("F")
    ? DEFAULT_DOMAIN.fahrenheit
    : DEFAULT_DOMAIN.celsius;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((c) =>
      Math.round(Math.min(255, Math.max(0, c)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * Colour for one temperature. Used for discrete marks; the charts themselves
 * reference an SVG gradient instead, so the browser interpolates across the
 * whole plot in one pass.
 */
export function temperatureColor(
  value: number,
  min: number,
  max: number,
  ramp: RampStop[],
): string {
  const span = max - min || 1;
  const normalised = Math.min(1, Math.max(-1, ((value - min) / span) * 2 - 1));
  for (let i = 0; i < ramp.length - 1; i++) {
    const a = ramp[i];
    const b = ramp[i + 1];
    if (normalised > b.position) continue;
    const t = (normalised - a.position) / (b.position - a.position || 1);
    const ca = parseHex(a.color);
    const cb = parseHex(b.color);
    return toHex([
      ca[0] + (cb[0] - ca[0]) * t,
      ca[1] + (cb[1] - ca[1]) * t,
      ca[2] + (cb[2] - ca[2]) * t,
    ]);
  }
  return ramp[ramp.length - 1].color;
}

export interface GradientSpec {
  /** y of the domain maximum, in the chart's own coordinates. */
  y1: number;
  /** y of the domain minimum. */
  y2: number;
  stops: { offset: number; color: string }[];
}

/**
 * A vertical gradient in user space spanning the configured domain, not the
 * visible data range. Marks reference it, so a bar or a curve is coloured by
 * the temperature it actually sits at -- with no per-mark colour maths and no
 * banding.
 */
export function gradientSpec(
  min: number,
  max: number,
  ramp: RampStop[],
  yOf: (temperature: number) => number,
): GradientSpec {
  return {
    y1: yOf(max),
    y2: yOf(min),
    // offset 0 is at y1 (the domain maximum), so the ramp runs warm -> cool.
    stops: ramp
      .slice()
      .reverse()
      .map((stop) => ({ offset: (1 - stop.position) / 2, color: stop.color })),
  };
}
