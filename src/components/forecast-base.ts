import { LitElement } from "lit";
import { state } from "lit/decorators.js";

/**
 * Charts are drawn in CSS pixels against a 1:1 viewBox rather than with
 * preserveAspectRatio="none": stretching a viewBox would scale stroke widths
 * and text along with the geometry, so a wide card would get fat curves and
 * squashed labels.
 *
 * Both the width and the plot's height are measured. The height matters
 * because the two forecast blocks share the card's height by a configurable
 * ratio -- with a constant chart height the extra space would simply become
 * whitespace inside the block instead of a taller curve.
 *
 * The plot is only ever given its height, it never takes one from its content:
 * its floor is a fixed min-height and the drawing is positioned absolutely.
 * Otherwise the SVG, sized to the last measured height, would hold the block
 * open -- a card that was tall once could never shrink back.
 */
/** Bound by literal name in the card's template; Lit cannot bind a variable one. */
const LAYOUT_EVENT = "yacw-forecast-layout";

export abstract class ForecastBlock extends LitElement {
  @state() protected availableWidth = 0;
  @state() protected plotHeight = 0;

  /** Selector of the element whose height the plot should fill. */
  protected abstract readonly plotSelector: string;
  /** Used for the very first frame, before the observer has reported. */
  protected abstract readonly plotFallback: number;

  private _widthObserver?: ResizeObserver;
  private _plotObserver?: ResizeObserver;
  private _plot?: Element;

  override connectedCallback(): void {
    super.connectedCallback();
    this._widthObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      // An epsilon keeps sub-pixel reflow from looping observer -> render -> observer.
      if (Math.abs(width - this.availableWidth) > 0.5) {
        this.availableWidth = width;
      }
      this._announceLayout();
    });
    this._widthObserver.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._widthObserver?.disconnect();
    this._plotObserver?.disconnect();
    this._widthObserver = undefined;
    this._plotObserver = undefined;
    this._plot = undefined;
  }

  protected override updated(): void {
    const plot = this.renderRoot.querySelector(this.plotSelector);
    if (!plot || plot === this._plot) return;
    // The plot's height comes from flex, never from its own content, so
    // observing it cannot feed back into itself.
    this._plotObserver?.disconnect();
    this._plot = plot;
    this._plotObserver = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0;
      if (Math.abs(height - this.plotHeight) > 0.5) {
        this.plotHeight = height;
      }
      this._announceLayout();
    });
    this._plotObserver.observe(plot);
  }

  /**
   * The height this block needs with its plot at the floor. It does not depend
   * on how tall the block currently is -- everything but the plot is fixed --
   * so the card can size from it without feeding back into it.
   */
  public get minimumHeight(): number | undefined {
    const plot = this._plot;
    if (!plot?.isConnected) return undefined;
    const floor = parseFloat(getComputedStyle(plot).minHeight) || 0;
    return (
      this.getBoundingClientRect().height -
      plot.getBoundingClientRect().height +
      floor
    );
  }

  private _announceLayout(): void {
    this.dispatchEvent(
      new CustomEvent(LAYOUT_EVENT, { bubbles: true, composed: true }),
    );
  }

  protected get effectivePlotHeight(): number {
    return this.plotHeight > 0 ? this.plotHeight : this.plotFallback;
  }
}
