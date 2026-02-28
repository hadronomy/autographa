import { getBrush } from "./brushes/registry";
import type { Stroke } from "./machine";

export class SignatureRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  private width: number;
  private height: number;

  constructor(private canvas: HTMLCanvasElement) {
    this.dpr = window.devicePixelRatio || 1;
    this.width = canvas.width;
    this.height = canvas.height;

    const contextOptions: CanvasRenderingContext2DSettings = {
      alpha: true,
      desynchronized: false,
    };

    this.ctx = canvas.getContext("2d", contextOptions)!;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();

    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;

    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.width = rect.width;
    this.height = rect.height;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";

    this.clear();
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  destroy() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /**
   * Render all strokes from scratch (clears the canvas).
   */
  renderStrokes(strokes: Stroke[]) {
    this.clear();
    for (const stroke of strokes) {
      this.renderStroke(stroke);
    }
  }

  /**
   * Render a single stroke.
   *
   * Useful for overlay live rendering: clear overlay and render only active stroke.
   */
  renderStroke(stroke: Stroke, opts?: { clear?: boolean }) {
    if (opts?.clear) this.clear();

    const brush = getBrush(stroke.brush.id);
    const settings = brush.coerceSettings(stroke.brush.settings);

    const prepared = brush.preprocess ? brush.preprocess(stroke, settings) : stroke;

    brush.renderCanvas({
      ctx: this.ctx,
      stroke: prepared,
      settings,
      context: { dpr: this.dpr },
    });
  }
}
