/**
 * Defines a custom element once, and says something useful when it cannot.
 *
 * A second Lovelace resource entry for the same card -- the usual cause is
 * adding `?v=2` as a NEW entry instead of editing the old one -- loads this
 * bundle twice. The second `customElements.define` then throws
 * NotSupportedError partway through the module, so whichever copy loaded first
 * wins and the other one silently does nothing. From the outside that looks
 * exactly like "I deployed the new file and nothing changed".
 *
 * The sibling integrations in this account avoid the situation entirely by
 * reconciling the resource list from Python, matching on the path so a version
 * bump updates the existing entry. A card-only repository has no Python side,
 * so it cannot prevent the duplicate -- only survive it and name it.
 */
/**
 * @param announce Set on the card element only. Every child would otherwise
 *   repeat the same message and bury it.
 */
export function defineOnce(
  tag: string,
  element: CustomElementConstructor,
  announce = false,
): void {
  if (customElements.get(tag)) {
    if (announce) {
      // eslint-disable-next-line no-console
      console.warn(
        `[${tag}] is already registered, so this copy does nothing. You very ` +
          `likely have two Lovelace resource entries pointing at this card. ` +
          `Keep one under Settings > Dashboards > Resources and edit its ` +
          `?v= instead of adding a second entry -- otherwise whichever copy ` +
          `loads first wins, and an update looks like it changed nothing.`,
      );
    }
    return;
  }
  customElements.define(tag, element);
}
