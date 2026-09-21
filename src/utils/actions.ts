import type { HomeAssistant } from "../types";

/**
 * Home Assistant's own action config, not a private invention: a `tap_action`
 * written for any other card can be pasted here unchanged.
 *
 * Two of Home Assistant's actions are deliberately absent, because a custom
 * card cannot reach them honestly:
 *  - `assist` needs showVoiceCommandDialog, which lazily imports a module from
 *    inside the frontend bundle.
 *  - `confirmation` needs showConfirmationDialog for the same reason. A native
 *    window.confirm() in a dashboard would be worse than saying so.
 * Both are documented as unsupported rather than silently ignored.
 */
export interface ActionConfig {
  action:
    | "more-info"
    | "navigate"
    | "url"
    | "toggle"
    | "perform-action"
    | "call-service"
    | "fire-dom-event"
    | "none";
  entity?: string;
  navigation_path?: string;
  navigation_replace?: boolean;
  url_path?: string;
  perform_action?: string;
  /** @deprecated Home Assistant keeps `service` for backwards compatibility. */
  service?: string;
  data?: Record<string, unknown>;
  service_data?: Record<string, unknown>;
  target?: Record<string, unknown>;
  [key: string]: unknown;
}

const MAIN_WINDOW_NAME = "ha-main-window";

/** The card may run inside a panel iframe; history belongs to the app window. */
function mainWindow(): Window {
  try {
    if (window.name === MAIN_WINDOW_NAME) return window;
    if (parent && parent.name === MAIN_WINDOW_NAME) return parent;
    return top ?? window;
  } catch {
    return window;
  }
}

/**
 * Allowlist rather than a blocklist. `url_path` comes out of a dashboard
 * config, and a blocklist of "javascript:" and friends is the kind of check
 * that loses to whitespace and entity tricks -- so only paths and the four
 * schemes that make sense on a dashboard get through.
 */
const ABSOLUTE_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const ALLOWED_SCHEME = /^(https?|mailto|tel):/i;

function safeUrl(url: string): string | undefined {
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (!ABSOLUTE_SCHEME.test(trimmed)) {
    // Relative: a path, a query or a fragment. Protocol-relative "//host" is
    // treated as external and therefore has to be spelled out with a scheme.
    return trimmed.startsWith("//") ? undefined : trimmed;
  }
  return ALLOWED_SCHEME.test(trimmed) ? trimmed : undefined;
}

export function hasAction(config: ActionConfig | undefined): boolean {
  return !!config && config.action !== "none";
}

export function handleAction(
  node: HTMLElement,
  hass: HomeAssistant,
  config: ActionConfig | undefined,
  fallbackEntity?: string,
): void {
  const action = config ?? { action: "more-info" as const };

  switch (action.action) {
    case "none":
      return;

    case "more-info": {
      const entityId = action.entity ?? fallbackEntity;
      if (!entityId) return;
      node.dispatchEvent(
        new CustomEvent("hass-more-info", {
          bubbles: true,
          composed: true,
          detail: { entityId },
        }),
      );
      return;
    }

    case "navigate": {
      const path = action.navigation_path;
      if (!path) return;
      const win = mainWindow();
      const replace = action.navigation_replace === true;
      if (replace) {
        win.history.replaceState(win.history.state ?? null, "", path);
      } else {
        win.history.pushState(null, "", path);
      }
      // Home Assistant's router listens for this on the app window.
      win.dispatchEvent(
        new CustomEvent("location-changed", {
          bubbles: true,
          composed: true,
          detail: { replace },
        }),
      );
      return;
    }

    case "url": {
      if (!action.url_path) return;
      const url = safeUrl(action.url_path);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    case "toggle": {
      const entityId = action.entity ?? fallbackEntity;
      if (!entityId) return;
      void hass.callService?.("homeassistant", "toggle", {
        entity_id: entityId,
      });
      return;
    }

    case "perform-action":
    case "call-service": {
      const name = action.perform_action ?? action.service;
      if (!name) return;
      const [domain, service] = name.split(".", 2);
      if (!domain || !service) return;
      void hass.callService?.(
        domain,
        service,
        action.data ?? action.service_data,
        action.target,
      );
      return;
    }

    case "fire-dom-event": {
      node.dispatchEvent(
        new CustomEvent("ll-custom", {
          bubbles: true,
          composed: true,
          detail: action,
        }),
      );
      return;
    }
  }
}
