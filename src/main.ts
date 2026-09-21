import { CARD_TAG, CARD_VERSION, REPO_URL } from "./const";
import "./card";

interface CustomCardEntry {
  type: string;
  name: string;
  description: string;
  preview?: boolean;
  documentationURL?: string;
}

declare global {
  interface Window {
    customCards?: CustomCardEntry[];
  }
}

// Registers the card with the Lovelace card picker.
window.customCards = window.customCards ?? [];
if (!window.customCards.some((card) => card.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "Yet Another Clock Weather Card",
    description:
      "Clock, date, current weather, calendar and forecast charts in one " +
      "horizontal card.",
    preview: true,
    documentationURL: REPO_URL,
  });
}

/* eslint-disable no-console */
console.info(
  `%c ${CARD_TAG} %c v${CARD_VERSION} `,
  "color:#fff;background:#eb6834;font-weight:700;border-radius:3px 0 0 3px;padding:2px 6px",
  "color:#eb6834;background:#2b2b2b;border-radius:0 3px 3px 0;padding:2px 6px",
);
