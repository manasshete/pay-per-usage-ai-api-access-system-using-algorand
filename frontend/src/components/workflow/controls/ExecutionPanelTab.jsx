import React from "react";

/** Vertical tab to reopen the execution panel when it is closed. */
export default function ExecutionPanelTab({ onOpen, run, isRunning }) {
  const hasData =
    run?.status ||
    (run?.nodeResults?.length || 0) > 0 ||
    (run?.logs?.length || 0) > 0;

  if (!hasData) return null;

  const complete = run?.status === "completed";
  const failed = run?.status === "failed";

  return (
    <button
      type="button"
      onClick={onOpen}
      title="Open execution panel"
      className={`
        fixed right-0 top-1/2 -translate-y-1/2 z-40
        flex flex-col items-center gap-1 py-4 px-2 rounded-l-xl shadow-lg border border-r-0
        text-[10px] font-bold uppercase tracking-wide
        transition-all hover:pr-3
        ${
          complete
            ? "bg-emerald-600 border-emerald-700 text-white"
            : failed
              ? "bg-rose-600 border-rose-700 text-white"
              : isRunning
                ? "bg-cyan-600 border-cyan-700 text-white animate-pulse"
                : "bg-[#031634] border-[#031634] text-white"
        }
      `}
    >
      <span className="material-symbols-outlined text-lg">chevron_left</span>
      <span className="[writing-mode:vertical-rl] rotate-180">Results</span>
      {complete && (
        <span className="material-symbols-outlined text-base">check_circle</span>
      )}
    </button>
  );
}
