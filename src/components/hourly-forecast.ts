import { defineOnce } from "../utils/define";
import { css, html, nothing, svg } from "lit";
import { property } from "lit/decorators.js";
import { ForecastBlock } from "./forecast-base";
import "./weather-icon";
import type { Forecast } from "../types";
import { DayNight } from "../data/weather";
import {
  areaPath,
  extentOf,
  monotonePath,
  paddedExtent,
  round,
  scaleY,
  type Point,
} from "../utils/chart";
import {
  formatDateTimeLong,
  formatHour,
  type FormatContext,
} from "../utils/datetime";
import { shared } from "../styles/tokens";
import { shortUnit } from "../utils/units";
import { gradientSpec, type RampStop } from "../utils/temperature-scale";

const MIN_COLUMN = 54;
const CHART_INSET = 8;

/** compact_mode is a real size change, not just tighter padding. */
const SIZES = {
  normal: { chart: 64, precip: 18, minChart: 52 },
  compact: { chart: 44, precip: 13, minChart: 36 },
} as const;

export class YacwHourlyForecast extends ForecastBlock {
  @property({ attribute: false }) items: Forecast[] = [];
  @property({ attribute: false }) ctx!: FormatContext;
  @property({ attribute: false }) dayNight?: DayNight;
  @property({ type: String }) temperatureUnit = "°";
  @property({ type: String }) precipitationUnit = "mm";
  @property({ type: String }) heading = "Hourly";
  @property({ type: Boolean }) showProbability = true;
  @property({ type: Boolean }) showAmount = false;
  @property({ type: Boolean }) scrollHours = true;
  @property({ type: Boolean }) animated = true;
  @property({ type: Boolean }) nightIcons = true;
  @property({ type: Boolean }) compact = false;
  protected readonly plotSelector = ".row.chart";
  protected readonly plotFallback = SIZES.normal.chart;

  @property({ type: Boolean }) showExtremes = true;
  @property({ attribute: false }) extremeLabels = {
    warmest: "warmest",
    coldest: "coldest",
  };
  /** Absent = one fixed temperature colour. */
  @property({ attribute: false }) colorScale?: {
    min: number;
    max: number;
    ramp: RampStop[];
  };

