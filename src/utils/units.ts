/**
 * Column labels repeat a dozen times; "12 °C" twelve times is noise, and the
 * full unit is already on the current-weather readout. Degrees collapse to the
 * bare symbol, anything else is left alone.
 */
export function shortUnit(unit: string | undefined): string {
  if (!unit) return "°";
  return unit.startsWith("°") ? "°" : unit;
}
