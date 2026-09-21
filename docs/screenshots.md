# Screenshots

The images in `docs/images/` are produced from `demo/shot.html`, which renders
exactly one card at exactly the requested width. A viewport screenshot is
therefore the finished image -- nothing is cropped by hand, so the pictures can
be regenerated after a change instead of quietly going stale.

## Recipe

1. Build first. The stage loads `dist/`, not `src/`:

   ```
   npm run build
   ```

2. Serve the repository root (the stage imports `../dist/...`):

   ```
   python3 -m http.server 4173
   ```

3. For each row of the table below: set the browser viewport to the listed size,
   open the URL, wait until `document.body` has `data-ready="1"`, and capture the
   viewport.

| Image | Viewport | URL |
|---|---|---|
| `wide-light.png` | 1080 x 480 | `/demo/shot.html?w=1032` |
| `wide-dark.png` | 1080 x 480 | `/demo/shot.html?w=1032&dark=1` |
| `section-light.png` | 548 x 560 | `/demo/shot.html?w=500` |
| `phone-light.png` | 408 x 620 | `/demo/shot.html?w=360` |
| `compact-light.png` | 1080 x 400 | `/demo/shot.html?w=1032&cfg=%7B%22compact_mode%22%3Atrue%7D` |
| `dynamic-warm-light.png` | 1080 x 480 | `?w=1032&cfg={"temperature_color_mode":"dynamic"}` |
| `dynamic-cold-light.png` | 1080 x 480 | `?w=1032&cold=1&cfg={…,"temperature_color_min":-15,"temperature_color_max":25}` |
| `dynamic-warm-dark.png` | 1080 x 480 | `?w=1032&dark=1&cfg={"temperature_color_mode":"dynamic"}` |
| `calendar-light.png` | 1080 x 520 | `?w=1032&cfg={"show_calendar":true,…}` |
| `bold-clock-light.png` | 1080 x 520 | `?w=1032&cfg={"clock_weight":"700",…}` |
| `extremes-light.png` | 1080 x 480 | `?w=1032&cfg={"temperature_color_mode":"dynamic","forecast_hours":12}` |

The exact, URL-encoded queries live in `scripts/screenshots.sh`; the table above
shows them readably. `cold=1` switches the mock to a sub-zero dataset so the cool
arm of the ramp is actually exercised -- a screenshot of only mild weather would
not show whether the cold end works.

The viewport is the card width plus the 48px of page padding, and a height that
clears the card. **Those numbers are not constants.** Card height follows its
content: turning on seconds, wind, humidity or precipitation amounts makes it
taller, and so does raising `forecast_days`. After a layout change, measure the
card again and correct the table:

```js
document.querySelector("yet-another-clock-weather-card").getBoundingClientRect();
```

## Keeping the pictures honest

The state shown in a screenshot is part of the screenshot. `mock-hass.js` uses a
fixed seed so the forecast shape stays the same between runs; a change in the
picture then means a change in the card, not a reroll of random weather.

`demo/index.html` additionally shows the failure states (entity unavailable,
forecast unsupported, forecast `null`). If one of those is ever added to the
README, give it its own stage rather than letting a new demo displace the case
an existing image was chosen to show.
