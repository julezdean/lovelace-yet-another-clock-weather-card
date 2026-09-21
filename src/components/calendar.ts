import { defineOnce } from "../utils/define";
import { LitElement, css, html, nothing } from "lit";
import { property } from "lit/decorators.js";
import type { CalendarEvent } from "../types";
import { dayKey, formatEventTime, type FormatContext } from "../utils/datetime";
import { shared } from "../styles/tokens";

export interface CalendarLabels {
  today: string;
  tomorrow: string;
  allDay: string;
  empty: string;
}

export class YacwCalendar extends LitElement {
  @property({ attribute: false }) events: CalendarEvent[] = [];
  @property({ attribute: false }) ctx!: FormatContext;
  @property({ attribute: false }) labels!: CalendarLabels;
  @property({ type: Number }) count = 3;
  @property({ type: String }) heading = "";
  @property({ type: Boolean }) interactive = false;

  /**
   * Day label for an event. "Today" and "Tomorrow" are worth the special case:
   * they are what the reader is actually scanning for, and a weekday name makes
   * them do the arithmetic.
   */
  private _dayLabel(event: CalendarEvent): string {
    const zone = this.ctx.timeZone;
    const key = dayKey(event.start, zone);
    const now = new Date();
    if (key === dayKey(now, zone)) return this.labels.today;
    const tomorrow = new Date(now.getTime() + 86_400_000);
    if (key === dayKey(tomorrow, zone)) return this.labels.tomorrow;
    return new Intl.DateTimeFormat(this.ctx.locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: zone,
    }).format(event.start);
  }

  private _fire(event: CalendarEvent): void {
    if (!this.interactive) return;
    // The row's own calendar is passed as the fallback entity, so a plain
    // more-info action opens the calendar the appointment came from rather
    // than an arbitrary one.
    this.dispatchEvent(
      new CustomEvent("yacw-action", {
        bubbles: true,
        composed: true,
        detail: { target: "calendar", entity: event.calendar },
      }),
    );
  }

  private _onKey(domEvent: KeyboardEvent, event: CalendarEvent): void {
    if (!this.interactive) return;
    if (domEvent.key === "Enter" || domEvent.key === " ") {
      domEvent.preventDefault();
      this._fire(event);
    }
  }

  protected override render() {
    const events = this.events.slice(0, this.count);

    return html`
      <section class="calendar" aria-label=${this.heading || "Calendar"}>
        ${
          events.length
            ? html`<ul>
                ${events.map(
                  (event) => html`
                    <li
                      class=${this.interactive ? "interactive" : ""}
                      role=${this.interactive ? "button" : nothing}
                      tabindex=${this.interactive ? 0 : nothing}
                      @click=${() => this._fire(event)}
                      @keydown=${(domEvent: KeyboardEvent) =>
                        this._onKey(domEvent, event)}
                    >
                      <span class="when">
                        <span class="day">${this._dayLabel(event)}</span>
                        <span class="time"
                          >${
                            event.allDay
                              ? this.labels.allDay
                              : formatEventTime(event.start, this.ctx)
                          }</span
                        >
                      </span>
                      <span class="summary" title=${event.summary}
                        >${event.summary}</span
                      >
                    </li>
                  `,
                )}
              </ul>`
            : html`<p class="muted empty">${this.labels.empty}</p>`
        }
      </section>
    `;
  }

  static override styles = [
    shared,
    css`
      :host {
        display: block;
        width: 100%;
        min-width: 0;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        /* One grid for the whole list, with the rows contributing their cells
           via display:contents. A grid per <li> would size each row on its own
           and the times would not line up -- which is the whole point of a
           column of times. */
        display: grid;
        grid-template-columns: max-content max-content minmax(0, 1fr);
        gap: 2px 8px;
        text-align: left;
        font-size: 0.8125rem;
        line-height: 1.35;
      }
      /* subgrid, not display:contents: a clickable row needs a real box for
         the focus ring and the hover surface, and display:contents removes it
         (and has a history of dropping the element from the accessibility
         tree). subgrid keeps the box and still shares the parent's columns. */
      li {
        display: grid;
        grid-column: 1 / -1;
        grid-template-columns: subgrid;
        align-items: baseline;
        border-radius: 6px;
        padding: 1px 4px;
        margin: 0 -4px;
      }
      li.interactive {
        cursor: pointer;
        transition: background-color 120ms ease;
      }
      li.interactive:hover {
        background: color-mix(in srgb, var(--yacw-text) 7%, transparent);
      }
      li.interactive:focus-visible {
        outline: 2px solid var(--yacw-accent);
        outline-offset: 0;
      }
      .when {
        display: contents;
      }
      .day,
      .time {
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .day {
        color: var(--yacw-text-muted);
      }
      .time {
        color: var(--yacw-text);
        font-weight: 600;
      }
      .summary {
        color: var(--yacw-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .empty {
        margin: 0;
        font-size: 0.8125rem;
      }
    `,
  ];
}

defineOnce("yacw-calendar", YacwCalendar);

declare global {
  interface HTMLElementTagNameMap {
    "yacw-calendar": YacwCalendar;
  }
}
