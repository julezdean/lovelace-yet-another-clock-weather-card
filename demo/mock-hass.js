// Mock Home Assistant for the demo harness. The shapes mirror what the real
// websocket API sends -- including the awkward parts: missing fields, a null
// forecast, and conditions the card has to fall back on.

const CONDITIONS = [
  "sunny", "partlycloudy", "cloudy", "rainy", "pouring", "lightning-rainy",
  "snowy", "fog", "windy", "hail",
];

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function buildForecast(type, opts = {}) {
  const rand = seeded(opts.seed ?? 42);
  const now = new Date();
  now.setMinutes(0, 0, 0);

  if (type === "hourly") {
    return Array.from({ length: 24 }, (_, i) => {
      const date = new Date(now.getTime() + (i + 1) * 3600_000);
      const hour = date.getHours();
      // A daily temperature swing so the curve has a shape worth drawing.
      const centre = opts.cold ? -2 : 16;
      const base = centre + 6 * Math.sin(((hour - 9) / 24) * 2 * Math.PI);
      return {
        datetime: date.toISOString(),
        condition: CONDITIONS[Math.floor(rand() * CONDITIONS.length)],
        temperature: Math.round((base + rand() * 2 - 1) * 10) / 10,
        precipitation_probability: Math.round(rand() * 90),
        precipitation: Math.round(rand() * 22) / 10,
        humidity: 50 + Math.round(rand() * 40),
        wind_speed: Math.round(rand() * 30),
      };
    });
  }

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now.getTime() + (i + 1) * 86_400_000);
    date.setHours(12, 0, 0, 0);
    const high = (opts.cold ? -3 : 18) + Math.round(rand() * 9);
    return {
      datetime: date.toISOString(),
      condition: CONDITIONS[Math.floor(rand() * CONDITIONS.length)],
      temperature: high,
      templow: high - 5 - Math.round(rand() * 5),
      precipitation_probability: Math.round(rand() * 95),
      precipitation: Math.round(rand() * 60) / 10,
    };
  });
}

function buildCalendar() {
  const now = new Date();
  const at = (dayOffset, hour, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const timed = (dayOffset, hour, minute, summary, location) => ({
    summary,
    location,
    start: { dateTime: at(dayOffset, hour, minute).toISOString() },
    end: { dateTime: at(dayOffset, hour + 1, minute).toISOString() },
  });
  const allDay = (dayOffset, summary) => {
    const d = at(dayOffset, 0);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { summary, start: { date: iso }, end: { date: iso } };
  };
  return [
    timed(0, 18, 30, "Zahnarzt", "Hauptstraße 4"),
    timed(1, 9, 0, "Standup"),
    allDay(2, "Urlaub"),
    timed(3, 14, 15, "Elterngespräch Schule"),
    timed(5, 20, 0, "Kino mit Anna"),
  ];
}

export function makeHass(overrides = {}) {
  const now = new Date();
  const dawn = new Date(now); dawn.setHours(6, 34, 0, 0);
  const dusk = new Date(now); dusk.setHours(20, 12, 0, 0);

  const weather = {
    entity_id: "weather.home",
    state: overrides.condition ?? "partlycloudy",
    attributes: {
      friendly_name: overrides.locationName ?? "Wohnzimmer",
      supported_features: 1 | 2, // FORECAST_DAILY | FORECAST_HOURLY
      temperature: overrides.cold ? -3 : 18,
      temperature_unit: "°C",
      apparent_temperature: 16,
      humidity: 63,
      wind_speed: 14,
      wind_speed_unit: "km/h",
      wind_bearing: 240,
      pressure: 1013,
      pressure_unit: "hPa",
      precipitation_unit: "mm",
      visibility: 20,
      visibility_unit: "km",
      ...(overrides.attributes ?? {}),
    },
    last_changed: now.toISOString(),
    last_updated: now.toISOString(),
    context: { id: "1", parent_id: null, user_id: null },
  };

  if (overrides.unavailable) weather.state = "unavailable";

  const states = {
    "weather.home": weather,
    "sun.sun": {
      entity_id: "sun.sun",
      state: "above_horizon",
      attributes: {
        next_dawn: dawn.toISOString(),
        next_dusk: dusk.toISOString(),
        next_rising: dawn.toISOString(),
        next_setting: dusk.toISOString(),
      },
      last_changed: now.toISOString(),
      last_updated: now.toISOString(),
      context: { id: "2", parent_id: null, user_id: null },
    },
  };

  states["calendar.familie"] = {
    entity_id: "calendar.familie",
    state: "off",
    attributes: { friendly_name: "Familie" },
    last_changed: now.toISOString(),
    last_updated: now.toISOString(),
    context: { id: "3", parent_id: null, user_id: null },
  };

  return {
    states,
    // Calendars have no websocket subscription; the card reads them over REST.
    callApi: async (method, path) => {
      if (method === "GET" && path.startsWith("calendars/")) {
        if (overrides.calendarError) throw new Error("500");
        return buildCalendar();
      }
      throw new Error(`unexpected ${method} ${path}`);
    },
    language: overrides.language ?? "de",
    locale: {
      language: overrides.language ?? "de",
      number_format: "language",
      time_format: overrides.timeFormat ?? "24",
      date_format: "language",
      first_weekday: "language",
      time_zone: "local",
    },
    config: { time_zone: "Europe/Berlin" },
    themes: { darkMode: !!overrides.dark },
    localize: (key) => key,
    formatEntityState: (stateObj) => {
      const map = {
        de: {
          sunny: "Sonnig", partlycloudy: "Teilweise bewölkt", cloudy: "Bewölkt",
          rainy: "Regnerisch", pouring: "Starkregen", "lightning-rainy": "Gewitter",
          snowy: "Schnee", fog: "Nebel", windy: "Windig", hail: "Hagel",
          "clear-night": "Klar", unavailable: "Nicht verfügbar",
        },
      };
      return map.de[stateObj.state] ?? stateObj.state;
    },
    connection: {
      subscribeMessage(callback, message) {
        if (message.type !== "weather/subscribe_forecast") {
          return Promise.resolve(async () => {});
        }
        if (overrides.forecastError) {
          return Promise.reject({
            code: "forecast_not_supported",
            message: "The weather entity does not support forecast type",
          });
        }
        const payload = overrides.nullForecast
          ? null
          : buildForecast(message.forecast_type, overrides);
        // The server pushes an initial forecast right after subscribing.
        setTimeout(() => callback({ type: message.forecast_type, forecast: payload }), 10);
        return Promise.resolve(async () => {});
      },
    },
  };
}
