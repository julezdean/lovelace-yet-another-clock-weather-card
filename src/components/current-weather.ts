import { defineOnce } from "../utils/define";
import { LitElement, css, html, nothing } from "lit";
import { property } from "lit/decorators.js";
import "./weather-icon";
import type { WeatherEntity } from "../types";
import { shared } from "../styles/tokens";

interface Detail {
  key: string;
  label: string;
  value: string;
}

export class YacwCurrentWeather extends LitElement {
  @property({ attribute: false }) entity?: WeatherEntity;
  @property({ type: String }) conditionText = "";
  @property({ type: Boolean }) night = false;
  @property({ type: Boolean }) animated = true;
  @property({ type: Boolean }) showFeelsLike = false;
  @property({ type: Boolean }) showHumidity = false;
  @property({ type: Boolean }) showWind = false;
  @property({ type: String }) location = "";
  /** False when the configured action is "none": no button role, no hover. */
  @property({ type: Boolean }) interactive = true;
  @property({ attribute: false }) labels: Record<string, string> = {};

  /**
   * Fires an intent instead of running the action. Handling it here would mean
   * holding `hass`, and a property that changes identity on every state change
   * in the house would re-render this element constantly.
   */
  private _fire(): void {
    if (!this.interactive) return;
    this.dispatchEvent(
      new CustomEvent("yacw-action", {
        bubbles: true,
        composed: true,
        detail: { target: "weather", entity: this.entity?.entity_id },
      }),
    );
  }

  private _onKey(event: KeyboardEvent): void {
    if (!this.interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this._fire();
    }
  }

  private get _details(): Detail[] {
    const attrs = this.entity?.attributes;
    if (!attrs) return [];
    const out: Detail[] = [];
    // Each value is only shown when the integration actually supplies it.
    // "undefined °C" is worse than an absent row.
    if (this.showFeelsLike && attrs.apparent_temperature !== undefined) {
      out.push({
        key: "feels_like",
        label: this.labels.feels_like ?? "Feels like",
        value: `${Math.round(attrs.apparent_temperature)}${attrs.temperature_unit ?? "°"}`,
      });
    }
    if (this.showHumidity && attrs.humidity !== undefined) {
      out.push({
        key: "humidity",
        label: this.labels.humidity ?? "Humidity",
        value: `${Math.round(attrs.humidity)}%`,
      });
    }
    if (this.showWind && attrs.wind_speed !== undefined) {
      out.push({
        key: "wind",
        label: this.labels.wind ?? "Wind",
        value:
          `${Math.round(attrs.wind_speed)} ${attrs.wind_speed_unit ?? ""}`.trim(),
      });
    }
    return out;
  }

  protected override render() {
    const entity = this.entity;
    if (!entity) return nothing;

    const attrs = entity.attributes;
    const temperature = attrs.temperature;
    const unit = attrs.temperature_unit ?? "°";
    const condition = this.conditionText || entity.state;
    const details = this._details;

    return html`
      <div
        class="current ${this.interactive ? "interactive" : ""}"
        role=${this.interactive ? "button" : nothing}
        tabindex=${this.interactive ? 0 : nothing}
        aria-label="${condition}${
          temperature !== undefined ? `, ${Math.round(temperature)}${unit}` : ""
        }"
        @click=${this._fire}
        @keydown=${this._onKey}
      >
        <yacw-weather-icon
          .condition=${entity.state}
          .night=${this.night}
          .animated=${this.animated}
        ></yacw-weather-icon>
        <div class="readout">
          <div class="temperature">
            ${
              temperature !== undefined
                ? html`${Math.round(temperature)}<span class="unit">${unit}</span>`
                : html`<span class="muted">–</span>`
            }
          </div>
          <div class="condition">${condition}</div>
          ${
            this.location
              ? html`<div class="location">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
                    />
                  </svg>
                  <span>${this.location}</span>
                </div>`
              : nothing
          }
        </div>
      </div>
      ${
        details.length
          ? html`<dl class="details">
              ${details.map(
                (detail) => html`
                  <div class="detail">
                    <dt>${detail.label}</dt>
                    <dd>${detail.value}</dd>
                  </div>
                `,
              )}
            </dl>`
          : nothing
      }
    `;
  }

  static override styles = [
    shared,
    css`
      :host {
        display: block;
      }
      .current {
        display: flex;
        align-items: center;
        justify-content: var(--yacw-hero-align, flex-start);
        gap: 10px;
        border-radius: 10px;
        padding: 4px 6px;
        margin: 0 -6px;
        --yacw-icon-size: var(--yacw-current-icon-size, clamp(42px, 6cqw, 72px));
      }
      .current.interactive {
        cursor: pointer;
        transition: background-color 140ms ease;
      }
      .current.interactive:hover,
      .current.interactive:focus-visible {
        background: color-mix(in srgb, var(--yacw-text) 7%, transparent);
      }
      .current:focus-visible {
        outline: 2px solid var(--yacw-accent);
        outline-offset: 1px;
      }
      .readout {
        min-width: 0;
      }
      .temperature {
        font-size: var(--yacw-temperature-size, clamp(1.8rem, 3.6cqw, 2.9rem));
        font-weight: 500;
        line-height: 1.1;
        color: var(--yacw-text);
        font-variant-numeric: tabular-nums;
      }
      .unit {
        font-size: 0.55em;
        font-weight: 400;
        margin-left: 1px;
        color: var(--yacw-text-muted);
      }
      .condition {
        font-size: clamp(0.8rem, 1.5cqw, 1.05rem);
        color: var(--yacw-text-muted);
        line-height: 1.25;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .location {
        display: flex;
        align-items: center;
        justify-content: var(--yacw-hero-align, flex-start);
        gap: 3px;
        margin-top: 2px;
        font-size: clamp(0.7rem, 1.2cqw, 0.85rem);
        color: var(--yacw-text-muted);
      }
      .location svg {
        width: 1em;
        height: 1em;
        flex: 0 0 auto;
        fill: currentColor;
        opacity: 0.75;
      }
      .details {
        display: flex;
        flex-wrap: wrap;
        justify-content: var(--yacw-hero-align, flex-start);
        gap: 4px 14px;
        margin: 8px 0 0;
      }
      .detail {
        display: flex;
        align-items: baseline;
        gap: 4px;
      }
      dt {
        font-size: 0.6875rem;
        color: var(--yacw-text-muted);
      }
      dd {
        margin: 0;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--yacw-text);
        font-variant-numeric: tabular-nums;
      }
      @media (prefers-reduced-motion: reduce) {
        .current {
          transition: none;
        }
      }
    `,
  ];
}

defineOnce("yacw-current-weather", YacwCurrentWeather);

declare global {
  interface HTMLElementTagNameMap {
    "yacw-current-weather": YacwCurrentWeather;
  }
}
