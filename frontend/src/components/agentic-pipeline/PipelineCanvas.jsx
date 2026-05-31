import React, { useEffect, useRef, useState } from "react";

export default function PipelineCanvas({ children, currentPhase }) {
  const containerRef = useRef(null);
  const [lines, setLines] = useState([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
      const nodes = el.querySelectorAll("[data-node-id]");
      const coords = [];
      nodes.forEach((node) => {
        const r = node.getBoundingClientRect();
        coords.push({
          cx: r.left - rect.left + r.width / 2,
          cy: r.top - rect.top + r.height / 2,
        });
      });
      const next = [];
      for (let i = 0; i < coords.length - 1; i++) {
        next.push({ from: coords[i], to: coords[i + 1], idx: i + 1 });
      }
      setLines(next);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, currentPhase]);

  return (
    <div ref={containerRef} className="relative w-full overflow-x-auto py-2">
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width={size.w}
        height={size.h}
        aria-hidden
      >
        {lines.map((line) => {
          const active = currentPhase >= line.idx + 1;
          return (
            <line
              key={line.idx}
              x1={line.from.cx}
              y1={line.from.cy}
              x2={line.to.cx}
              y2={line.to.cy}
              stroke={active ? "#22c55e" : "#e2e8f0"}
              strokeWidth={2}
            />
          );
        })}
      </svg>
      <div className="relative z-10 flex items-center gap-0 min-w-max">{children}</div>
    </div>
  );
}
