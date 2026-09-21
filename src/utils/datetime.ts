import type { CardConfig, HomeAssistant } from "../types";

/**
 * Intl.DateTimeFormat construction is expensive and the clock re-renders every
 * second, so formatters are cached by their full option set.
 */
const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    cache.set(key, f);
  }
  return f;
}

export function resolveLocale(config: CardConfig, hass: HomeAssistant): string {
  if (config.date_locale && config.date_locale !== "auto") {
    // A bad locale string would make every Intl call throw and kill the card.
    try {
      new Intl.DateTimeFormat(config.date_locale);
      return config.date_locale;
    } catch {
      /* fall through to the Home Assistant language */
    }
  }
  return hass.locale?.language || hass.language || "en";
}

/**
 * Home Assistant lets the user pin the frontend to the server's time zone.
 * Formatting in browser-local time would then show the wrong hour, so the
 * setting has to be honoured rather than assumed.
 */
export function resolveTimeZone(hass: HomeAssistant): string | undefined {
  return hass.locale?.time_zone === "server" ? hass.config?.time_zone : undefined;
}

/**
 * `auto` inherits the user's Home Assistant setting. "language" and "system"
 * mean "whatever the locale does" -- which is resolved here rather than left
 * unset.
 *
 * Leaving it unset is not neutral: `{hour:"numeric"}` alone renders "10 Uhr" in
 * German, which is both wider than "10:00" and inconsistent with the clock.
 * Asking the locale for its hour cycle lets the hour axis always carry minutes
 * where minutes are the convention.
 */
export function resolveHour12(
  config: CardConfig,
  hass: HomeAssistant,
  locale: string,
): boolean {
  if (config.time_format === "12h") return true;
  if (config.time_format === "24h") return false;
  const setting = hass.locale?.time_format;
  if (setting === "12") return true;
  if (setting === "24") return false;
  try {
    const cycle = new Intl.DateTimeFormat(locale, {
      hour: "numeric",
    }).resolvedOptions().hourCycle;
    return cycle === "h11" || cycle === "h12";
  } catch {
    return false;
  }
}

export interface FormatContext {
  locale: string;
  timeZone: string | undefined;
  hour12: boolean | undefined;
}

export function formatContext(
  config: CardConfig,
  hass: HomeAssistant,
): FormatContext {
  const locale = resolveLocale(config, hass);
  return {
    locale,
    timeZone: resolveTimeZone(hass),
    hour12: resolveHour12(config, hass, locale),
  };
}

export function formatClock(
  date: Date,
  ctx: FormatContext,
  withSeconds: boolean,
): string {
  return formatter(ctx.locale, {
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hour12: ctx.hour12,
    timeZone: ctx.timeZone,
  }).format(date);
}

export function formatFullDate(
  date: Date,
  ctx: FormatContext,
  withYear: boolean,
): string {
  return formatter(ctx.locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: ctx.timeZone,
  }).format(date);
}

/**
 * Hour-axis label: "14:00" on a 24-hour locale, "2 PM" on a 12-hour one.
 *
 * `compact` drops the minutes, which are always "00" anyway. At 24 unscrolled
 * hours a column is about 29px wide and the full labels run into each other --
 * "14" still says everything "14:00" did.
 */
export function formatHour(
  date: Date,
  ctx: FormatContext,
  compact = false,
): string {
  if (compact && !ctx.hour12) {
    // No Intl option yields a bare hour: German appends " Uhr" and French
    // " h" to every variant of {hour}, which is WIDER than "14:00" and made
    // the dense axis worse rather than better. Measured across de/fr/en/nl --
    // so the hour part is taken out of formatToParts instead.
    const parts = formatter(ctx.locale, {
      hour: "2-digit",
      hour12: false,
      timeZone: ctx.timeZone,
    }).formatToParts(date);
    const hour = parts.find((part) => part.type === "hour")?.value;
    if (hour) return hour;
  }
  return formatter(ctx.locale, {
    hour: "numeric",
    ...(ctx.hour12 ? {} : { minute: "2-digit" }),
    hour12: ctx.hour12,
    timeZone: ctx.timeZone,
  }).format(date);
}

export function formatWeekdayShort(date: Date, ctx: FormatContext): string {
  return formatter(ctx.locale, {
    weekday: "short",
    timeZone: ctx.timeZone,
  }).format(date);
}

export function formatDateTimeLong(date: Date, ctx: FormatContext): string {
  return formatter(ctx.locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: ctx.hour12,
    timeZone: ctx.timeZone,
  }).format(date);
}

/** Milliseconds until the next whole second or minute, whichever the clock needs. */
export function msUntilNextTick(now: Date, withSeconds: boolean): number {
  if (withSeconds) return 1000 - now.getMilliseconds();
  return (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
}

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Sortable YYYY-MM-DD in the given time zone.
 *
 * Comparing calendar days needs the display zone, not the browser's: Home
 * Assistant lets the frontend be pinned to the server's zone, where "today" can
 * be a different date.
 */
export function dayKey(date: Date, timeZone: string | undefined): string {
  const cacheKey = timeZone ?? "";
  let formatter = dayKeyFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone,
    });
    dayKeyFormatters.set(cacheKey, formatter);
  }
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Milliseconds until the next local midnight, for day-rollover refreshes. */
export function msUntilMidnight(now = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

export function formatEventTime(date: Date, ctx: FormatContext): string {
  return formatter(ctx.locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: ctx.hour12,
    timeZone: ctx.timeZone,
  }).format(date);
}
