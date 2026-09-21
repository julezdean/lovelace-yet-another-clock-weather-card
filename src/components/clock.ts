import { defineOnce } from "../utils/define";
import { LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { formatClock, formatFullDate, msUntilNextTick } from "../utils/datetime";
import { shared } from "../styles/tokens";

/**
 * The clock owns its own timer and its own state so a tick re-renders this
 * element only. Folded into the card it would re-render the forecast charts up
 * to 3600 times an hour.
 *
 * The timer is a self-rescheduling setTimeout aligned to the next boundary, not
 * setInterval(1000): without seconds that is 60 wake-ups an hour instead of
 * 3600, and it cannot drift into displaying a stale second.
 */
export class YacwClock extends LitElement {
  @property({ type: String }) locale = "en";
  @property({ type: String }) timeZone?: string;
  @property({ type: Boolean }) hour12?: boolean;
  @property({ type: Boolean }) showSeconds = false;
  @property({ type: Boolean }) showDate = true;
  @property({ type: Boolean }) showYear = false;

  @state() private _now = new Date();

  private _timer?: number;
  private readonly _onVisibility = () => {
    if (document.visibilityState === "hidden") {
      this._stop();
    } else {
      // Catch up immediately rather than showing a stale time until the next tick.
      this._now = new Date();
      this._start();
    }
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this._now = new Date();
    this._start();
    document.addEventListener("visibilitychange", this._onVisibility);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stop();
    document.removeEventListener("visibilitychange", this._onVisibility);
  }

  protected override updated(changed: Map<string, unknown>): void {
    // Switching seconds on or off changes the tick interval.
    if (changed.has("showSeconds")) this._start();
  }

  private _start(): void {
    this._stop();
    if (!this.isConnected || document.visibilityState === "hidden") return;
    const schedule = () => {
      const delay = msUntilNextTick(new Date(), this.showSeconds);
      this._timer = window.setTimeout(() => {
        this._now = new Date();
        schedule();
      }, delay);
    };
    schedule();
  }

  private _stop(): void {
    if (this._timer !== undefined) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
  }

  private get _ctx() {
    return {
      locale: this.locale,
      timeZone: this.timeZone,
      hour12: this.hour12,
    };
  }

  protected override render() {
    const time = formatClock(this._now, this._ctx, this.showSeconds);
    const date = this.showDate
      ? formatFullDate(this._now, this._ctx, this.showYear)
      : undefined;

    return html`
      <time class="time" datetime=${this._now.toISOString()}>${time}</time>
      ${date ? html`<div class="date">${date}</div>` : nothing}
    `;
  }

  static override styles = [
    shared,
    css`
      :host {
        display: block;
        line-height: 1.05;
      }
      .time {
        display: block;
        font-size: var(--yacw-clock-size, clamp(2.8rem, 8.6cqw, 5.6rem));
        font-weight: var(--yacw-clock-weight, 300);
        letter-spacing: -0.02em;
        color: var(--yacw-text);
        font-variant-numeric: tabular-nums;
      }
      .date {
        margin-top: 2px;
        font-size: var(--yacw-date-size, clamp(0.8rem, 1.5cqw, 1.1rem));
        color: var(--yacw-text-muted);
      }
    `,
  ];
}

defineOnce("yacw-clock", YacwClock);

declare global {
  interface HTMLElementTagNameMap {
    "yacw-clock": YacwClock;
  }
}
