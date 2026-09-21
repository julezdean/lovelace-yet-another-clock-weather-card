import { defineOnce } from "./utils/define";
import { LitElement, css, html, nothing } from "lit";
import { state } from "lit/decorators.js";
import "./components/calendar";
import "./components/clock";
import "./components/current-weather";
import "./components/daily-forecast";
import "./components/hourly-forecast";
import { CalendarController } from "./data/calendar-controller";
import { ForecastController } from "./data/forecast-controller";
import { ConfigError, normalizeConfig } from "./data/defaults";
import {
  DayNight,
  dailyForecastType,
  dropPastDays,
  dropPastHours,
  foldTwiceDaily,
  getWeatherEntity,
  isUsable,
  normalizeForecast,
  supportsForecast,
} from "./data/weather";
import { handleAction, hasAction } from "./utils/actions";
import { shared, tokens } from "./styles/tokens";
import {
  RAMP_DARK,
  RAMP_LIGHT,
  defaultDomain,
  type RampStop,
} from "./utils/temperature-scale";
import { formatContext } from "./utils/datetime";
import { labelsFor, translator } from "./utils/localize";
import {
  BREAKPOINT_MEDIUM,
  BREAKPOINT_WIDE,
  CARD_MIN_HEIGHT,
  CARD_TAG,
  EDITOR_TAG,
} from "./const";
import type {
  CardConfig,
  Forecast,
  HomeAssistant,
  LovelaceGridOptions,
  UserCardConfig,
  WeatherEntity,
} from "./types";

export class YetAnotherClockWeatherCard extends LitElement {
  @state() private _config?: CardConfig;
  @state() private _configError?: string;
  /** Deliberately not @state: `hass` is replaced on every state change in the
   *  whole installation, and re-rendering on each of them is the single most
   *  common performance bug in custom cards. */
  private _hass?: HomeAssistant;

  private readonly _hourly = new ForecastController(this, "hourly");
  private readonly _daily = new ForecastController(this, "daily");
  private readonly _twiceDaily = new ForecastController(this, "twice_daily");
  private readonly _calendar = new CalendarController(this);

  public static async getConfigElement(): Promise<HTMLElement> {
    await import("./editor");
    return document.createElement(EDITOR_TAG);
  }

