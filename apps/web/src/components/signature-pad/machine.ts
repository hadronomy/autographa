export type Point = { x: number; y: number; pressure: number; timestamp: number };

export type Stroke = {
  id: string;
  points: Point[];
  color: string;
  width: number;
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
