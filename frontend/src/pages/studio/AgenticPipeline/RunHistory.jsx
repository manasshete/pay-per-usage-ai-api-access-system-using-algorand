import React from "react";
import OutputViewer from "../../../components/agentic-pipeline/OutputViewer.jsx";

export default function RunHistory({ history, selectedRun, onSelect }) {
  if (!history?.length) {
    return (
      <div className="rounded-md border border-dashed border-surface-variant p-12 text-center text-sm text-on-surface-variant">
        No pipeline runs yet. Use the Builder tab to start.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-2">
        {history.map((run) => (
          <button
            key={run._id}
            type="button"
            onClick={() => onSelect?.(run)}
            className={`w-full text-left rounded-md border p-3 transition-colors ${
              selectedRun?._id === run._id
                ? "border-[#031634] bg-slate-50"
                : "border-surface-variant bg-white hover:border-slate-300"
            }`}
          >
            <p className="text-sm font-medium text-primary truncate">{run.inputText}</p>
            <p className="text-[11px] text-on-surface-variant mt-1">
              {run.chain?.join(" → ")} · {new Date(run.createdAt).toLocaleString()}
            </p>
            <span
              className={`inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded ${
                run.status === "completed"
                  ? "bg-emerald-100 text-emerald-800"
                  : run.status === "failed"
                    ? "bg-rose-100 text-rose-800"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {run.status}
            </span>
          </button>
        ))}
      </div>
      <div>{selectedRun ? <OutputViewer run={selectedRun} /> : null}</div>
    </div>
  );
}
