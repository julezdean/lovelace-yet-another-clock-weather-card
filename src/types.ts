import type { Connection, HassEntityBase } from "home-assistant-js-websocket";
import type { ActionConfig } from "./utils/actions";

/* -------------------------------------------------------------------------- */
/* Home Assistant                                                              */
/* -------------------------------------------------------------------------- */

/** Mirrors frontend/src/data/translation.ts */
export type TimeFormatSetting = "language" | "system" | "12" | "24";

export interface FrontendLocaleData {
  language: string;
  number_format: string;
  time_format: TimeFormatSetting;
  date_format: string;
  first_weekday: string;
  time_zone: "local" | "server";
}

/**
 * Only the parts of `hass` this card touches. Hand-written on purpose:
 * `custom-card-helpers` lags the weather API and would type some of this wrong.
 */
export interface HomeAssistant {
  states: Record<string, HassEntityBase>;
  connection: Connection;
  locale: FrontendLocaleData;
  config: { time_zone: string };
  themes: { darkMode: boolean };
  language: string;
  localize: (key: string, ...args: unknown[]) => string;
  formatEntityState?: (stateObj: HassEntityBase, state?: string) => string;
  /** Calendars have no websocket subscription; events come over REST. */
  callApi: <T>(method: string, path: string) => Promise<T>;
  callService?: (
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: Record<string, unknown>,
  ) => Promise<unknown>;
}

/** An event exactly as /api/calendars/<entity_id> returns it. */
export interface RawCalendarEvent {
  summary?: string;
  description?: string;
  location?: string;
  uid?: string;
  recurrence_id?: string;
  /** All-day events carry { date }, timed events { dateTime }. */
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

export interface CalendarEvent {
  summary: string;
  start: Date;
  end?: Date;
  allDay: boolean;
  location?: string;
  calendar: string;
}

/** frontend/src/data/weather.ts -- verified against dev */
export enum WeatherEntityFeature {
  FORECAST_DAILY = 1,
  FORECAST_HOURLY = 2,
  FORECAST_TWICE_DAILY = 4,
}

export type ForecastType = "daily" | "hourly" | "twice_daily";

export interface WeatherEntityAttributes {
  friendly_name?: string;
  attribution?: string;
  supported_features?: number;
  temperature?: number;
  temperature_unit?: string;
  apparent_temperature?: number;
  dew_point?: number;
  humidity?: number;
  cloud_coverage?: number;
  uv_index?: number;
  pressure?: number;
  pressure_unit?: string;
  wind_bearing?: number | string;
  wind_speed?: number;
  wind_gust_speed?: number;
  wind_speed_unit?: string;
  visibility?: number;
  visibility_unit?: string;
  precipitation_unit?: string;
}

export interface WeatherEntity extends HassEntityBase {
  attributes: WeatherEntityAttributes;
}

/**
 * A forecast entry as it arrives over the websocket.
 *
 * Every field except `datetime` is optional, and the types are deliberately
 * loose: core types `wind_speed` as a float while the frontend types it as a
 * string, and integrations are free to omit anything. Nothing downstream may
 * assume a value is present or of a given type -- see normalizeForecast().
 */
export interface RawForecast {
  datetime: string;
  condition?: string | null;
  temperature?: number | null;
  templow?: number | null;
  apparent_temperature?: number | null;
  precipitation?: number | null;
  precipitation_probability?: number | null;
  humidity?: number | null;
  wind_speed?: number | string | null;
  wind_gust_speed?: number | null;
  wind_bearing?: number | string | null;
  cloud_coverage?: number | null;
  uv_index?: number | null;
  pressure?: number | null;
  is_daytime?: boolean | null;
}

/** `forecast` is nullable: the entity can be alive while its service is down. */
export interface ForecastEvent {
  type: ForecastType;
  forecast: RawForecast[] | null;
}

/** A forecast entry after normalization: numbers are numbers or undefined. */
export interface Forecast {
  date: Date;
  condition?: string;
  temperature?: number;
  templow?: number;
  apparentTemperature?: number;
  precipitation?: number;
  precipitationProbability?: number;
  humidity?: number;
  windSpeed?: number;
  isDaytime?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Lovelace                                                                    */
/* -------------------------------------------------------------------------- */

export interface LovelaceGridOptions {
  columns?: number | "full";
  rows?: number | "auto";
  min_columns?: number;
  max_columns?: number;
  min_rows?: number;
  max_rows?: number;
}

export interface LovelaceCardConfig {
  type: string;
  [key: string]: unknown;
}

export type { ActionConfig };

/* -------------------------------------------------------------------------- */
/* Card configuration                                                          */
/* -------------------------------------------------------------------------- */

export interface CardConfig {
  type: string;
  weather_entity: string;

  /* Clock */
  time_format: "auto" | "12h" | "24h";
  show_seconds: boolean;
  show_date: boolean;
  show_year: boolean;
  date_locale: string | "auto";

  /* Current weather */
  show_current_weather: boolean;
  show_location: boolean;
  location_name?: string;
  weather_tap_action: ActionConfig;
  show_feels_like: boolean;
  show_humidity: boolean;
  show_wind: boolean;

  /* Forecast */
  show_hourly_forecast: boolean;
  show_daily_forecast: boolean;
  forecast_hours: number;
  forecast_days: number;
  show_precipitation_probability: boolean;
  show_precipitation_amount: boolean;
  hourly_scroll: boolean;
  night_icons_hourly: boolean;
  show_hourly_extremes: boolean;
  /** Height of the hourly block relative to the daily one. */
  forecast_ratio: number;

  /* Calendar */
  show_calendar: boolean;
  calendar_entities: string[];
  calendar_count: number;
  calendar_days_ahead: number;
  calendar_tap_action: ActionConfig;

  /* Temperature colour scale */
  temperature_color_mode: "static" | "dynamic";
  temperature_color_min?: number;
  temperature_color_max?: number;

  /* Appearance */
  compact_mode: boolean;
  glass_effect: boolean;
  animation: boolean;
  primary_color?: string;
  accent_color?: string;
  temperature_color?: string;
  precipitation_color?: string;
  card_background?: string;
  border_radius?: string;
  card_padding?: string;
  icon_size?: string;
  clock_size?: string;
  clock_weight?: string;
  temperature_size?: string;
  current_icon_size?: string;
}

export type UserCardConfig = Partial<CardConfig> & { type: string };
