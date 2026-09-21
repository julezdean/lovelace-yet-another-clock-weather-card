import { dayKey } from "../utils/datetime";
import type {
  Forecast,
  ForecastType,
  HomeAssistant,
  RawForecast,
  WeatherEntity,
} from "../types";
import { WeatherEntityFeature } from "../types";

export const UNAVAILABLE_STATES = new Set(["unavailable", "unknown"]);

/** Conditions Home Assistant can report. Anything else falls back to "exceptional". */
export const WEATHER_CONDITIONS = [
  "clear-night",
  "cloudy",
  "exceptional",
  "fog",
  "hail",
  "lightning",
  "lightning-rainy",
  "partlycloudy",
  "pouring",
  "rainy",
  "snowy",
  "snowy-rainy",
  "sunny",
  "windy",
  "windy-variant",
] as const;

export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

const CONDITION_SET = new Set<string>(WEATHER_CONDITIONS);

export function asCondition(value: string | undefined | null): WeatherCondition {
  return value && CONDITION_SET.has(value)
    ? (value as WeatherCondition)
    : "exceptional";
}

/* -------------------------------------------------------------------------- */
/* Entity state                                                                */
/* -------------------------------------------------------------------------- */

export function getWeatherEntity(
  hass: HomeAssistant | undefined,
  entityId: string | undefined,
): WeatherEntity | undefined {
  if (!hass || !entityId) return undefined;
  return hass.states[entityId] as WeatherEntity | undefined;
}

export function isUsable(entity: WeatherEntity | undefined): boolean {
  return !!entity && !UNAVAILABLE_STATES.has(entity.state);
}

export function supportsForecast(
  entity: WeatherEntity | undefined,
  type: ForecastType,
): boolean {
  const features = entity?.attributes?.supported_features ?? 0;
  const flag =
    type === "daily"
      ? WeatherEntityFeature.FORECAST_DAILY
      : type === "hourly"
        ? WeatherEntityFeature.FORECAST_HOURLY
        : WeatherEntityFeature.FORECAST_TWICE_DAILY;
  return (features & flag) !== 0;
}

/**
 * Which forecast type to use for the "next days" row. Entities that only speak
 * twice_daily (a handful of integrations do) would otherwise show nothing, so
 * their entries get folded into whole days further down.
 */
export function dailyForecastType(
  entity: WeatherEntity | undefined,
): ForecastType | undefined {
  if (supportsForecast(entity, "daily")) return "daily";
  if (supportsForecast(entity, "twice_daily")) return "twice_daily";
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Normalization                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Integrations omit fields freely, and core and frontend disagree on some types
 * (`wind_speed` is a float in core, a string in the frontend's interface). One
 * coercion here keeps every template free of null checks and NaN.
 */
function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeForecast(
  raw: RawForecast[] | null | undefined,
): Forecast[] {
  if (!Array.isArray(raw)) return [];
  const out: Forecast[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry.datetime !== "string") continue;
    const date = new Date(entry.datetime);
    if (Number.isNaN(date.getTime())) continue;
    out.push({
      date,
      condition: entry.condition ?? undefined,
      temperature: num(entry.temperature),
      templow: num(entry.templow),
      apparentTemperature: num(entry.apparent_temperature),
      precipitation: num(entry.precipitation),
      precipitationProbability: num(entry.precipitation_probability),
      humidity: num(entry.humidity),
      windSpeed: num(entry.wind_speed),
      isDaytime:
        typeof entry.is_daytime === "boolean" ? entry.is_daytime : undefined,
    });
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime());
  return out;
}

/** Drops hours already gone -- integrations often include the current hour. */
export function dropPastHours(items: Forecast[], now = Date.now()): Forecast[] {
  const cutoff = now - 30 * 60 * 1000;
  return items.filter((i) => i.date.getTime() >= cutoff);
}

/**
 * Drops days already gone.
 *
 * Deliberately NOT the hourly cutoff. A daily entry is timestamped at some hour
 * of the day it describes, and plenty of integrations use 00:00 -- so "now minus
 * 30 minutes" throws today away from 00:30 onwards, and a seven-day forecast
 * silently becomes six. Today counts until midnight regardless of the hour its
 * timestamp carries.
 *
 * The comparison runs in the display time zone, because Home Assistant lets the
 * frontend be pinned to the server's zone, where "today" can differ from the
 * browser's.
 */
export function dropPastDays(
  items: Forecast[],
  timeZone?: string,
  now: Date = new Date(),
): Forecast[] {
  const today = dayKey(now, timeZone);
  return items.filter((item) => dayKey(item.date, timeZone) >= today);
}

/**
 * Folds twice_daily entries into one per calendar day: the daytime entry carries
 * the high and the condition, the night entry the low.
 */
export function foldTwiceDaily(items: Forecast[]): Forecast[] {
  const byDay = new Map<string, Forecast>();
  for (const item of items) {
    const key = `${item.date.getFullYear()}-${item.date.getMonth()}-${item.date.getDate()}`;
    const existing = byDay.get(key);
    if (!existing) {
      byDay.set(key, { ...item });
      continue;
    }
    const day = item.isDaytime === true ? item : existing;
    const night = item.isDaytime === true ? existing : item;
    byDay.set(key, {
      ...existing,
      date: day.date,
      condition: day.condition ?? existing.condition,
      temperature: day.temperature ?? existing.temperature,
      templow: night.templow ?? night.temperature ?? existing.templow,
      precipitationProbability:
        Math.max(
          day.precipitationProbability ?? 0,
          night.precipitationProbability ?? 0,
        ) || undefined,
      precipitation:
        (day.precipitation ?? 0) + (night.precipitation ?? 0) || undefined,
    });
  }
  return [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/* -------------------------------------------------------------------------- */
/* Day / night                                                                 */
/* -------------------------------------------------------------------------- */

const DAY_MS = 86_400_000;

/**
 * Home Assistant's own weather card treats a missing `is_daytime` as daytime,
 * which makes an hourly `sunny` entry at 23:00 show a sun. `is_daytime` is only
 * set on twice_daily forecasts, so that is every hourly entry.
 *
 * sun.sun only reports the *next* dawn and dusk, so the time of day is taken
 * from those and applied to every forecast timestamp. Good to a few minutes
 * across a 48-hour window -- ample for choosing between a sun and a moon.
 */
export class DayNight {
  private readonly dawnMinutes?: number;
  private readonly duskMinutes?: number;

  constructor(
    hass: HomeAssistant | undefined,
    private readonly timeZone?: string,
  ) {
    const sun = hass?.states?.["sun.sun"];
    const attrs = sun?.attributes as Record<string, unknown> | undefined;
    this.dawnMinutes = this.minutesOfDay(attrs?.next_dawn ?? attrs?.next_rising);
    this.duskMinutes = this.minutesOfDay(attrs?.next_dusk ?? attrs?.next_setting);
  }

  private minutesOfDay(value: unknown): number | undefined {
    if (typeof value !== "string") return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: this.timeZone,
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return undefined;
    return hour * 60 + minute;
  }

  /** Whether the card knows enough to answer at all. */
  get available(): boolean {
    return (
      this.dawnMinutes !== undefined &&
      this.duskMinutes !== undefined &&
      this.dawnMinutes < this.duskMinutes
    );
  }

  isNight(date: Date): boolean {
    if (!this.available) return false;
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: this.timeZone,
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
    const minutes = hour * 60 + minute;
    return minutes < this.dawnMinutes! || minutes >= this.duskMinutes!;
  }
}

export { DAY_MS };
