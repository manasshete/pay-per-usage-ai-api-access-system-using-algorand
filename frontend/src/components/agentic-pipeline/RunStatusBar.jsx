import React from "react";

export default function RunStatusBar({ phases, currentPhase, phaseLabel }) {
  return (
    <div className="rounded-md border border-surface-variant bg-slate-50 p-4">
      <div className="flex gap-2 mb-2 flex-wrap">
        {phases.map((phase) => (
          <span
            key={phase.id}
            title={phase.label}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              phase.id < currentPhase
                ? "bg-emerald-500"
                : phase.id === currentPhase
                  ? "bg-[#031634] scale-125"
                  : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <p className="text-sm text-primary font-medium flex items-center gap-2">
        <span className="inline-block w-3 h-3 border-2 border-[#031634] border-t-transparent rounded-full animate-spin" />
        {phaseLabel || "Running…"}
      </p>
    </div>
  );
}
