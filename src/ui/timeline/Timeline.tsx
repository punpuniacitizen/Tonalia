import { useEffect, useRef, useState } from "react";

import { TICKS_PER_BAR } from "../../lib/music";
import { useSong } from "../../stores/song";
import { currentPosition, useTransport } from "../../stores/transport";
import { useUi } from "../../stores/ui";
import { ChordRibbon } from "./ChordRibbon";
import { PAD, tickToX, xToTick } from "./geometry";
import "./Timeline.css";

export function Timeline() {
  const view = useSong((s) => s.view);
  const pxPerBar = useUi((s) => s.pxPerBar);
  const seek = useTransport((s) => s.seek);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(1200);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewport(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ctrl + rueda: zoom horizontal.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const { pxPerBar: current, set } = useUi.getState();
      set({ pxPerBar: Math.min(600, Math.max(60, current * (e.deltaY < 0 ? 1.12 : 1 / 1.12))) });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  if (!view) return null;
  const bars = Math.max(Math.ceil(view.length / TICKS_PER_BAR) + 4, Math.ceil((viewport - PAD) / pxPerBar));
  const width = PAD * 2 + bars * pxPerBar;
  const maxDepth = Math.max(0, ...view.sections.map((s) => s.depth));

  const onRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seek(Math.max(0, xToTick(e.clientX - rect.left, pxPerBar)));
  };

  return (
    <section className="timeline">
      <div className="timeline-scroll" ref={scrollRef}>
        <div className="timeline-content" style={{ width, ["--bar" as string]: `${pxPerBar}px`, ["--pad" as string]: `${PAD}px` }}>
          <div className="ruler" onClick={onRulerClick}>
            {Array.from({ length: bars }, (_, i) => (
              <span key={i} className="ruler-bar" style={{ left: tickToX(i * TICKS_PER_BAR, pxPerBar) }}>
                {i + 1}
              </span>
            ))}
          </div>

          <div className="section-bar" style={{ height: (maxDepth + 1) * 24 }}>
            {view.sections.map((s) => (
              <div
                key={s.id}
                className={`section-pill ${s.isLeaf ? "is-leaf" : ""}`}
                style={{
                  left: tickToX(s.start, pxPerBar),
                  width: s.length * (pxPerBar / TICKS_PER_BAR) - 4,
                  top: s.depth * 24,
                  ["--section-color" as string]: s.color,
                }}
              >
                {s.name}
              </div>
            ))}
          </div>

          <ChordRibbon />

          <Playhead />
        </div>
      </div>
    </section>
  );
}

/** Línea vertical que avanza con la música. Se mueve fuera de React (rAF) para ir fluida. */
function Playhead() {
  const ref = useRef<HTMLDivElement>(null);
  const pxPerBar = useUi((s) => s.pxPerBar);
  const playing = useTransport((s) => s.playing);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      if (ref.current) ref.current.style.transform = `translateX(${tickToX(currentPosition(), pxPerBar)}px)`;
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [pxPerBar]);

  return <div ref={ref} className={`playhead ${playing ? "is-playing" : ""}`} aria-hidden="true" />;
}
