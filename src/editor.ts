import { defineOnce } from "./utils/define";
import { LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { EDITOR_TAG } from "./const";
import {
  CALENDAR_COUNT_MAX,
  CALENDAR_DAYS_MAX,
  DEFAULTS,
  FORECAST_DAYS_MAX,
  FORECAST_HOURS_MAX,
} from "./data/defaults";
import type { HomeAssistant, UserCardConfig } from "./types";

interface FormSchema {
  name: string;
  type?: string;
  title?: string;
  required?: boolean;
  /**
   * Without this, ha-form reads and writes the section's fields under
   * `data[name]`:
   *   getValue = (obj, item) => !item.name || item.flatten ? obj : obj[item.name]
   * A grouped editor over a flat config therefore needs flatten on every
   * expandable, or none of the grouped options bind to anything.
   */
  flatten?: boolean;
  selector?: Record<string, unknown>;
  schema?: FormSchema[];
}

const section = (
  name: string,
  title: string,
  schema: FormSchema[],
): FormSchema => ({ name, type: "expandable", title, flatten: true, schema });

const boolean = (name: string): FormSchema => ({
  name,
  selector: { boolean: {} },
});

/**
 * The YAML stays flat, as configured. Grouping lives in the editor via
 * `expandable` sections, so neither side pays for the other: thirty flat keys
 * are fine in a file and unusable in a single form.
 */
const SCHEMA: FormSchema[] = [
  {
    name: "weather_entity",
    required: true,
    selector: { entity: { domain: "weather" } },
  },
  section("clock", "Clock & date", [
    {
      name: "time_format",
      selector: {
        select: {
          mode: "dropdown",
          options: [
            { value: "auto", label: "Follow Home Assistant" },
            { value: "24h", label: "24 hours" },
            { value: "12h", label: "12 hours" },
          ],
        },
      },
    },
    boolean("show_seconds"),
    boolean("show_date"),
    boolean("show_year"),
    { name: "date_locale", selector: { text: {} } },
  ]),
  section("current", "Current weather", [
    boolean("show_current_weather"),
    boolean("show_location"),
    { name: "location_name", selector: { text: {} } },
    {
      name: "weather_tap_action",
      selector: {
        ui_action: {
          actions: [
            "more-info",
            "navigate",
            "url",
            "toggle",
            "perform-action",
            "none",
          ],
        },
      },
    },
    boolean("show_feels_like"),
    boolean("show_humidity"),
    boolean("show_wind"),
  ]),
  section("forecast", "Forecast", [
    boolean("show_hourly_forecast"),
    {
      name: "forecast_hours",
      selector: {
        number: { min: 1, max: FORECAST_HOURS_MAX, mode: "slider", step: 1 },
      },
    },
    boolean("hourly_scroll"),
    boolean("show_daily_forecast"),
    {
      name: "forecast_days",
      selector: {
        number: { min: 1, max: FORECAST_DAYS_MAX, mode: "slider", step: 1 },
      },
    },
    boolean("show_precipitation_probability"),
    boolean("show_precipitation_amount"),
    boolean("night_icons_hourly"),
    boolean("show_hourly_extremes"),
    {
      name: "forecast_ratio",
      selector: {
        number: { min: 0.5, max: 4, step: 0.1, mode: "slider" },
      },
    },
  ]),
  section("calendar", "Calendar", [
    boolean("show_calendar"),
    {
      name: "calendar_entities",
      selector: { entity: { domain: "calendar", multiple: true } },
    },
    {
      name: "calendar_count",
      selector: {
        number: { min: 1, max: CALENDAR_COUNT_MAX, mode: "slider", step: 1 },
      },
    },
    {
      name: "calendar_days_ahead",
      selector: {
        number: { min: 1, max: CALENDAR_DAYS_MAX, mode: "box", step: 1 },
      },
    },
  ]),
  section("appearance", "Appearance", [
    {
      name: "temperature_color_mode",
      selector: {
        select: {
          mode: "dropdown",
          options: [
            { value: "static", label: "One fixed colour" },
            { value: "dynamic", label: "Colour follows the temperature" },
          ],
        },
      },
    },
    {
      name: "temperature_color_min",
      selector: { number: { mode: "box", step: 1 } },
    },
    {
      name: "temperature_color_max",
      selector: { number: { mode: "box", step: 1 } },
    },
    boolean("compact_mode"),
    boolean("glass_effect"),
    boolean("animation"),
    { name: "accent_color", selector: { text: {} } },
    { name: "temperature_color", selector: { text: {} } },
    { name: "precipitation_color", selector: { text: {} } },
    { name: "card_background", selector: { text: {} } },
    { name: "border_radius", selector: { text: {} } },
    { name: "card_padding", selector: { text: {} } },
    { name: "icon_size", selector: { text: {} } },
    { name: "clock_size", selector: { text: {} } },
    {
      name: "clock_weight",
      selector: {
        select: {
          mode: "dropdown",
          // custom_value keeps every other CSS weight reachable without
          // listing nine of them.
          custom_value: true,
          options: [
            { value: "200", label: "Extra light" },
            { value: "300", label: "Light (default)" },
            { value: "400", label: "Regular" },
            { value: "500", label: "Medium" },
            { value: "600", label: "Semibold" },
            { value: "700", label: "Bold" },
          ],
        },
      },
    },
    { name: "temperature_size", selector: { text: {} } },
    { name: "current_icon_size", selector: { text: {} } },
  ]),
];

const LABELS: Record<string, string> = {
  weather_entity: "Weather entity (required)",
  time_format: "Time format",
  show_seconds: "Show seconds",
  show_date: "Show date",
  show_year: "Show year",
  date_locale: "Locale (empty = Home Assistant language)",
  show_current_weather: "Show current weather",
  show_location: "Show location",
  location_name: "Location label (empty = entity name)",
  weather_tap_action: "Tap on the current weather",
  show_feels_like: "Show apparent temperature",
  show_humidity: "Show humidity",
  show_wind: "Show wind",
  show_hourly_forecast: "Show hourly forecast",
  forecast_hours: "Hours",
  hourly_scroll: "Scroll hours horizontally",
  show_daily_forecast: "Show daily forecast",
  forecast_days: "Days",
  show_precipitation_probability: "Show precipitation probability",
  show_precipitation_amount: "Show precipitation amount",
  night_icons_hourly: "Night icons in the hourly forecast",
  show_hourly_extremes: "Mark the warmest and coldest hour",
  forecast_ratio: "Height of hours vs days (1.5 = 3:2)",
  show_calendar: "Show calendar",
  calendar_entities: "Calendars",
  calendar_count: "Events shown",
  calendar_days_ahead: "Look ahead (days)",
  calendar_tap_action: "Tap on an appointment",
  compact_mode: "Compact mode",
  glass_effect: "Glass effect (needs a view background image)",
  animation: "Animate weather icons",
  temperature_color_mode: "Temperature colour",
  temperature_color_min: "Coldest colour at (empty = -5 °C / 23 °F)",
  temperature_color_max: "Warmest colour at (empty = 35 °C / 95 °F)",
  accent_color: "Accent colour",
  temperature_color: "Fixed temperature colour (static mode only)",
  precipitation_color: "Precipitation colour",
  card_background: "Card background",
  border_radius: "Corner radius (e.g. 18px)",
  card_padding: "Padding (e.g. 20px)",
  icon_size: "Icon size (e.g. 44px)",
  clock_size: "Clock size (e.g. 5rem)",
  clock_weight: "Clock weight",
  temperature_size: "Temperature size (e.g. 2.8rem)",
  current_icon_size: "Current weather icon size (e.g. 72px)",
};

/**
 * The form is seeded with every default so no control appears empty for an
 * option that is in fact active -- but writing all of them back would turn a
 * two-line card into twenty-five lines of YAML on the first click.
 */
function pruneDefaults(value: UserCardConfig): UserCardConfig {
  const defaults = DEFAULTS as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "type" || key === "weather_entity") {
      out[key] = entry;
      continue;
    }
    if (entry === undefined || entry === null || entry === "") continue;
    if (key in defaults && defaults[key] === entry) continue;
    out[key] = entry;
  }
  return out as UserCardConfig;
}

