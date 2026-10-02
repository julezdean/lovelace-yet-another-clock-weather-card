import { defineOnce } from "../utils/define";
import { css, html, nothing, svg } from "lit";
import { property } from "lit/decorators.js";
import { ForecastBlock } from "./forecast-base";
import "./weather-icon";
import type { Forecast } from "../types";
import { extentOf, paddedExtent, round, scaleY } from "../utils/chart";
import { formatWeekdayShort, type FormatContext } from "../utils/datetime";
import { shared } from "../styles/tokens";
import { shortUnit } from "../utils/units";
import { gradientSpec, type RampStop } from "../utils/temperature-scale";

/**
 * Wide enough for the bar plus its two readings side by side, so the beside
 * layout never has to fall back to stacking. Below this the block scrolls.
 */
const MIN_COLUMN = 58;

const SIZES = {
  normal: { bar: 24, text: 11, minPlot: 56 },
  compact: { bar: 18, text: 10, minPlot: 40 },
} as const;

/** Breathing room so a bar end is never flush with the plot edge. */
const PLOT_INSET = 5;
/** Below this bar length the two readings would collide and get nudged apart. */
const LABEL_CLEARANCE = 24;
/** The amount bar is a slim companion to the range bar, not a second range. */
const PRECIP_WIDTH = 5;
const PRECIP_GAP = 3;
/**
 * Daily amount that fills the plot height -- about where a wet day becomes a
 * heavy-rain day. Fixed, so the height means millimetres rather than "the
 * wettest of these five days"; a wetter week raises the ceiling instead of
 * being clipped.
 */
const AMOUNT_FULL_SCALE: Record<string, number> = { mm: 20, in: 0.8 };

/**
 * Days are range bars, not a curve.
 *
 * A day is a discrete bucket with two values. Connecting Monday's high to
 * Tuesday's high with a smooth line asserts temperatures for the points in
 * between, and there are none -- there is no "Monday and a half". A bar from low
 * to high also answers "how warm on Tuesday?" by reading an end, instead of
 * tracing a line back to an axis.
 *
 * The readings sit BESIDE the bar, level with its ends, rather than in label
 * bands above and below it. Measured on the previous layout, those bands cost
 * 28 of the chart's 78 pixels while the bars inked only 44% of what was left --
 * which is where the empty look came from. Beside the bar the numbers cost no
 * vertical space, they never have to contrast against the temperature gradient,
 * and they work at any bar length.
 */
interface Geometry {
  barWidth: number;
  gap: number;
  textWidth: number;
  /** Room left of the range bar, taken by the amount bar when it is shown. */
  leading: number;
  barOffset: number;
}

export class YacwDailyForecast extends ForecastBlock {
  @property({ attribute: false }) items: Forecast[] = [];
  @property({ attribute: false }) ctx!: FormatContext;
  @property({ type: String }) temperatureUnit = "°";
  @property({ type: String }) precipitationUnit = "mm";
  @property({ type: String }) heading = "Daily";
  @property({ type: Boolean }) showProbability = true;
  @property({ type: Boolean }) showAmount = false;
  @property({ type: Boolean }) animated = true;
  @property({ type: Boolean }) compact = false;
  @property({ attribute: false }) colorScale?: {
    min: number;
    max: number;
    ramp: RampStop[];
  };

  protected readonly plotSelector = ".row.chart";
  protected readonly plotFallback = SIZES.normal.minPlot;