  protected override render() {
    const items = this.items;
    if (!items.length) return nothing;

    const count = items.length;
    const contentWidth = this.scrollHours
      ? Math.max(this.availableWidth, count * MIN_COLUMN)
      : Math.max(this.availableWidth, count * 28);
    const columnWidth = contentWidth / count;

    const temperatures = items.map((i) => i.temperature);
    const extent = extentOf(
      temperatures.filter((t): t is number => t !== undefined),
    );

    const extremes = this.showExtremes ? this._extremes(items) : {};

    const probabilities = items.map((i) => i.precipitationProbability);
    const hasProbability =
      this.showProbability && probabilities.some((p) => p !== undefined);
    // The amount is its own channel: it must not depend on the probability
    // being enabled, and some integrations report millimetres without ever
    // reporting a percentage.
    const hasAmount =
      this.showAmount && items.some((i) => i.precipitation !== undefined);
    const hasPrecipitation = hasProbability || hasAmount;

    const size = this.compact ? SIZES.compact : SIZES.normal;

    return html`
      <section
        class="block ${this.compact ? "is-compact" : ""}"
        aria-labelledby="hourly-heading"
        style="--cols:${count};--content-width:${round(contentWidth)}px"
      >
        <h3 class="section-title" id="hourly-heading">${this.heading}</h3>
        <div class="scroller ${this.scrollHours ? "scrollable" : ""}">
          <div class="grid">
            <div class="row icons">
              ${items.map(
                (item) => html`
                  <div class="cell">
                    <yacw-weather-icon
                      .condition=${item.condition}
                      .night=${this.nightIcons && this._isNight(item)}
                      .animated=${this.animated}
                    ></yacw-weather-icon>
                  </div>
                `,
              )}
            </div>

            ${
              extent
                ? this._renderChart(
                    items,
                    extent,
                    contentWidth,
                    columnWidth,
                    Math.max(size.minChart, this.effectivePlotHeight),
                    extremes,
                  )
                : nothing
            }

            <div class="row values">
              ${items.map((item, index) => {
                const isMax = index === extremes.max;
                const isMin = index === extremes.min;
                // 24 unscrolled hours leave roughly 29px per column, where a
                // glyph would push the value into its neighbour. The screen
                // reader text is not tied to the glyph and stays either way.
                const showGlyph = columnWidth >= 44;
                return html`
                  <div class="cell value ${isMax || isMin ? "extreme" : ""}">
                    ${
                      (isMax || isMin) && showGlyph
                        ? html`<span class="marker" aria-hidden="true"
                            >${isMax ? "▲" : "▼"}</span
                          >`
                        : nothing
                    }${
                      isMax || isMin
                        ? html`<span class="sr-only"
                            >${
                              isMax
                                ? this.extremeLabels.warmest
                                : this.extremeLabels.coldest
                            },
                          </span>`
                        : nothing
                    }${
                      item.temperature !== undefined
                        ? html`${Math.round(item.temperature)}${shortUnit(
                            this.temperatureUnit,
                          )}`
                        : html`<span class="absent" aria-hidden="true">–</span>`
                    }
                  </div>
                `;
              })}
            </div>

            ${
              hasPrecipitation
                ? this._renderPrecipitation(
                    items,
                    contentWidth,
                    columnWidth,
                    size.precip,
                    hasProbability,
                  )
                : nothing
            }

            <div class="row labels">
              ${items.map(
                (item) => html`
                  <div class="cell label">
                    ${formatHour(item.date, this.ctx, columnWidth < 42)}
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
   * Index of the warmest and the coldest displayed hour.
   *
   * Strict comparisons mean the FIRST hour wins a tie, so a plateau gets one
   * marker instead of six. And when every hour is the same temperature there is
   * no peak worth pointing at, so nothing is marked at all -- a "highest" badge
   * on a flat line would be noise dressed as information.
   */
  private _extremes(items: Forecast[]): { max?: number; min?: number } {
    let max: number | undefined;
    let min: number | undefined;
    items.forEach((item, index) => {
      const value = item.temperature;
      if (value === undefined) return;
      if (max === undefined || value > items[max].temperature!) max = index;
      if (min === undefined || value < items[min].temperature!) min = index;
    });
    if (max === undefined || min === undefined) return {};
    if (items[max].temperature === items[min].temperature) return {};
    return { max, min };
  }

  private _isNight(item: Forecast): boolean {
    if (item.isDaytime === true) return false;
    if (item.isDaytime === false) return true;
    return this.dayNight?.isNight(item.date) ?? false;
  }

  private _renderChart(
    items: Forecast[],
    rawExtent: { min: number; max: number },
    width: number,
    columnWidth: number,
    chartHeight: number,
    extremes: { max?: number; min?: number },
  ) {
    const extent = paddedExtent(rawExtent);
    const yOf = (value: number) =>
      scaleY(value, extent, CHART_INSET, chartHeight - CHART_INSET);
    // The gradient spans the CONFIGURED domain in user space, not the visible
    // extent, so a mark's colour means a temperature rather than a rank within
    // today's data.
    const gradient = this.colorScale
      ? gradientSpec(
          this.colorScale.min,
          this.colorScale.max,
          this.colorScale.ramp,
          yOf,
        )
      : undefined;
    // The point list skips hours without a temperature, so each point carries
    // its item index -- the two arrays are not parallel.
    const points: (Point & { index: number })[] = [];
    items.forEach((item, index) => {
      if (item.temperature === undefined) return;
      points.push({
        index,
        x: round((index + 0.5) * columnWidth),
        y: round(yOf(item.temperature)),
      });
    });
    if (!points.length) return nothing;

    return html`
      <div class="row chart">
        <svg
          width=${round(width)}
          height=${chartHeight}
          viewBox="0 0 ${round(width)} ${chartHeight}"
          class=${gradient ? "scaled" : ""}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id="area-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" class="fade-from" />
              <stop offset="100%" class="fade-to" />
            </linearGradient>
            ${
              gradient
                ? svg`<linearGradient
                    id="temp-scale"
                    gradientUnits="userSpaceOnUse"
                    x1="0" y1=${round(gradient.y1)} x2="0" y2=${round(gradient.y2)}
                  >
                    ${gradient.stops.map(
                      (stop) =>
                        svg`<stop offset=${stop.offset} stop-color=${stop.color} />`,
                    )}
                  </linearGradient>`
                : ""
            }
          </defs>
          <path class="area" d=${areaPath(points, chartHeight)} />
          <path class="line" d=${monotonePath(points)} />
          ${points.map((p) => {
            const extreme = p.index === extremes.max || p.index === extremes.min;
            if (!extreme) {
              return svg`<circle class="node" cx=${p.x} cy=${p.y} r="2.6" />`;
            }
            // A halo rather than only a bigger dot: the ring reads at a glance
            // and, unlike size alone, survives being scaled down on a phone.
            return svg`
              <circle class="halo" cx=${p.x} cy=${p.y} r="7.5" />
              <circle class="node extreme" cx=${p.x} cy=${p.y} r="5" />`;
          })}
        </svg>
      </div>
    `;
  }

  /**
   * Precipitation gets its own baseline instead of a second y-axis on the
   * temperature plot. Two scales in one frame can be slid against each other
   * until any correlation appears; percent and degrees simply do not share an
   * axis.
   */
  /** Percentage and/or millimetres. Rendered with or without the bar track. */
  private _renderPrecipitationLabels(items: Forecast[]) {
    return html`
      <div class="row precip-labels">
        ${items.map(
          (item) => html`
            <div class="cell precip-value">
              ${
                item.precipitationProbability !== undefined &&
                item.precipitationProbability > 0
                  ? html`${Math.round(item.precipitationProbability)}%`
                  : nothing
              }
              ${
                this.showAmount &&
                item.precipitation !== undefined &&
                item.precipitation > 0
                  ? html`<span class="amount"
                      >${item.precipitation.toFixed(1)}&nbsp;${
                        this.precipitationUnit
                      }</span
                    >`
                  : nothing
              }
            </div>
          `,
        )}
      </div>
    `;
  }

  private _renderPrecipitation(
    items: Forecast[],
    width: number,
    columnWidth: number,
    trackHeight: number,
    withBars: boolean,
  ) {
    const barWidth = Math.min(14, Math.max(5, columnWidth * 0.34));
    if (!withBars) {
      return html`${this._renderPrecipitationLabels(items)}`;
    }
    return html`
      <div class="row precip">
        <svg
          width=${round(width)}
          height=${trackHeight}
          viewBox="0 0 ${round(width)} ${trackHeight}"
          aria-hidden="true"
          focusable="false"
        >
          <line
            class="baseline"
            x1="0"
            y1=${trackHeight - 0.5}
            x2=${round(width)}
            y2=${trackHeight - 0.5}
          />
          ${items.map((item, index) => {
            const probability = item.precipitationProbability;
            if (probability === undefined || probability <= 0) return nothing;
            const clamped = Math.min(100, Math.max(0, probability));
            const height = Math.max(2, (clamped / 100) * (trackHeight - 2));
            const x = round((index + 0.5) * columnWidth - barWidth / 2);
            return svg`<rect
              class="bar"
              x=${x}
              y=${round(trackHeight - height)}
              width=${round(barWidth)}
              height=${round(height)}
              rx="2"
            />`;
          })}
        </svg>
      </div>
      ${this._renderPrecipitationLabels(items)}
    `;
  }

  /** The chart is aria-hidden; this is what a screen reader reads instead. */
  private _renderTable(items: Forecast[]) {
    return html`
      <table class="sr-only">
        <caption>
          ${this.heading}
        </caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Condition</th>
            <th scope="col">Temperature</th>
            <th scope="col">Precipitation probability</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(
            (item) => html`
              <tr>
                <td>${formatDateTimeLong(item.date, this.ctx)}</td>
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
                    item.precipitationProbability !== undefined
                      ? `${Math.round(item.precipitationProbability)}%`
                      : "unknown"
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
        overflow: hidden;
      }
      .scroller.scrollable {
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: thin;
        scroll-snap-type: x proximity;
        overscroll-behavior-x: contain;
      }
      .scroller.scrollable::-webkit-scrollbar {
        height: 4px;
      }
      .scroller.scrollable::-webkit-scrollbar-thumb {
        background: var(--yacw-grid);
        border-radius: 2px;
      }
      .grid {
        width: var(--content-width);
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        gap: 2px;
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
        scroll-snap-align: start;
      }
      .icons {
        --yacw-icon-size: 30px;
      }
      .is-compact .icons {
        --yacw-icon-size: 22px;
      }
      .is-compact .value {
        font-size: 0.75rem;
      }
      .chart {
        display: block;
        position: relative;
        line-height: 0;
        /* Grows into the height the card's ratio gives this block; without
           this a taller block would only add whitespace, not a taller curve. */
        flex: 1 1 auto;
        min-height: 40px;
      }
      .precip {
        display: block;
        position: relative;
        line-height: 0;
      }
      .chart svg {
        display: block;
        height: 100%;
      }
      .precip svg {
        display: block;
      }
      .area {
        fill: url(#area-fade);
        stroke: none;
      }
      .fade-from {
        stop-color: var(--yacw-temp);
        stop-opacity: 0.3;
      }
      .fade-to {
        stop-color: var(--yacw-temp);
        stop-opacity: 0;
      }
      /* CSS can paint with a gradient reference, so the switch between the
         fixed colour and the scale is one class, not a second render path. */
      .scaled .area {
        fill: url(#temp-scale);
        fill-opacity: 0.22;
      }
      .scaled .line {
        stroke: url(#temp-scale);
      }
      .scaled .node {
        fill: url(#temp-scale);
      }
      .line {
        fill: none;
        stroke: var(--yacw-temp);
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .node.extreme {
        stroke-width: 2.5;
      }
      .halo {
        fill: none;
        stroke: var(--yacw-temp);
        stroke-width: 1.5;
        opacity: 0.4;
      }
      .scaled .halo {
        stroke: url(#temp-scale);
        opacity: 0.55;
      }
      .value.extreme {
        font-weight: 700;
        font-size: 1.14em;
      }
      /* The glyph is a second channel beside the enlarged node: size alone is a
         weak signal, and the shape survives a greyscale print or a screenshot. */
      .marker {
        font-size: 0.66em;
        line-height: 1;
        margin-right: 2px;
        opacity: 0.85;
        vertical-align: 0.12em;
      }
      .node {
        fill: var(--yacw-temp);
        stroke: var(--yacw-surface);
        stroke-width: 1.5;
      }
      .baseline {
        stroke: var(--yacw-grid);
        stroke-width: 1;
      }
      .bar {
        fill: var(--yacw-precip);
      }
      /* Values wear text tokens, never the series colour: the mark carries the
         identity, the number stays readable ink. */
      .value {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--yacw-text);
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
      }
      .absent {
        color: var(--yacw-text-muted);
      }
      .label {
        font-size: 0.6875rem;
        font-weight: 600;
        color: var(--yacw-text);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .precip-labels {
        margin-top: 1px;
      }
      .precip-value {
        font-size: 0.625rem;
        color: var(--yacw-text-muted);
        font-variant-numeric: tabular-nums;
        line-height: 1;
        padding-bottom: 1px;
        gap: 3px;
      }
      .amount {
        opacity: 0.75;
      }
    `,
  ];
}

defineOnce("yacw-hourly-forecast", YacwHourlyForecast);

declare global {
  interface HTMLElementTagNameMap {
    "yacw-hourly-forecast": YacwHourlyForecast;
  }
}
