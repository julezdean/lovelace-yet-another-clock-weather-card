#!/usr/bin/env bash
# Regenerates docs/images/ from demo/shot.html.
#
# The stage renders one card at one width, so the viewport screenshot IS the
# image. Sizes live in SHOTS below and in docs/screenshots.md -- they are not
# constants; re-measure after a layout change.
set -euo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT="${PORT:-4173}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/docs/images"

[ -x "$CHROME" ] || { echo "Chrome not found at $CHROME" >&2; exit 1; }
[ -f "$ROOT/dist/yet-another-clock-weather-card.js" ] || { echo "Run 'npm run build' first." >&2; exit 1; }

# name|viewport|query
SHOTS=(
  "wide-light|1080,480|w=1032"
  "wide-dark|1080,480|w=1032&dark=1"
  "section-light|548,560|w=500"
  "phone-light|408,620|w=360"
  "compact-light|1080,400|w=1032&cfg=%7B%22compact_mode%22%3A%20true%7D"
  "dynamic-warm-light|1080,480|w=1032&cfg=%7B%22temperature_color_mode%22%3A%20%22dynamic%22%7D"
  "dynamic-cold-light|1080,480|w=1032&cold=1&cfg=%7B%22temperature_color_mode%22%3A%20%22dynamic%22%2C%20%22temperature_color_min%22%3A%20-15%2C%20%22temperature_color_max%22%3A%2025%7D"
  "dynamic-warm-dark|1080,480|w=1032&dark=1&cfg=%7B%22temperature_color_mode%22%3A%20%22dynamic%22%7D"
  "calendar-light|1080,520|w=1032&cfg=%7B%22show_calendar%22%3A%20true%2C%20%22calendar_entities%22%3A%20%5B%22calendar.familie%22%5D%2C%20%22calendar_count%22%3A%203%7D"
  "bold-clock-light|1080,520|w=1032&cfg=%7B%22clock_weight%22%3A%20%22700%22%2C%20%22show_calendar%22%3A%20true%2C%20%22calendar_entities%22%3A%20%5B%22calendar.familie%22%5D%2C%20%22calendar_count%22%3A%203%7D"
  "extremes-light|1080,480|w=1032&cfg=%7B%22temperature_color_mode%22%3A%20%22dynamic%22%2C%20%22forecast_hours%22%3A%2012%7D"
  "extremes-dense-light|1080,480|w=1032&cfg=%7B%22temperature_color_mode%22%3A%20%22dynamic%22%2C%20%22forecast_hours%22%3A%2024%2C%20%22hourly_scroll%22%3A%20false%7D"
)

mkdir -p "$OUT"
python3 -m http.server "$PORT" --directory "$ROOT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 1

for shot in "${SHOTS[@]}"; do
  IFS='|' read -r name size query <<<"$shot"
  "$CHROME" \
    --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --virtual-time-budget=4000 \
    --window-size="$size" \
    --screenshot="$OUT/$name.png" \
    "http://localhost:$PORT/demo/shot.html?$query" >/dev/null 2>&1
  echo "  $name.png  ($size)"
done

echo "Done: $OUT"
