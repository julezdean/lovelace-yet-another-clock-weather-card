/**
 * The card's own labels. Everything Home Assistant already translates --
 * weather conditions, entity names -- is taken from hass rather than duplicated
 * here, so this table stays small enough to keep correct.
 */
const STRINGS = {
  en: {
    hourly: "Next hours",
    daily: "Next days",
    feels_like: "Feels like",
    humidity: "Humidity",
    wind: "Wind",
    no_entity: "Entity not found",
    no_entity_hint: 'Check "weather_entity" in the card configuration.',
    unavailable: "Weather data unavailable",
    unavailable_hint: "The entity exists but is not reporting right now.",
    no_forecast: "No forecast available",
    no_forecast_hint: "The weather service returned no data.",
    loading: "Loading forecast…",
    config_error: "Configuration error",
    calendar: "Next up",
    warmest: "warmest",
    coldest: "coldest",
    today: "Today",
    tomorrow: "Tomorrow",
    all_day: "All day",
    no_events: "Nothing scheduled",
    calendar_error: "Calendar could not be loaded",
  },
  de: {
    hourly: "Nächste Stunden",
    daily: "Nächste Tage",
    feels_like: "Gefühlt",
    humidity: "Luftfeuchte",
    wind: "Wind",
    no_entity: "Entity nicht gefunden",
    no_entity_hint: 'Prüfe "weather_entity" in der Kartenkonfiguration.',
    unavailable: "Keine Wetterdaten",
    unavailable_hint: "Die Entity existiert, meldet aber gerade nichts.",
    no_forecast: "Keine Vorhersage verfügbar",
    no_forecast_hint: "Der Wetterdienst hat keine Daten geliefert.",
    loading: "Vorhersage wird geladen…",
    config_error: "Konfigurationsfehler",
    calendar: "Als Nächstes",
    warmest: "wärmste Stunde",
    coldest: "kälteste Stunde",
    today: "Heute",
    tomorrow: "Morgen",
    all_day: "Ganztägig",
    no_events: "Nichts geplant",
    calendar_error: "Kalender nicht ladbar",
  },
  nl: {
    hourly: "Komende uren",
    daily: "Komende dagen",
    feels_like: "Gevoelstemperatuur",
    humidity: "Luchtvochtigheid",
    wind: "Wind",
    no_entity: "Entity niet gevonden",
    no_entity_hint: 'Controleer "weather_entity" in de kaartconfiguratie.',
    unavailable: "Weergegevens niet beschikbaar",
    unavailable_hint: "De entity bestaat, maar rapporteert nu niets.",
    no_forecast: "Geen verwachting beschikbaar",
    no_forecast_hint: "De weerdienst leverde geen gegevens.",
    loading: "Verwachting laden…",
    config_error: "Configuratiefout",
    calendar: "Binnenkort",
    warmest: "warmste uur",
    coldest: "koudste uur",
    today: "Vandaag",
    tomorrow: "Morgen",
    all_day: "Hele dag",
    no_events: "Niets gepland",
    calendar_error: "Agenda niet laadbaar",
  },
  fr: {
    hourly: "Prochaines heures",
    daily: "Prochains jours",
    feels_like: "Ressenti",
    humidity: "Humidité",
    wind: "Vent",
    no_entity: "Entité introuvable",
    no_entity_hint: "Vérifiez « weather_entity » dans la configuration.",
    unavailable: "Données météo indisponibles",
    unavailable_hint: "L'entité existe mais ne renvoie rien actuellement.",
    no_forecast: "Aucune prévision disponible",
    no_forecast_hint: "Le service météo n'a renvoyé aucune donnée.",
    loading: "Chargement des prévisions…",
    config_error: "Erreur de configuration",
    calendar: "À venir",
    warmest: "heure la plus chaude",
    coldest: "heure la plus froide",
    today: "Aujourd'hui",
    tomorrow: "Demain",
    all_day: "Journée entière",
    no_events: "Rien de prévu",
    calendar_error: "Agenda non chargé",
  },
} as const;

export type StringKey = keyof (typeof STRINGS)["en"];

export type Translator = (key: StringKey) => string;

export function translator(language: string | undefined): Translator {
  const base = (language || "en").split("-")[0].toLowerCase();
  const table =
    (STRINGS as Record<string, Record<string, string>>)[base] ?? STRINGS.en;
  return (key: StringKey) => table[key] ?? STRINGS.en[key];
}

export function labelsFor(t: Translator): Record<string, string> {
  return {
    feels_like: t("feels_like"),
    humidity: t("humidity"),
    wind: t("wind"),
  };
}
