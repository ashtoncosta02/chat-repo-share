import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface ResizableColumn {
  key: string;
  label: ReactNode;
  default: number;
  min?: number;
}

interface Props {
  columns: ResizableColumn[];
  storageKey?: string;
  children: ReactNode;
}

export function ResizableTable({ columns, storageKey, children }: Props) {
  const initial = useMemo(() => {
    const base: Record<string, number> = {};
    for (const c of columns) base[c.key] = c.default;
    if (storageKey && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, number>;
          for (const c of columns) {
            const v = parsed[c.key];
            if (typeof v === "number" && v > 0) base[c.key] = v;
          }
        }
      } catch {
        // ignore
      }
    }
    return base;
  }, [columns, storageKey]);

  const [widths, setWidths] = useState<Record<string, number>>(initial);
  const dragRef = useRef<{ key: string; startX: number; startW: number; min: number } | null>(null);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch {
      // ignore
    }
  }, [widths, storageKey]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const next = Math.max(d.min, d.startW + (e.clientX - d.startX));
    setWidths((prev) => ({ ...prev, [d.key]: next }));
  }, []);

  const stopDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDrag);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [onPointerMove]);

  const startDrag = (key: string, min: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { key, startX: e.clientX, startW: widths[key] ?? 120, min };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDrag);
  };

  return (
    <table className="text-sm border-separate border-spacing-0" style={{ width: "max-content", minWidth: "100%", tableLayout: "fixed" }}>
      <colgroup>
        {columns.map((c) => (
          <col key={c.key} style={{ width: `${widths[c.key]}px` }} />
        ))}
      </colgroup>
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
          {columns.map((c, i) => (
            <th
              key={c.key}
              className="relative px-4 py-3 font-medium border-b border-border select-none"
              style={i === 0 ? { paddingLeft: "1.5rem" } : undefined}
            >
              <span className="truncate block pr-2">{c.label}</span>
              {i < columns.length - 1 && (
                <span
                  role="separator"
                  aria-orientation="vertical"
                  onPointerDown={startDrag(c.key, c.min ?? 60)}
                  onDoubleClick={() => setWidths((p) => ({ ...p, [c.key]: c.default }))}
                  className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-10 group flex items-center justify-end"
                  title="Drag to resize • double-click to reset"
                >
                  <span className="h-6 w-px bg-border group-hover:w-0.5 group-hover:bg-[var(--gold)] transition-all" />
                </span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      {children}
    </table>
  );
}
