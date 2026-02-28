export type Point = {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
};

export type BrushId =
  | "monoline"
  | "uni-jetstream"
  | "sharpie-fine"
  | "sharpie-brush"
  | "tombow-fudenosuke";

export type BrushMeta = Readonly<{
  id: BrushId;
  version: 1;
  settings: Record<string, unknown>;
}>;

export type Stroke = {
  id: string;
  points: Point[];
  color: string;
  width: number;
  brush: BrushMeta;
};

export type SignatureState =
  | { status: "idle" }
  | { status: "drawing"; currentStroke: Stroke }
  | { status: "completed"; strokes: Stroke[] }
  | { status: "erasing" };

export type SignatureEvent =
  | { type: "POINTER_DOWN"; point: Point }
  | { type: "POINTER_MOVE"; point: Point }
  | { type: "POINTER_UP" }
  | { type: "CLEAR" }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "EXPORT_SVG" };
