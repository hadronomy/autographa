import type { Stroke } from "./machine";

export class SignatureRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  private width: number;
  private height: number;
  private shouldSnap: boolean;

  constructor(private canvas: HTMLCanvasElement) {
    this.dpr = window.devicePixelRatio || 1;
    this.width = canvas.width;
    this.height = canvas.height;
    // this.shouldSnap = this.dpr === 1;
    this.shouldSnap = false;

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

  private snapToHalfPixel(value: number): number {
    if (!this.shouldSnap) return value;
    return Math.round(value * 2) / 2;
  }

  private snapLineWidth(width: number): number {
    if (!this.shouldSnap) return width;
    if (width < 3) return Math.round(width * 2) / 2;
    return Math.round(width);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  destroy() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /**
   * Render all strokes from scratch (clears the canvas).
   * This is the "final" rendering used after a stroke completes.
   */
  renderStrokes(strokes: Stroke[]) {
    this.clear();

    strokes.forEach((stroke) => {
      this.renderCompleteStroke(stroke);
    });
  }

  /**
   * Render a single stroke.
   *
   * Useful for "live preview" rendering on an overlay canvas, where you typically
   * clear the overlay and re-render only the active stroke each pointer move.
   */
  renderStroke(stroke: Stroke, opts?: { clear?: boolean }) {
    if (opts?.clear) this.clear();
    this.renderCompleteStroke(stroke);
  }

  private renderDot(stroke: Stroke) {
    if (stroke.points.length !== 1) return;

    const p = stroke.points[0];
    const x = this.snapToHalfPixel(p.x);
    const y = this.snapToHalfPixel(p.y);

    const pressure = p.pressure;
    const width = stroke.width * (0.5 + pressure * 0.5);

    const radius = this.snapLineWidth(width / 2);

    this.ctx.fillStyle = stroke.color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private renderCompleteStroke(stroke: Stroke) {
    if (stroke.points.length === 0) return;

    // Handle a "tap" stroke (single point).
    if (stroke.points.length === 1) {
      this.renderDot(stroke);
      return;
    }

    this.ctx.strokeStyle = stroke.color;

    this.ctx.beginPath();

    const points = stroke.points;

    const startX = this.snapToHalfPixel(points[0].x);
    const startY = this.snapToHalfPixel(points[0].y);
    this.ctx.moveTo(startX, startY);

    for (let i = 1; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];

      // Snap coordinates
      const currX = this.snapToHalfPixel(curr.x);
      const currY = this.snapToHalfPixel(curr.y);
      const nextX = this.snapToHalfPixel(next.x);
      const nextY = this.snapToHalfPixel(next.y);

      const midX = (currX + nextX) / 2;
      const midY = (currY + nextY) / 2;

      // Snap line width
      const pressure = curr.pressure;
      const width = stroke.width * (0.5 + pressure * 0.5);
      this.ctx.lineWidth = this.snapLineWidth(width);

      this.ctx.quadraticCurveTo(currX, currY, midX, midY);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(midX, midY);
    }

    const last = points[points.length - 1];
    const lastX = this.snapToHalfPixel(last.x);
    const lastY = this.snapToHalfPixel(last.y);
    const width = stroke.width * (0.5 + last.pressure * 0.5);
    this.ctx.lineWidth = this.snapLineWidth(width);
    this.ctx.lineTo(lastX, lastY);
    this.ctx.stroke();
  }

  /**
   * Incremental rendering methods retained for compatibility. The signature pad
   * previously used these to append segments while drawing. With an overlay
   * "live preview" canvas, you typically do NOT need these anymore.
   */
  appendStrokeSegment(stroke: Stroke, segmentIndex: number) {
    const points = stroke.points;

    if (points.length < 2) {
      if (points.length === 1) {
        this.renderDot(stroke);
      }
      return;
    }

    this.ctx.strokeStyle = stroke.color;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    const startIdx = Math.max(0, segmentIndex - 1);

    for (let i = startIdx; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];

      // Snap all coordinates
      const currX = this.snapToHalfPixel(curr.x);
      const currY = this.snapToHalfPixel(curr.y);
      const nextX = this.snapToHalfPixel(next.x);
      const nextY = this.snapToHalfPixel(next.y);

      const pressure = (curr.pressure + next.pressure) / 2;
      const width = stroke.width * (0.5 + pressure * 0.5);
      this.ctx.lineWidth = this.snapLineWidth(width);

      this.ctx.beginPath();

      if (i === 0) {
        this.ctx.moveTo(currX, currY);
        this.ctx.lineTo(nextX, nextY);
      } else {
        const prev = points[i - 1];
        const prevX = this.snapToHalfPixel(prev.x);
        const prevY = this.snapToHalfPixel(prev.y);
        const midX = (prevX + currX) / 2;
        const midY = (prevY + currY) / 2;

        this.ctx.moveTo(midX, midY);

        if (i === points.length - 2) {
          this.ctx.quadraticCurveTo(currX, currY, nextX, nextY);
        } else {
          const nextMidX = (currX + nextX) / 2;
          const nextMidY = (currY + nextY) / 2;
          this.ctx.quadraticCurveTo(currX, currY, nextMidX, nextMidY);
        }
      }

      this.ctx.stroke();
    }
  }

  appendStrokeSegments(stroke: Stroke, fromPointIndex: number) {
    const startSegmentIndex = Math.max(0, fromPointIndex - 1);
    this.appendStrokeSegment(stroke, startSegmentIndex);
  }
}
