import { useCallback, useReducer } from "react";
import type { BrushId, Point, Stroke } from "./machine";

interface MachineState {
  status: "idle" | "drawing" | "completed";
  strokes: Stroke[];
  currentStroke: Stroke | null;
  redoStack: Stroke[];
}

type MachineAction =
  | { type: "POINTER_DOWN"; point: Point }
  | { type: "POINTER_MOVE"; point: Point }
  | { type: "POINTER_MOVE_BATCH"; points: readonly Point[] }
  | { type: "POINTER_UP" }
  | { type: "CLEAR" }
  | { type: "UNDO" }
  | { type: "REDO" };

export type BrushSelection = Readonly<{
  id: BrushId;
  settings?: Record<string, unknown>;
}>;

interface MachineOptions {
  color?: string;
  width?: number;
  brush?: BrushSelection;
}

/**
 * Important: do NOT distance-filter stabilized points.
 * Filters like Kalman/Holt often output many points that are closer than 0.5px.
 * Dropping those points under-samples the stroke and makes it look jittery.
 *
 * iPad duplicate events are usually true duplicates (same x/y/pressure),
 * so we only remove *exact* duplicates (ignoring timestamp).
 */
function isDuplicatePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y && a.pressure === b.pressure;
}

function machineReducer(
  options: MachineOptions,
): (state: MachineState, action: MachineAction) => MachineState {
  return (state: MachineState, action: MachineAction): MachineState => {
    switch (action.type) {
      case "POINTER_DOWN": {
        const newStroke: Stroke = {
          id: crypto.randomUUID(),
          points: [action.point],
          color: options.color ?? "#1a1a1a",
          width: options.width ?? 2.5,
          brush: {
            id: options.brush?.id ?? "monoline",
            version: 1,
            settings: options.brush?.settings ?? {},
          },
        };

        return {
          ...state,
          status: "drawing",
          currentStroke: newStroke,
        };
      }

      case "POINTER_MOVE": {
        if (state.status !== "drawing" || !state.currentStroke) return state;

        const points = state.currentStroke.points;
        const lastPoint = points[points.length - 1];

        // Filter out true duplicate points only
        if (lastPoint && isDuplicatePoint(lastPoint, action.point)) {
          return state;
        }

        return {
          ...state,
          currentStroke: {
            ...state.currentStroke,
            points: [...points, action.point],
          },
        };
      }

      case "POINTER_MOVE_BATCH": {
        if (state.status !== "drawing" || !state.currentStroke) return state;
        if (action.points.length === 0) return state;

        const existing = state.currentStroke.points;
        const nextPoints = [...existing];

        let appended = 0;

        for (const p of action.points) {
          const last = nextPoints[nextPoints.length - 1];
          if (last && isDuplicatePoint(last, p)) continue;
          nextPoints.push(p);
          appended += 1;
        }

        if (appended === 0) return state;

        return {
          ...state,
          currentStroke: { ...state.currentStroke, points: nextPoints },
        };
      }

      case "POINTER_UP": {
        if (!state.currentStroke) return state;

        return {
          ...state,
          status: "completed",
          strokes: [...state.strokes, state.currentStroke],
          currentStroke: null,
          redoStack: [],
        };
      }

      case "CLEAR": {
        return {
          status: "idle",
          strokes: [],
          currentStroke: null,
          redoStack: [],
        };
      }

      case "UNDO": {
        if (state.strokes.length === 0) return state;
        const lastStroke = state.strokes[state.strokes.length - 1];

        return {
          ...state,
          strokes: state.strokes.slice(0, -1),
          redoStack: [lastStroke, ...state.redoStack],
        };
      }

      case "REDO": {
        if (state.redoStack.length === 0) return state;
        const [firstRedo, ...restRedo] = state.redoStack;

        return {
          ...state,
          strokes: [...state.strokes, firstRedo],
          redoStack: restRedo,
        };
      }

      default:
        return state;
    }
  };
}

export function useSignatureMachine(options: MachineOptions = {}) {
  const [state, dispatch] = useReducer(machineReducer(options), {
    status: "idle",
    strokes: [],
    currentStroke: null,
    redoStack: [],
  });

  const send = useCallback((action: MachineAction) => {
    dispatch(action);
  }, []);

  return {
    state,
    send,
    strokes: state.strokes,
    canUndo: state.strokes.length > 0,
    canRedo: state.redoStack.length > 0,
  };
}
