import type { CardConfig, UserCardConfig } from "../types";

/**
 * Sensible defaults for every option, so a card only needs `weather_entity`.
 * Appearance keys are intentionally absent: undefined means "inherit the Home
 * Assistant theme", which is not the same as any concrete colour.
 */
export const DEFAULTS: Omit<CardConfig, "type" | "weather_entity"> = {
  time_format: "auto",
  show_seconds: false,
  show_date: true,
  show_year: false,
  date_locale: "auto",

  show_current_weather: true,
  show_location: true,
  // Preserves what the card already did when it had no action config at all.
  weather_tap_action: { action: "more-info" },
  show_feels_like: false,
  show_humidity: false,
  show_wind: false,

  show_hourly_forecast: true,
  show_daily_forecast: true,
  forecast_hours: 12,
  forecast_days: 5,
  show_precipitation_probability: true,
  show_precipitation_amount: false,
  hourly_scroll: true,
  night_icons_hourly: true,
  show_hourly_extremes: true,
  // 3:2. The hourly curve shows a SHAPE and shape needs vertical resolution;
  // the daily bars show an EXTENT, which reads fine on less.
  forecast_ratio: 1.5,

  // Domain bounds stay undefined so they can follow the entity's unit: a
  // 0-35 range is nonsense once the entity reports Fahrenheit.
  temperature_color_mode: "static",

  show_calendar: false,
  calendar_entities: [],
  calendar_count: 3,
  calendar_days_ahead: 14,
  // The calendar panel is what people reach for; more-info on a calendar
  // entity only says whether an event is running.
  calendar_tap_action: { action: "navigate", navigation_path: "/calendar" },

  compact_mode: false,
  glass_effect: false,
  animation: true,
};

export const FORECAST_HOURS_MIN = 1;
export const FORECAST_HOURS_MAX = 48;
export const FORECAST_DAYS_MIN = 1;
export const FORECAST_DAYS_MAX = 10;
export const FORECAST_RATIO_MIN = 0.5;
export const FORECAST_RATIO_MAX = 4;
export const CALENDAR_COUNT_MAX = 10;
export const CALENDAR_DAYS_MAX = 60;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)));

export class ConfigError extends Error {}

const ACTIONS = new Set([
  "more-info",
  "navigate",
  "url",
  "toggle",
  "perform-action",
  "call-service",
  "fire-dom-event",
  "none",
]);

/** An unknown action would fail silently on click; say so at configuration time. */
function checkAction(value: unknown, key: string): void {
  if (value === undefined) return;
  if (typeof value !== "object" || value === null) {
    throw new ConfigError(`"${key}" must be an action object.`);
  }
  const action = (value as { action?: unknown }).action;
  if (typeof action !== "string" || !ACTIONS.has(action)) {
    throw new ConfigError(
      `"${key}.action" must be one of: ${[...ACTIONS].join(", ")}.` +
        (action === "assist" || action === undefined
          ? " (assist and confirmation are not available to custom cards.)"
          : ""),
    );
  }
}

/**
 * Validates and fills a user config. Throws ConfigError for mistakes the user
 * can fix; silently clamps values that are merely out of range, because a card
 * that refuses to render over `forecast_days: 99` helps nobody.
 */
export function normalizeConfig(config: UserCardConfig | undefined): CardConfig {
  if (!config || typeof config !== "object") {
    throw new ConfigError("Invalid configuration.");
  }
  if (typeof config.weather_entity !== "string" || !config.weather_entity) {
    throw new ConfigError('You need to define a "weather_entity".');
  }
  if (!config.weather_entity.startsWith("weather.")) {
    throw new ConfigError(
      `"${config.weather_entity}" is not a weather entity. It must start with "weather.".`,
    );
  }

  const merged = { ...DEFAULTS, ...config } as CardConfig;

  merged.forecast_hours = clamp(
    Number(merged.forecast_hours) || DEFAULTS.forecast_hours,
    FORECAST_HOURS_MIN,
    FORECAST_HOURS_MAX,
  );
  merged.forecast_days = clamp(
    Number(merged.forecast_days) || DEFAULTS.forecast_days,
    FORECAST_DAYS_MIN,
    FORECAST_DAYS_MAX,
  );

  const ratio = Number(merged.forecast_ratio);
  merged.forecast_ratio = Number.isFinite(ratio)
    ? Math.min(FORECAST_RATIO_MAX, Math.max(FORECAST_RATIO_MIN, ratio))
    : DEFAULTS.forecast_ratio;

  if (!["auto", "12h", "24h"].includes(merged.time_format)) {
    merged.time_format = DEFAULTS.time_format;
  }
  // A single entity id is the common case; accept it without a list.
  const calendars = (config as { calendar_entities?: unknown }).calendar_entities;
  merged.calendar_entities = Array.isArray(calendars)
    ? calendars.filter((id): id is string => typeof id === "string")
    : typeof calendars === "string" && calendars
      ? [calendars]
      : [];
  const badCalendar = merged.calendar_entities.find(
    (id) => !id.startsWith("calendar."),
  );
  if (badCalendar) {
    throw new ConfigError(
      `"${badCalendar}" is not a calendar entity. It must start with "calendar.".`,
    );
  }
  merged.calendar_count = clamp(
    Number(merged.calendar_count) || DEFAULTS.calendar_count,
    1,
    CALENDAR_COUNT_MAX,
  );
  merged.calendar_days_ahead = clamp(
    Number(merged.calendar_days_ahead) || DEFAULTS.calendar_days_ahead,
    1,
    CALENDAR_DAYS_MAX,
  );

  checkAction(config.weather_tap_action, "weather_tap_action");
  checkAction(config.calendar_tap_action, "calendar_tap_action");

  if (!["static", "dynamic"].includes(merged.temperature_color_mode)) {
    merged.temperature_color_mode = DEFAULTS.temperature_color_mode;
  }
  for (const key of ["temperature_color_min", "temperature_color_max"] as const) {
    const value = Number(merged[key]);
    merged[key] = Number.isFinite(value) ? value : undefined;
  }
  if (
    merged.temperature_color_min !== undefined &&
    merged.temperature_color_max !== undefined &&
    merged.temperature_color_min >= merged.temperature_color_max
  ) {
    throw new ConfigError(
      '"temperature_color_min" must be lower than "temperature_color_max".',
    );
  }

  return merged;
}
