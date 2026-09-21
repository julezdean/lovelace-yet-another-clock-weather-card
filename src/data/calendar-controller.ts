import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { CalendarEvent, HomeAssistant, RawCalendarEvent } from "../types";
import { msUntilMidnight } from "../utils/datetime";

/** Slow safety net; the state-change trigger below does the real work. */
const REFRESH_INTERVAL = 15 * 60 * 1000;

function parseBoundary(
  value: { dateTime?: string; date?: string } | undefined,
): { date: Date; allDay: boolean } | undefined {
  if (!value) return undefined;
  if (value.dateTime) {
    const date = new Date(value.dateTime);
    return Number.isNaN(date.getTime()) ? undefined : { date, allDay: false };
  }
  if (value.date) {
    // "YYYY-MM-DD" parsed bare is UTC midnight, which lands on the previous day
    // west of Greenwich. Splitting it keeps an all-day event on its own day.
    const [year, month, day] = value.date.split("-").map(Number);
    if (!year || !month || !day) return undefined;
    return { date: new Date(year, month - 1, day), allDay: true };
  }
  return undefined;
}

function normalize(raw: RawCalendarEvent[], calendar: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const item of raw ?? []) {
    const start = parseBoundary(item?.start);
    if (!start) continue;
    out.push({
      summary: item.summary?.trim() || "(no title)",
      start: start.date,
      end: parseBoundary(item.end)?.date,
      allDay: start.allDay,
      location: item.location || undefined,
      calendar,
    });
  }
  return out;
}

/**
 * Loads upcoming calendar events.
 *
 * Unlike weather, calendars have no websocket subscription -- the only read
 * path is GET /api/calendars/<entity_id>?start=&end=. That forces a pull, so
 * the job here is to pull as rarely as possible while still being correct:
 *
 *  - on connect, and whenever the entity list or window changes
 *  - when a calendar entity's state object changes, which Home Assistant
 *    updates as events begin and end -- this is what catches new entries
 *  - at local midnight, so "today" and "tomorrow" re-label themselves
 *  - when the tab becomes visible again
 *  - and a 15-minute backstop for everything the above misses
 *
 * All timers stop while the card is detached or the tab is hidden.
 */
export class CalendarController implements ReactiveController {
  private _hass?: HomeAssistant;
  private _entities: string[] = [];
  private _daysAhead = 14;
  private _connected = false;

  private _events: CalendarEvent[] = [];
  private _loading = false;
  private _error?: string;

  private _timer?: number;
  private _midnightTimer?: number;
  private _generation = 0;
  /** Identity of the state objects we last saw, to detect real changes. */
  private _stateStamp = "";

  private readonly _onVisibility = () => {
    if (document.visibilityState === "visible" && this._connected) {
      void this._load();
      this._schedule();
    } else {
      this._clearTimers();
    }
  };

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this);
  }

  get events(): CalendarEvent[] {
    return this._events;
  }

  get loading(): boolean {
    return this._loading;
  }

  get error(): string | undefined {
    return this._error;
  }

  hostConnected(): void {
    this._connected = true;
    document.addEventListener("visibilitychange", this._onVisibility);
    if (this._entities.length) {
      void this._load();
      this._schedule();
    }
  }

  hostDisconnected(): void {
    this._connected = false;
    this._generation += 1;
    this._clearTimers();
    document.removeEventListener("visibilitychange", this._onVisibility);
  }

  update(
    hass: HomeAssistant | undefined,
    entities: string[],
    daysAhead: number,
  ): void {
    this._hass = hass;

    const listChanged = entities.join(",") !== this._entities.join(",");
    const windowChanged = daysAhead !== this._daysAhead;
    this._entities = entities;
    this._daysAhead = daysAhead;

    if (!entities.length) {
      this._events = [];
      this._clearTimers();
      return;
    }

    // Home Assistant replaces a calendar entity's state object when an event
    // starts or ends, which is the cheapest signal that the agenda moved.
    const stamp = entities
      .map((id) => hass?.states[id]?.last_updated ?? "")
      .join("|");
    const statesChanged = stamp !== this._stateStamp;
    this._stateStamp = stamp;

    if (this._connected && (listChanged || windowChanged || statesChanged)) {
      void this._load();
      this._schedule();
    }
  }

  private _clearTimers(): void {
    if (this._timer !== undefined) clearInterval(this._timer);
    if (this._midnightTimer !== undefined) clearTimeout(this._midnightTimer);
    this._timer = undefined;
    this._midnightTimer = undefined;
  }

  private _schedule(): void {
    this._clearTimers();
    if (!this._connected || document.visibilityState === "hidden") return;
    this._timer = window.setInterval(() => void this._load(), REFRESH_INTERVAL);
    this._midnightTimer = window.setTimeout(() => {
      void this._load();
      this._schedule();
    }, msUntilMidnight() + 1000);
  }

  private async _load(): Promise<void> {
    const hass = this._hass;
    const entities = this._entities;
    if (!hass?.callApi || !entities.length) return;

    const generation = ++this._generation;
    this._loading = true;

    const start = new Date();
    const end = new Date(start.getTime() + this._daysAhead * 86_400_000);
    const query = `?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;

    const results = await Promise.all(
      entities.map(async (id) => {
        try {
          const raw = await hass.callApi<RawCalendarEvent[]>(
            "GET",
            `calendars/${id}${query}`,
          );
          return { id, events: normalize(raw, id), failed: false };
        } catch {
          // One broken calendar must not blank the whole list.
          return { id, events: [] as CalendarEvent[], failed: true };
        }
      }),
    );

    if (generation !== this._generation) return;

    const failed = results.filter((r) => r.failed).map((r) => r.id);
    this._events = results
      .flatMap((r) => r.events)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    this._error = failed.length ? failed.join(", ") : undefined;
    this._loading = false;
    this.host.requestUpdate();
  }
}