  public static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[],
  ): UserCardConfig {
    const pick = [...entities, ...entitiesFallback].find((id) =>
      id.startsWith("weather."),
    );
    return { type: `custom:${CARD_TAG}`, weather_entity: pick ?? "weather.home" };
  }

  public setConfig(config: UserCardConfig): void {
    try {
      this._config = normalizeConfig(config);
      this._configError = undefined;
    } catch (error) {
      this._config = undefined;
      this._configError =
        error instanceof ConfigError ? error.message : String(error);
      // Lovelace shows a broken-card placeholder for a throwing setConfig, which
      // is the right behaviour for a config the user has to fix.
      throw error;
    }
  }

  public set hass(hass: HomeAssistant) {
    const previous = this._hass;
    this._hass = hass;

    const entityId = this._config?.weather_entity;
    const entity = getWeatherEntity(hass, entityId);

    this._hourly.update(
      hass,
      this._config?.show_hourly_forecast && supportsForecast(entity, "hourly")
        ? entityId
        : undefined,
    );
    const dailyType = this._config?.show_daily_forecast
      ? dailyForecastType(entity)
      : undefined;
    this._daily.update(hass, dailyType === "daily" ? entityId : undefined);
    this._twiceDaily.update(
      hass,
      dailyType === "twice_daily" ? entityId : undefined,
    );
    // Must run before the early return below: on the very first hass the
    // controller would otherwise never learn which calendars to read.
    this._calendar.update(
      hass,
      this._config?.show_calendar ? (this._config.calendar_entities ?? []) : [],
      this._config?.calendar_days_ahead ?? 14,
    );

    if (!previous) {
      this.requestUpdate();
      return;
    }
    // Only the handful of things this card actually reads may trigger a render.
    const relevant =
      (entityId && previous.states[entityId] !== hass.states[entityId]) ||
      previous.states["sun.sun"] !== hass.states["sun.sun"] ||
      previous.locale !== hass.locale ||
      previous.themes?.darkMode !== hass.themes?.darkMode ||
      previous.language !== hass.language ||
      (this._config?.show_calendar === true &&
        this._config.calendar_entities.some(
          (id) => previous.states[id] !== hass.states[id],
        ));
    if (relevant) this.requestUpdate();
  }

  /**
   * Children announce an intent; the card runs it. That keeps `hass` -- which
   * is replaced on every state change in the installation -- out of the child
   * components entirely.
   */
  private _onAction(event: CustomEvent): void {
    const detail = event.detail as { target?: string; entity?: string };
    const config = this._config;
    const hass = this._hass;
    if (!config || !hass) return;
    const action =
      detail.target === "calendar"
        ? config.calendar_tap_action
        : config.weather_tap_action;
    handleAction(this, hass, action, detail.entity);
  }

  public getCardSize(): number {
    return 6;
  }

  public getGridOptions(): LovelaceGridOptions {
    // A Home Assistant section is capped at 500px wide, which is below this
    // card's wide layout. Asking for the full 12 columns and refusing to shrink
    // past 6 at least keeps it from being placed somewhere it cannot work.
    return { columns: 12, rows: "auto", min_columns: 6 };
  }

  /* ---------------------------------------------------------------------- */

  private get _entity(): WeatherEntity | undefined {
    return getWeatherEntity(this._hass, this._config?.weather_entity);
  }

  /**
   * The colour domain is absolute and configured, never derived from the
   * forecast: a scale normalised to today's data would paint the same
   * temperature blue in July and red in January.
   */
  private _colorScale(
    config: CardConfig,
    unit: string | undefined,
  ): { min: number; max: number; ramp: RampStop[] } | undefined {
    if (config.temperature_color_mode !== "dynamic") return undefined;
    const fallback = defaultDomain(unit);
    return {
      min: config.temperature_color_min ?? fallback.min,
      max: config.temperature_color_max ?? fallback.max,
      ramp: this._hass?.themes?.darkMode ? RAMP_DARK : RAMP_LIGHT,
    };
  }

  private _dailyItems(limit: number, timeZone: string | undefined): Forecast[] {
    const daily = normalizeForecast(this._daily.forecast);
    if (daily.length) return dropPastDays(daily, timeZone).slice(0, limit);
    // Entities that only speak twice_daily would otherwise show nothing here.
    const twice = normalizeForecast(this._twiceDaily.forecast);
    if (twice.length) {
      // Dropping by calendar day keeps BOTH halves of today, so folding
      // afterwards still finds the night entry that carries today's low.
      return foldTwiceDaily(dropPastDays(twice, timeZone)).slice(0, limit);
    }
    return [];
  }

  protected override willUpdate(): void {
    // Home Assistant's dark mode is a user setting independent of the OS, so
    // the token switch is keyed off hass rather than prefers-color-scheme.
    this.toggleAttribute("dark", !!this._hass?.themes?.darkMode);
  }

  protected override render() {
    const config = this._config;
    const hass = this._hass;
    const t = translator(hass?.language ?? config?.date_locale);

    if (this._configError) {
      return this._renderError(t("config_error"), this._configError);
    }
    if (!config || !hass) return nothing;

    const entity = this._entity;
    if (!entity) {
      return this._renderError(
        `${t("no_entity")}: ${config.weather_entity}`,
        t("no_entity_hint"),
      );
    }

    const ctx = formatContext(config, hass);
    const dayNight = new DayNight(hass, ctx.timeZone);
    const available = isUsable(entity);
    const conditionText =
      hass.formatEntityState?.(entity) ?? entity.state.replace(/-/g, " ");

    const hourlyItems = config.show_hourly_forecast
      ? dropPastHours(normalizeForecast(this._hourly.forecast)).slice(
          0,
          config.forecast_hours,
        )
      : [];
    const dailyItems = config.show_daily_forecast
      ? this._dailyItems(config.forecast_days, ctx.timeZone)
      : [];

    const colorScale = this._colorScale(config, entity.attributes.temperature_unit);

    const showHourly =
      config.show_hourly_forecast && supportsForecast(entity, "hourly");
    const showDaily =
      config.show_daily_forecast && dailyForecastType(entity) !== undefined;

    return html`
      <ha-card
        class=${[
          config.glass_effect ? "glass" : "",
          config.compact_mode ? "compact" : "",
          !showHourly || !showDaily ? "single-forecast" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style=${this._inlineStyle(config)}
        @yacw-action=${this._onAction}
      >
        <div class="layout">
          <div class="hero">
            <yacw-clock
              .locale=${ctx.locale}
              .timeZone=${ctx.timeZone}
              .hour12=${ctx.hour12}
              .showSeconds=${config.show_seconds}
              .showDate=${config.show_date}
              .showYear=${config.show_year}
            ></yacw-clock>
            ${
              config.show_current_weather
                ? available
                  ? html`<yacw-current-weather
                      .entity=${entity}
                      .conditionText=${conditionText}
                      .night=${dayNight.isNight(new Date())}
                      .animated=${config.animation}
                      .showFeelsLike=${config.show_feels_like}
                      .showHumidity=${config.show_humidity}
                      .showWind=${config.show_wind}
                      .location=${
                        config.show_location
                          ? (config.location_name ??
                            entity.attributes.friendly_name ??
                            "")
                          : ""
                      }
                      .labels=${labelsFor(t)}
                      .interactive=${hasAction(config.weather_tap_action)}
                    ></yacw-current-weather>`
                  : html`<div class="notice">
                      <strong>${t("unavailable")}</strong>
                      <span>${t("unavailable_hint")}</span>
                    </div>`
                : nothing
            }
            ${
              config.show_calendar && config.calendar_entities.length
                ? html`<yacw-calendar
                    .events=${this._calendar.events}
                    .ctx=${ctx}
                    .count=${config.calendar_count}
                    .heading=${t("calendar")}
                    .labels=${{
                      today: t("today"),
                      tomorrow: t("tomorrow"),
                      allDay: t("all_day"),
                      empty: this._calendar.error
                        ? t("calendar_error")
                        : t("no_events"),
                    }}
                    .interactive=${hasAction(config.calendar_tap_action)}
                  ></yacw-calendar>`
                : nothing
            }
          </div>

          <div class="forecasts">
            ${
              showHourly
                ? html`<div class="panel hourly">
                    ${
                      hourlyItems.length
                        ? html`<yacw-hourly-forecast
                            .items=${hourlyItems}
                            .ctx=${ctx}
                            .dayNight=${dayNight}
                            .heading=${t("hourly")}
                            .temperatureUnit=${entity.attributes.temperature_unit ?? "°"}
                            .precipitationUnit=${entity.attributes.precipitation_unit ?? "mm"}
                            .showProbability=${config.show_precipitation_probability}
                            .showAmount=${config.show_precipitation_amount}
                            .scrollHours=${config.hourly_scroll}
                            .animated=${config.animation}
                            .nightIcons=${config.night_icons_hourly}
                            .compact=${config.compact_mode}
                            .colorScale=${colorScale}
                            .showExtremes=${config.show_hourly_extremes}
                            .extremeLabels=${{
                              warmest: t("warmest"),
                              coldest: t("coldest"),
                            }}
                          ></yacw-hourly-forecast>`
                        : this._renderPlaceholder(
                            t("hourly"),
                            this._hourly.status === "loading"
                              ? t("loading")
                              : t("no_forecast"),
                          )
                    }
                  </div>`
                : nothing
            }
            ${
              showDaily
                ? html`<div class="panel daily">
                    ${
                      dailyItems.length
                        ? html`<yacw-daily-forecast
                            .items=${dailyItems}
                            .ctx=${ctx}
                            .heading=${t("daily")}
                            .temperatureUnit=${entity.attributes.temperature_unit ?? "°"}
                            .precipitationUnit=${entity.attributes.precipitation_unit ?? "mm"}
                            .showProbability=${config.show_precipitation_probability}
                            .showAmount=${config.show_precipitation_amount}
                            .animated=${config.animation}
                            .compact=${config.compact_mode}
                            .colorScale=${colorScale}
                          ></yacw-daily-forecast>`
                        : this._renderPlaceholder(
                            t("daily"),
                            this._daily.status === "loading" ||
                              this._twiceDaily.status === "loading"
                              ? t("loading")
                              : t("no_forecast"),
                          )
                    }
                  </div>`
                : nothing
            }
          </div>
        </div>
      </ha-card>
    `;
  }

  /** Flat appearance keys write into the card's own custom properties, so YAML
   *  and card_mod / themes end up steering exactly the same variables. */
  private _inlineStyle(config: CardConfig): string {
    const pairs: [string, string | undefined][] = [
      ["--yacw-user-accent", config.accent_color ?? config.primary_color],
      [
        "--yacw-temp",
        config.temperature_color_mode === "dynamic"
          ? undefined
          : config.temperature_color,
      ],
      ["--yacw-precip", config.precipitation_color],
      ["--yacw-surface-override", config.card_background],
      ["--yacw-radius", config.border_radius],
      ["--yacw-padding", config.card_padding],
      ["--yacw-icon-size", config.icon_size],
      ["--yacw-ratio", String(config.forecast_ratio)],
      ["--yacw-clock-size", config.clock_size],
      ["--yacw-clock-weight", config.clock_weight],
      ["--yacw-temperature-size", config.temperature_size],
      ["--yacw-current-icon-size", config.current_icon_size],
    ];
    return pairs
      .filter((pair): pair is [string, string] => Boolean(pair[1]))
      .map(([name, value]) => `${name}:${value}`)
      .join(";");
  }

  private _renderPlaceholder(heading: string, message: string) {
    return html`
      <section class="placeholder">
        <h3 class="section-title">${heading}</h3>
        <p class="muted">${message}</p>
      </section>
    `;
  }

  private _renderError(title: string, hint: string) {
    return html`
      <ha-card>
        <div class="error" role="alert">
          <svg viewBox="0 0 24 24" aria-hidden="true" class="error-icon">
            <path
              d="M12 2 1 21h22L12 2zm0 6 6.5 11h-13L12 8zm-1 3v4h2v-4h-2zm0 5v2h2v-2h-2z"
            />
          </svg>
          <div>
            <strong>${title}</strong>
            <p>${hint}</p>
          </div>
        </div>
      </ha-card>
    `;
  }

  static override styles = [
    tokens,
    shared,
    css`
      :host {
        display: block;
      }
      ha-card {
        /* Home Assistant's own ha-card is display:block, but an inline box
           cannot establish a container -- so the container queries below would
           silently never match if that ever changed. */
        display: block;
        container-type: inline-size;
        container-name: card;
        background: var(--yacw-surface-override, var(--yacw-surface));
        border-radius: var(--yacw-radius);
        color: var(--yacw-text);
        overflow: hidden;
        height: 100%;
      }
      ha-card.glass {
        /* backdrop-filter only has something to blur when the view behind the
           card is not a flat colour. On a plain background this is a no-op --
           documented rather than silently disappointing. */
        background: color-mix(
          in srgb,
          var(--yacw-surface-override, var(--yacw-surface)) 72%,
          transparent
        );
        backdrop-filter: blur(14px) saturate(140%);
        -webkit-backdrop-filter: blur(14px) saturate(140%);
        border: 1px solid color-mix(in srgb, var(--yacw-text) 8%, transparent);
      }

      .layout {
        display: grid;
        gap: var(--yacw-gap);
        padding: var(--yacw-padding);
        height: 100%;
        /* Narrow first: a card in a single Home Assistant section never gets
           wider than 500px, so the stacked layout is the common case, not the
           fallback. */
        grid-template-columns: 1fr;
        grid-template-areas:
          "hero"
          "forecasts";
      }
      .forecasts {
        grid-area: forecasts;
        display: flex;
        flex-direction: column;
        gap: var(--yacw-gap);
        min-height: 0;
        min-width: 0;
      }
      .hero {
        grid-area: hero;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        gap: 12px;
        min-width: 0;
        /* Children live in their own shadow roots; text-align inherits, but
           flex alignment does not -- so it travels as a custom property. */
        --yacw-hero-align: center;
      }
      .panel {
        min-width: 0;
        min-height: 0;
        display: flex;
      }
      .panel > * {
        flex: 1 1 auto;
        min-width: 0;
      }
      /*
       * flex-basis 0 with a min-content floor is what makes the ratio govern.
       * The obvious alternative -- two grid rows with fr -- silently does
       * nothing here: the hero spans both rows, and CSS grid does not
       * distribute a spanning item's height onto flexible tracks. Measured,
       * every ratio produced an identical layout.
       */
      .hourly {
        flex: var(--yacw-ratio, 1.5) 1 0;
        min-height: min-content;
      }
      .daily {
        flex: 1 1 0;
        min-height: min-content;
      }

      @container card (min-width: ${BREAKPOINT_MEDIUM}px) {
        .hero {
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          gap: var(--yacw-gap);
          flex-wrap: wrap;
        }
      }

      /* The sketch layout. Reachable only above ~700px, which a single Home
         Assistant section (max 500px) never provides -- see README. */
      @container card (min-width: ${BREAKPOINT_WIDE}px) {
        .layout {
          min-height: ${CARD_MIN_HEIGHT}px;
          grid-template-columns: minmax(200px, 0.3fr) minmax(0, 0.7fr);
          grid-template-areas: "hero forecasts";
        }
        .hero {
          flex-direction: column;
          align-items: center;
          justify-content: center;
          /* Symmetric padding, not padding-right: centring happens in the
             content box, so a one-sided inset pushes the block off-centre
             relative to the band the reader actually sees. */
          padding: 0 var(--yacw-gap);
          border-right: 1px solid var(--yacw-divider);
        }
      }

      /* compact_mode is a manual override, not the responsive mechanism. */
      ha-card.compact .layout {
        --yacw-gap: 10px;
        --yacw-padding: 12px;
        min-height: 0;
      }
      ha-card.compact yacw-clock {
        --yacw-clock-size: clamp(1.9rem, 5cqw, 2.8rem);
      }
      ha-card.single-forecast .layout {
        grid-template-rows: auto;
      }

      .notice {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 0.8125rem;
        color: var(--yacw-text-muted);
      }
      .notice strong {
        color: var(--yacw-text);
      }
      .placeholder {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 4px;
      }
      .placeholder p {
        margin: 0;
        font-size: 0.8125rem;
      }

      .error {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 16px;
      }
      .error-icon {
        width: 26px;
        height: 26px;
        flex: 0 0 auto;
        fill: var(--error-color, #db4437);
      }
      .error strong {
        display: block;
        color: var(--yacw-text);
        font-size: 0.9375rem;
      }
      .error p {
        margin: 4px 0 0;
        color: var(--yacw-text-muted);
        font-size: 0.8125rem;
      }
    `,
  ];
}

defineOnce(CARD_TAG, YetAnotherClockWeatherCard, true);