  protected override render() {
    const items = this.items;
    if (!items.length) return nothing;

    const count = items.length;
    const contentWidth = Math.max(this.availableWidth, count * MIN_COLUMN);
    const columnWidth = contentWidth / count;
    const size = this.compact ? SIZES.compact : SIZES.normal;

    const values: number[] = [];
    for (const item of items) {
      if (item.temperature !== undefined) values.push(item.temperature);
      if (item.templow !== undefined) values.push(item.templow);
    }
    const rawExtent = extentOf(values);

    // Only the amount gets a bar. A probability per DAY says little -- 60 %
    // somewhere in 24 hours -- and stays in the text beside the weekday.
    const amounts = items.map((i) =>
      this.showAmount ? i.precipitation : undefined,
    );
    const hasAmount = amounts.some((a) => a !== undefined && a > 0);

    // Bar and readings form one centred group, so the bar itself sits left of
    // the column centre. The icon and the weekday belong to the BAR, not to
    // the group, and are shifted onto its axis -- otherwise the icon floats
    // above the numbers instead of above the thing it describes.
    const geometry = this._geometry(columnWidth, size, hasAmount);

    return html`
      <section
        class="block ${this.compact ? "is-compact" : ""}"
        aria-labelledby="daily-heading"
        style="--cols:${count};--content-width:${round(contentWidth)}px"
      >
        <h3 class="section-title" id="daily-heading">${this.heading}</h3>
        <div class="scroller">
          <div class="grid">
            <div
              class="row icons"
              style="transform:translateX(${round(geometry.barOffset)}px)"
            >
              ${items.map(
                (item) => html`
                  <div class="cell">
                    <yacw-weather-icon
                      .condition=${item.condition}
                      .night=${false}
                      .animated=${this.animated}
                    ></yacw-weather-icon>
                  </div>
                `,
              )}
            </div>

            ${
              rawExtent
                ? this._renderBars(
                    items,
                    rawExtent,
                    contentWidth,
                    columnWidth,
                    size,
                    geometry,
                    hasAmount ? amounts : undefined,
                  )
                : nothing
            }

            <div
              class="row labels"
              style="transform:translateX(${round(geometry.barOffset)}px)"
            >
              ${items.map(
                (item) => html`
                  <div class="cell label">
                    <span class="day"
                      >${formatWeekdayShort(item.date, this.ctx)}</span
                    >${this._precipitationText(item)}
                  </div>
                `,
              )}
            </div>
          </div>
        </div>
        ${this._renderTable(items)}
      </section>
    `;
  }

  /**
   * Precipitation rides along with the weekday instead of owning a bar track
   * and a label row. Those two rows cost 27px and, on integrations that report
   * no daily probability, carried almost nothing.
   */
  private _precipitationText(item: Forecast) {
    const parts: string[] = [];
    if (
      this.showProbability &&
      item.precipitationProbability !== undefined &&
      item.precipitationProbability > 0
    ) {
      parts.push(`${Math.round(item.precipitationProbability)}%`);
    }
    if (
      this.showAmount &&
      item.precipitation !== undefined &&
      item.precipitation > 0
    ) {
      parts.push(`${item.precipitation.toFixed(1)} ${this.precipitationUnit}`);
    }
    if (!parts.length) return nothing;
    return html`<span class="precip">${parts.join(" · ")}</span>`;
  }

  private _geometry(
    columnWidth: number,
    size: { bar: number; text: number },
    withAmount: boolean,
  ): Geometry {
    const barWidth = Math.min(size.bar, Math.max(12, columnWidth * 0.22));
    const textWidth = size.text * 2.6;
    const gap = 5;
    // The amount bar sits LEFT of the range bar, the readings right of it, so
    // the two columns never fight over the same side.
    const leading = withAmount ? PRECIP_WIDTH + PRECIP_GAP : 0;
    return {
      barWidth,
      gap,
      textWidth,
      leading,
      barOffset: (leading - gap - textWidth) / 2,
    };
  }

