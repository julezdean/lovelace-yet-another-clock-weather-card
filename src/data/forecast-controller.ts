import type { ReactiveController, ReactiveControllerHost } from "lit";
import type {
  ForecastEvent,
  ForecastType,
  HomeAssistant,
  RawForecast,
} from "../types";

export type SubscriptionStatus = "idle" | "loading" | "ready" | "error";

/**
 * Home Assistant pushes forecasts over the websocket; there is no forecast in
 * the entity state since 2024.4. The subscription takes `entity_id` and
 * `forecast_type`, answers with a result message, and then immediately pushes a
 * first forecast, so no separate initial fetch is needed.
 *
 * `subscribeMessage` defaults to `resubscribe: true`, so a dropped websocket is
 * re-established by the library. What it does NOT cover is Lovelace detaching
 * the card from the DOM (tab switches do this), which is what hostConnected /
 * hostDisconnected below are for. The two mechanisms are independent.
 */
function subscribeForecast(
  hass: HomeAssistant,
  entityId: string,
  forecastType: ForecastType,
  callback: (event: ForecastEvent) => void,
): Promise<() => Promise<void>> {
  return hass.connection.subscribeMessage<ForecastEvent>(callback, {
    type: "weather/subscribe_forecast",
    forecast_type: forecastType,
    entity_id: entityId,
  });
}

function messageOf(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unknown error";
}

function codeOf(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  return undefined;
}

/**
 * Owns one forecast subscription. One instance per forecast type; the card
 * holds two. All of the lifecycle risk of this card lives in this class.
 */
export class ForecastController implements ReactiveController {
  private _hass?: HomeAssistant;
  private _entityId?: string;
  private _connected = false;

  private _unsubscribe?: () => Promise<void>;
  /** Bumped on every teardown so in-flight async work can detect it is stale. */
  private _generation = 0;

  private _forecast: RawForecast[] | null = null;
  private _status: SubscriptionStatus = "idle";
  private _errorMessage?: string;
  private _errorCode?: string;

  constructor(
    private readonly host: ReactiveControllerHost,
    private readonly type: ForecastType,
  ) {
    host.addController(this);
  }

  get forecast(): RawForecast[] | null {
    return this._forecast;
  }

  get status(): SubscriptionStatus {
    return this._status;
  }

  get errorMessage(): string | undefined {
    return this._errorMessage;
  }

  /** True when the entity exists but cannot serve this forecast type. */
  get unsupported(): boolean {
    return this._errorCode === "forecast_not_supported";
  }

  hostConnected(): void {
    this._connected = true;
    void this._subscribe();
  }

  hostDisconnected(): void {
    this._connected = false;
    this._teardown();
  }

  /**
   * Called from the card's `hass` setter. Only an actual change of entity or
   * connection tears the subscription down -- `hass` is replaced on every state
   * change in the whole installation.
   */
  update(hass: HomeAssistant | undefined, entityId: string | undefined): void {
    const connectionChanged = this._hass?.connection !== hass?.connection;
    const entityChanged = this._entityId !== entityId;
    this._hass = hass;
    if (!connectionChanged && !entityChanged) return;

    this._entityId = entityId;
    this._teardown();
    this._forecast = null;
    this._errorMessage = undefined;
    this._errorCode = undefined;
    this._status = "idle";
    if (this._connected) void this._subscribe();
  }

  private async _subscribe(): Promise<void> {
    const hass = this._hass;
    const entityId = this._entityId;
    if (!hass?.connection || !entityId || this._unsubscribe) return;

    const generation = this._generation;
    this._status = "loading";
    this.host.requestUpdate();

    try {
      const unsubscribe = await subscribeForecast(
        hass,
        entityId,
        this.type,
        (event) => {
          if (generation !== this._generation) return;
          this._forecast = event?.forecast ?? null;
          this._status = "ready";
          this._errorMessage = undefined;
          this._errorCode = undefined;
          this.host.requestUpdate();
        },
      );

      // The card can be torn down while this promise is in flight. Without this
      // the subscription stays alive on the server for the rest of the session.
      if (generation !== this._generation) {
        void unsubscribe().catch(() => undefined);
        return;
      }
      this._unsubscribe = unsubscribe;
    } catch (error) {
      if (generation !== this._generation) return;
      this._status = "error";
      this._errorMessage = messageOf(error);
      this._errorCode = codeOf(error);
      this.host.requestUpdate();
    }
  }

  private _teardown(): void {
    this._generation += 1;
    const unsubscribe = this._unsubscribe;
    this._unsubscribe = undefined;
    // The connection may already be gone; a failed unsubscribe is not an error
    // worth surfacing to the user.
    if (unsubscribe) void unsubscribe().catch(() => undefined);
  }
}
