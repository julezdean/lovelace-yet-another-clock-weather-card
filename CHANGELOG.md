# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-21

First release.

### Added

- A horizontal card with the clock, the date, the current weather, a location
  and the next calendar appointments on the left, and the hourly and daily
  forecast on the right. It needs Home Assistant 2024.4 or newer.
- Forecasts arrive over the `weather/subscribe_forecast` websocket
  subscription. The `forecast` state attribute this card would otherwise have
  read was removed in 2024.4, and the alternative — calling
  `weather.get_forecasts` — returns a snapshot and would force the card to run
  its own poll timer. There is no polling interval for weather in this card.
- Hourly temperatures are an area curve with monotone (Fritsch–Carlson)
  interpolation. An ordinary smoothing spline overshoots between points, which
  would draw a peak warmer than any value the forecast actually contains.
- Daily temperatures are range bars rather than a curve. A day is a discrete
  bucket, and a line between Monday's high and Tuesday's high asserts
  temperatures for points in between that do not exist. The readings sit beside
  each bar, level with its ends, so the numbers cost no vertical space.
- The warmest and coldest hour are marked with a haloed node, an enlarged value
  and a ▲ / ▼. On a tie the first hour wins so a plateau gets one marker, and
  when every hour is the same temperature nothing is marked at all.
- Precipitation probability and amount are independent. Probability gets its
  own baseline in the hourly block, never a second y-axis on the temperature
  plot: percent and degrees do not share a scale.
- Optional `temperature_color_mode: dynamic` colours every mark by its
  temperature, using a two-hue diverging ramp with a neutral midpoint rather
  than a rainbow — a blue-green-yellow-red hue order carries no perceptual
  ordering. The domain is absolute and configured, so a colour always means the
  same temperature instead of a rank inside today's data.
- Weather icons are composed from shared SVG primitives and animated in CSS.
  Animation is fully disabled — not slowed — under `prefers-reduced-motion`.
  Themes that override `--weather-icon-<condition>` are honoured.
- Night icons in the hourly forecast are derived from `sun.sun`. Home
  Assistant's own card reads `is_daytime`, which only exists on `twice_daily`
  forecasts, so an hourly `sunny` entry at 23:00 shows a sun there. Set
  `night_icons_hourly: false` to match the built-in behaviour.
- Calendar events for the left column. Calendars have no push API, so this part
  reads `/api/calendars/<entity_id>` and refreshes on entity state changes, at
  local midnight, when the tab becomes visible, and on a 15-minute backstop.
  Every timer stops while the card is detached or hidden.
- Tap actions on the current weather and on calendar rows, using Home
  Assistant's standard action schema. `assist` and `confirmation` are rejected
  at configuration time rather than ignored at click time: both need dialogs
  that are lazily imported from inside the frontend bundle, which a custom card
  cannot reach.
- A visual editor built on `ha-form`. The YAML stays flat; the editor only
  groups the options, and it writes back only what differs from the defaults.
- Every chart is paired with a visually hidden table carrying the same values,
  and no information is conveyed by colour alone.
- The layout responds to the card's own width through container queries rather
  than the viewport, because the same card can be narrow on a wide screen. The
  wide layout needs roughly 700px, which a single Home Assistant section
  (capped at 500px) cannot provide — see the README.
- Element definitions are idempotent. A second Lovelace resource entry for the
  same card loads the bundle twice, and the second `customElements.define`
  would otherwise throw partway through, leaving whichever copy loaded first in
  charge while an update appears to do nothing. The card now says so in the
  console instead.

[Unreleased]: https://github.com/julezdean/lovelace-yet-another-clock-weather-card/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/julezdean/lovelace-yet-another-clock-weather-card/releases/tag/v0.1.0