  private _renderBars(
    items: Forecast[],
    rawExtent: { min: number; max: number },
    width: number,
    columnWidth: number,
    size: { bar: number; text: number; minPlot: number },
    geometry: Geometry,
    amounts?: (number | undefined)[],
  ) {
    const height = Math.max(size.minPlot, this.effectivePlotHeight);
    const extent = paddedExtent(rawExtent, 6, 0.05);
    const top = PLOT_INSET;
    const bottom = height - PLOT_INSET;
    const yOf = (value: number) => scaleY(value, extent, top, bottom);
    const gradient = this.colorScale
      ? gradientSpec(
          this.colorScale.min,
          this.colorScale.max,
          this.colorScale.ramp,
          yOf,
        )
      : undefined;

    const { barWidth, gap, textWidth, leading } = geometry;
    const radius = Math.min(barWidth / 2, 5);
    const groupWidth = leading + barWidth + gap + textWidth;
    const fullScale = Math.max(
      AMOUNT_FULL_SCALE[this.precipitationUnit] ?? AMOUNT_FULL_SCALE.mm,
      ...(amounts ?? []).filter((a): a is number => a !== undefined),
    );

    return html`
      <div class="row chart" style="min-height:${size.minPlot}px">
        <svg
          width=${round(width)}
          height=${round(height)}
          viewBox="0 0 ${round(width)} ${round(height)}"
          class=${gradient ? "scaled" : ""}
          aria-hidden="true"
          focusable="false"
        >
          ${
            gradient
              ? svg`<defs>
                  <linearGradient
                    id="temp-scale"
                    gradientUnits="userSpaceOnUse"
                    x1="0" y1=${round(gradient.y1)} x2="0" y2=${round(gradient.y2)}
                  >
                    ${gradient.stops.map(
                      (stop) =>
                        svg`<stop offset=${stop.offset} stop-color=${stop.color} />`,
                    )}
                  </linearGradient>
                </defs>`
              : ""
          }
          ${items.map((item, index) => {
            const centre = (index + 0.5) * columnWidth;
            const groupX = centre - groupWidth / 2;
            const barX = groupX + leading;
            const textX = barX + barWidth + gap;
            const high = item.temperature;
            const low = item.templow;
            const precip = amounts
              ? this._renderAmount(amounts[index], fullScale, groupX, top, bottom)
              : "";
            if (high === undefined && low === undefined) return precip;

            // The recessive track shows how much of the week's span this day
            // covers; without it a short bar floats with no frame of reference.
            const track = svg`<rect
              class="track"
              x=${round(barX)} y=${round(top)}
              width=${round(barWidth)} height=${round(bottom - top)}
              rx=${round(radius)}
            />`;

            if (high === undefined || low === undefined) {
              // One value is all the integration gave: a dot, not an invented span.
              const only = (high ?? low) as number;
              const y = yOf(only);
              return svg`
                ${precip}
                ${track}
                <circle
                  class="single"
                  cx=${round(barX + barWidth / 2)} cy=${round(y)}
                  r=${round(barWidth / 2)}
                />
                <text class="cap high" x=${round(textX)} y=${round(y)}>
                  ${Math.round(only)}${shortUnit(this.temperatureUnit)}
                </text>`;
            }

            const yHigh = yOf(Math.max(high, low));
            const yLow = yOf(Math.min(high, low));
            // When the bar is too short to hold both readings at their true
            // heights, only the LABELS move apart. The bar keeps telling the
            // truth, and the nudged labels stay inside the plot.
            const span = yLow - yHigh;
            const nudge = span < LABEL_CLEARANCE ? (LABEL_CLEARANCE - span) / 2 : 0;
            const highY = Math.max(PLOT_INSET, yHigh - nudge);
            const lowY = Math.min(height - PLOT_INSET, yLow + nudge);

            return svg`
              ${precip}
              ${track}
              <rect
                class="range"
                x=${round(barX)} y=${round(yHigh)}
                width=${round(barWidth)}
                height=${round(Math.max(barWidth * 0.6, span))}
                rx=${round(radius)}
              />
              <text class="cap high" x=${round(textX)} y=${round(highY)}>
                ${Math.round(high)}${shortUnit(this.temperatureUnit)}
              </text>
              <text class="cap low" x=${round(textX)} y=${round(lowY)}>
                ${Math.round(low)}${shortUnit(this.temperatureUnit)}
              </text>`;
          })}
        </svg>
      </div>
    `;
  }

