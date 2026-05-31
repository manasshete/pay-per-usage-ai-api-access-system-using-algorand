import React from "react";

export default function PipelineNode({ node, currentPhase }) {
  const done = currentPhase > node.phase;
  const active = currentPhase === node.phase;

  return (
    <div
      data-node-id={node.id}
      className={`flex flex-col items-center text-center px-3 py-2 rounded-md border min-w-[100px] shrink-0 transition-colors ${
        done
          ? "border-emerald-300 bg-emerald-50"
          : active
            ? "border-[#031634] bg-slate-100"
            : "border-surface-variant bg-white"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full mb-1 ${done ? "bg-emerald-500" : active ? "bg-[#031634]" : "bg-slate-300"}`}
      />
      <span className="text-[11px] font-semibold text-primary">{node.label}</span>
      <span className="text-[10px] text-on-surface-variant">{node.sub}</span>
    </div>
  );
}
