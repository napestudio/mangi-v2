import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { TableShape, TableStatus } from "@mangiar/shared";
import { cn } from "@/lib/utils";

export interface FloorPlanTable {
  id: string;
  number: string;
  capacity: number;
  shape: TableShape;
  status: TableStatus;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
  activeOrderCount: number;
}

interface FloorPlanCanvasProps {
  canvasWidth: number;
  canvasHeight: number;
  tables: FloorPlanTable[];
  onTableClick: (table: FloorPlanTable) => void;
  onTableMoved?: (tableId: string, posX: number, posY: number) => void;
  editable?: boolean;
  /** Si es false, las mesas se ven neutras (sin color por estado ni cantidad de pedidos). Default true. */
  showStatus?: boolean;
  /** Mesa con el panel abierto actualmente — se destaca con un anillo para distinguirla rápido. */
  selectedTableId?: string | null;
}

export const STATUS_STYLES: Record<TableStatus, string> = {
  [TableStatus.EMPTY]: "border-emerald-400 bg-green-300 text-emerald-900",
  [TableStatus.OCCUPIED]: "border-red-400 bg-red-300 text-red-900",
  [TableStatus.RESERVED]: "border-amber-400 bg-amber-100 text-amber-900",
  [TableStatus.CLEANING]: "border-sky-400 bg-sky-100 text-sky-900",
  [TableStatus.PAYING]: "border-violet-400 bg-violet-100 text-violet-900",
};

/** Mismo tono que STATUS_STYLES pero como ring, para destacar la mesa seleccionada sin taparle el color de estado. */
const STATUS_RING_STYLES: Record<TableStatus, string> = {
  [TableStatus.EMPTY]: "ring-emerald-500",
  [TableStatus.OCCUPIED]: "ring-red-500",
  [TableStatus.RESERVED]: "ring-amber-500",
  [TableStatus.CLEANING]: "ring-sky-500",
  [TableStatus.PAYING]: "ring-violet-500",
};

const NEUTRAL_TABLE_STYLE =
  "border-neutral-300 bg-neutral-100 text-neutral-600";

const DRAG_THRESHOLD_PX = 4;

interface DragState {
  id: string;
  startClientX: number;
  startClientY: number;
  origX: number;
  origY: number;
  moved: boolean;
}

export function FloorPlanCanvas({
  canvasWidth,
  canvasHeight,
  tables,
  onTableClick,
  onTableMoved,
  editable = false,
  showStatus = true,
  selectedTableId = null,
}: FloorPlanCanvasProps) {
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [prevTables, setPrevTables] = useState(tables);
  const dragState = useRef<DragState | null>(null);

  if (tables !== prevTables) {
    setPrevTables(tables);
    setPositions(
      Object.fromEntries(
        tables.map((table) => [table.id, { x: table.posX, y: table.posY }]),
      ),
    );
  }

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    table: FloorPlanTable,
  ) => {
    if (!editable) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      id: table.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      origX: table.posX,
      origY: table.posY,
      moved: false,
    };
  };

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
    table: FloorPlanTable,
  ) => {
    if (!editable) return;
    const state = dragState.current;
    if (!state || state.id !== table.id) return;

    const dx = event.clientX - state.startClientX;
    const dy = event.clientY - state.startClientY;
    if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
      state.moved = true;
    }

    const nextX = clamp(
      state.origX + dx,
      0,
      Math.max(canvasWidth - table.width, 0),
    );
    const nextY = clamp(
      state.origY + dy,
      0,
      Math.max(canvasHeight - table.height, 0),
    );
    setPositions((prev) => ({ ...prev, [table.id]: { x: nextX, y: nextY } }));
  };

  const handlePointerUp = (
    event: ReactPointerEvent<HTMLDivElement>,
    table: FloorPlanTable,
  ) => {
    if (!editable) {
      onTableClick(table);
      return;
    }

    const state = dragState.current;
    if (!state || state.id !== table.id) return;
    dragState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (state.moved) {
      const pos = positions[table.id] ?? { x: table.posX, y: table.posY };
      onTableMoved?.(table.id, pos.x, pos.y);
    } else {
      onTableClick(table);
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50"
      style={{ width: "100%", height: Math.max(canvasHeight, 400) }}
    >
      {tables.map((table) => {
        const pos = positions[table.id] ?? { x: table.posX, y: table.posY };
        return (
          <div
            key={table.id}
            onPointerDown={(event) => handlePointerDown(event, table)}
            onPointerMove={(event) => handlePointerMove(event, table)}
            onPointerUp={(event) => handlePointerUp(event, table)}
            className={cn(
              "absolute flex touch-none select-none flex-col items-center justify-center border-2 text-xs font-semibold shadow-sm",
              editable
                ? "cursor-grab active:cursor-grabbing"
                : "cursor-pointer",
              table.shape === TableShape.CIRCLE ? "rounded-full" : "rounded-md",
              showStatus ? STATUS_STYLES[table.status] : NEUTRAL_TABLE_STYLE,
              table.id === selectedTableId &&
                cn("z-10 ring-[3px] ring-offset-2 ring-offset-neutral-50", STATUS_RING_STYLES[table.status]),
            )}
            style={{
              left: pos.x,
              top: pos.y,
              width: table.width,
              height: table.height,
              transform: `rotate(${table.rotation}deg)`,
            }}
          >
            <span>{table.number}</span>
            {showStatus && table.activeOrderCount > 1 && (
              <span className="flex w-full flex-wrap items-center justify-center gap-0.5 px-1">
                {Array.from({ length: table.activeOrderCount }).map(
                  (_, index) => (
                    <span
                      key={index}
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70"
                    />
                  ),
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
