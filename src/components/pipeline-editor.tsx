"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { moveCardViaTransitionAction } from "@/app/actions";

type Transition = {
  id: string;
  sourceColumnId: string;
  targetColumnId: string;
  available: boolean;
};

type Path = Transition & { d: string };

function curve(x1: number, y1: number, x2: number, y2: number) {
  const bend = Math.max(80, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

export function PipelineEditor({ transitions, children }: { transitions: Transition[]; children: ReactNode }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLElement>(null);
  const [paths, setPaths] = useState<Path[]>([]);
  const [draft, setDraft] = useState<{ cardId: string; x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [allowedTargets, setAllowedTargets] = useState<string[]>([]);
  const [hint, setHint] = useState("Потяните выход карточки, чтобы увидеть разрешённый следующий этап");

  const pointInCanvas = useCallback((element: Element) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const canvasBox = canvas.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return {
      x: box.left - canvasBox.left + canvas.scrollLeft + box.width / 2,
      y: box.top - canvasBox.top + canvas.scrollTop + box.height / 2
    };
  }, []);

  const rebuildPaths = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setPaths(
      transitions.flatMap((transition) => {
        const source = canvas.querySelector(`[data-stage-source-port="${transition.sourceColumnId}"]`);
        const target = canvas.querySelector(`[data-target-port="${transition.targetColumnId}"]`);
        if (!source || !target) return [];
        const a = pointInCanvas(source);
        const b = pointInCanvas(target);
        return [{ ...transition, d: curve(a.x, a.y, b.x, b.y) }];
      })
    );
  }, [transitions, pointInCanvas]);

  useEffect(() => {
    rebuildPaths();
    const observer = new ResizeObserver(rebuildPaths);
    if (canvasRef.current) observer.observe(canvasRef.current);
    window.addEventListener("resize", rebuildPaths);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", rebuildPaths);
    };
  }, [rebuildPaths]);

  function startConnection(event: PointerEvent<HTMLElement>, port: HTMLElement) {
    const cardId = port.dataset.sourcePort;
    const sourceColumnId = port.dataset.currentColumn;
    if (!cardId || !sourceColumnId) return;
    const targets = transitions.filter((item) => item.sourceColumnId === sourceColumnId && item.available).map((item) => item.targetColumnId);
    event.preventDefault();
    port.setPointerCapture(event.pointerId);
    const start = pointInCanvas(port);
    setAllowedTargets(targets);
    setDraft({ cardId, x1: start.x, y1: start.y, x2: start.x, y2: start.y });
    setHint(targets.length ? "Подсвечен разрешённый следующий этап" : "Следующий этап недоступен или достиг его лимит");
  }

  function moveConnection(event: PointerEvent<HTMLElement>) {
    if (!draft || !canvasRef.current) return;
    const box = canvasRef.current.getBoundingClientRect();
    setDraft({ ...draft, x2: event.clientX - box.left + canvasRef.current.scrollLeft, y2: event.clientY - box.top + canvasRef.current.scrollTop });
  }

  async function finishConnection(event: PointerEvent<HTMLElement>) {
    if (!draft) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-target-port]");
    const targetColumnId = target?.dataset.targetPort;
    setDraft(null);
    setAllowedTargets([]);
    setHint("Потяните выход карточки, чтобы увидеть разрешённый следующий этап");
    if (!targetColumnId || !allowedTargets.includes(targetColumnId)) return;
    await moveCardViaTransitionAction(draft.cardId, targetColumnId);
    router.refresh();
  }

  return (
    <section
      ref={canvasRef}
      className={`pipeline-canvas ${draft ? "is-connecting" : ""}`}
      onPointerMove={moveConnection}
      onPointerUp={finishConnection}
      onScroll={rebuildPaths}
    >
      <div className="connector-hint">{hint}</div>
      <svg className="connection-layer" aria-label="Разрешённые переходы между этапами">
        {paths.map((path) => <path key={path.id} d={path.d} className="saved-connection" />)}
        {draft && <path d={curve(draft.x1, draft.y1, draft.x2, draft.y2)} className="draft-connection" />}
      </svg>
      <div
        className="pipeline-content"
        data-allowed-targets={allowedTargets.join(",")}
        onPointerDown={(event) => {
          const port = (event.target as HTMLElement).closest<HTMLElement>("[data-source-port]");
          if (port) startConnection(event, port);
        }}
      >
        {children}
      </div>
      {allowedTargets.map((targetId) => <style key={targetId}>{`[data-target-port="${targetId}"]{opacity:1!important;transform:scale(1.65);background:#32e6a1!important;box-shadow:0 0 24px #32e6a1!important}`}</style>)}
    </section>
  );
}