export class YetAnotherClockWeatherEditor extends LitElement {
  @state() private _config?: UserCardConfig;
  /** Lovelace assigns hass AFTER setConfig. As a plain field that assignment
   *  would not schedule a render and the form would stay blank. */
  @property({ attribute: false }) public hass?: HomeAssistant;

  public setConfig(config: UserCardConfig): void {
    this._config = config;
  }

  private readonly _computeLabel = (schema: FormSchema): string =>
    LABELS[schema.name] ?? schema.title ?? schema.name;

  private _valueChanged(event: CustomEvent): void {
    event.stopPropagation();
    const value = (event.detail as { value: UserCardConfig }).value;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        bubbles: true,
        composed: true,
        detail: { config: pruneDefaults(value) },
      }),
    );
  }

  protected override render() {
    if (!this._config || !this.hass) return nothing;
    // Defaults are shown as current values so the form never presents an empty
    // control for an option that is in fact active.
    const data = { ...DEFAULTS, ...this._config };
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${SCHEMA}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  static override styles = css`
    ha-form {
      display: block;
    }
  `;
}

defineOnce(EDITOR_TAG, YetAnotherClockWeatherEditor);

declare global {
  interface HTMLElementTagNameMap {
    "yet-another-clock-weather-card-editor": YetAnotherClockWeatherEditor;
  }
}