  /** Filled from the bottom of its own track: height is the day's amount. */
  private _renderAmount(
    amount: number | undefined,
    fullScale: number,
    x: number,
    top: number,
    bottom: number,
  ) {
    const track = svg`<rect
      class="precip-track"
      x=${round(x)} y=${round(top)}
      width=${PRECIP_WIDTH} height=${round(bottom - top)}
      rx="2"
    />`;
    if (amount === undefined || amount <= 0) return track;
    const height = Math.max(
      2,
      (Math.min(fullScale, amount) / fullScale) * (bottom - top),
    );
    return svg`${track}<rect
      class="precip-bar"
      x=${round(x)} y=${round(bottom - height)}
      width=${PRECIP_WIDTH} height=${round(height)}
      rx="2"
    />`;
  }

  private _renderTable(items: Forecast[]) {
    return html`
      <table class="sr-only">
        <caption>
          ${this.heading}
        </caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Condition</th>
            <th scope="col">High</th>
            <th scope="col">Low</th>
            <th scope="col">Precipitation</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(
            (item) => html`
              <tr>
                <td>${item.date.toLocaleDateString(this.ctx.locale)}</td>
                <td>${item.condition ?? "unknown"}</td>
                <td>
                  ${
                    item.temperature !== undefined
                      ? `${Math.round(item.temperature)}${this.temperatureUnit}`
                      : "unknown"
                  }
                </td>
                <td>
                  ${
                    item.templow !== undefined
                      ? `${Math.round(item.templow)}${this.temperatureUnit}`
                      : "unknown"
                  }
                </td>
                <td>
                  ${
                    item.precipitationProbability !== undefined
                      ? `${Math.round(item.precipitationProbability)}%`
                      : "unknown"
                  }
                  ${
                    item.precipitation !== undefined
                      ? `${item.precipitation.toFixed(1)} ${this.precipitationUnit}`
                      : ""
                  }
                </td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    `;
  }

  static override styles = [
    shared,
    css`
      :host {
        display: block;
        min-width: 0;
        container-type: inline-size;
      }
      .block {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }
      .scroller {
        flex: 1 1 auto;
        min-height: 0;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: thin;
      }
      .scroller::-webkit-scrollbar {
        height: 4px;
      }
      .scroller::-webkit-scrollbar-thumb {
        background: var(--yacw-grid);
        border-radius: 2px;
      }
      .grid {
        width: var(--content-width);
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        gap: 3px;
      }
      .grid > .row:not(.chart) {
        flex: 0 0 auto;
      }
      .row {
        display: grid;
        grid-template-columns: repeat(var(--cols), 1fr);
        align-items: center;
      }
      .cell {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 0;
      }
      .icons {
        --yacw-icon-size: 26px;
      }
      .is-compact .icons {
        --yacw-icon-size: 20px;
      }
      .chart {
        display: block;
        position: relative;
        line-height: 0;
        /* Takes whatever height the card's ratio leaves this block. */
        flex: 1 1 0;
      }
      .chart svg {
        position: absolute;
        top: 0;
        left: 0;
        display: block;
        height: 100%;
      }
      .track {
        fill: var(--yacw-grid);
      }
      .precip-track {
        fill: var(--yacw-grid);
      }
      .precip-bar {
        fill: var(--yacw-precip);
      }
      .range,
      .single {
        fill: var(--yacw-temp);
      }
      /* Each bar shows exactly the slice of the ramp its own range covers,
         because the gradient is defined over the plot, not per bar. */
      .scaled .range,
      .scaled .single {
        fill: url(#temp-scale);
      }
      .cap {
        text-anchor: start;
        font-size: 11px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        fill: var(--yacw-text);
        dominant-baseline: middle;
      }
      .cap.low {
        font-weight: 400;
        fill: var(--yacw-text-muted);
      }
      .is-compact .cap {
        font-size: 10px;
      }
      .label {
        gap: 5px;
        white-space: nowrap;
        overflow: hidden;
      }
      .day {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--yacw-text);
      }
      .precip {
        font-size: 0.625rem;
        color: var(--yacw-text-muted);
        font-variant-numeric: tabular-nums;
      }
    `,
  ];
}

defineOnce("yacw-daily-forecast", YacwDailyForecast);

declare global {
  interface HTMLElementTagNameMap {
    "yacw-daily-forecast": YacwDailyForecast;
  }
}
