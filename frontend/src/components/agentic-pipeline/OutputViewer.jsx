import React from "react";
import { mediaSrc } from "../../utils/mediaUrl.js";
import AudioPlayerBlock from "../shared/AudioPlayerBlock.jsx";

function imageSources(output) {
  if (Array.isArray(output.content) && output.content.length) return output.content;
  if (output.meta?.imageUrls?.length) return output.meta.imageUrls;
  if (output.meta?.dataUrls?.length) return output.meta.dataUrls;
  return [];
}

export default function OutputViewer({ run }) {
  if (!run?.outputs?.length) return null;
  const visibleOutputs = run.outputs.filter(
    (output) => !(output.agent === "audio" && output.meta?.integratedIntoVideo)
  );

  return (
    <div className="rounded-md border border-surface-variant bg-white overflow-hidden text-sm">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-50 border-b border-surface-variant">
        <span className="text-sm font-semibold text-primary">
          Score: {run.evalScore != null ? `${(run.evalScore * 100).toFixed(0)}%` : "—"}
        </span>
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
            run.evalPassed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
          }`}
        >
          {run.evalPassed ? "Passed" : "Needs work"}
        </span>
        {run.evalFeedback && (
          <span className="text-xs text-on-surface-variant italic">{run.evalFeedback}</span>
        )}
        {run.chain?.length > 0 && (
          <span className="text-[11px] text-slate-500 ml-auto font-mono">{run.chain.join(" → ")}</span>
        )}
      </div>

      {visibleOutputs.map((output, i) => (
        <div key={i} className="p-4 border-b border-surface-variant last:border-0">
          <p className="text-[10px] font-semibold uppercase text-slate-500 mb-2">
            {output.agent} output
          </p>

          {output.agent === "text" && (
            <pre className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
              {output.content}
            </pre>
          )}

          {output.agent === "image" && (
            <div className="flex flex-wrap gap-2">
              {imageSources(output).map((src, idx) => {
                const url = mediaSrc(src);
                return url ? (
                  <img
                    key={idx}
                    src={url}
                    alt={`Generated ${idx + 1}`}
                    className="w-48 aspect-video object-cover rounded-md border border-slate-200"
                  />
                ) : null;
              })}
            </div>
          )}

          {output.agent === "video" && (
            <div className="text-sm text-slate-600">
              {output.content ? (
                <>
                  {mediaSrc(output.content) ? (
                    <video
                      controls
                      className="w-full max-w-lg rounded-md border border-slate-200"
                      src={mediaSrc(output.content)}
                    />
                  ) : (
                    <p>
                      Video URI:{" "}
                      <code className="text-xs bg-slate-100 px-1 rounded">{output.content}</code>
                    </p>
                  )}
                  {output.meta?.error && (
                    <span className="block mt-1 text-amber-700 text-xs">{output.meta.error}</span>
                  )}
                  {output.meta?.reason && (
                    <span className="block mt-1 text-amber-700 text-xs">{output.meta.reason}</span>
                  )}
                </>
              ) : (
                <span className="text-on-surface-variant">Video step skipped or unavailable.</span>
              )}
            </div>
          )}

          {output.agent === "audio" && (
            <AudioPlayerBlock
              audio={
                output.meta?.audioUrl
                  ? { url: output.meta.audioUrl }
                  : typeof output.content === "string"
                    ? output.content
                    : null
              }
              className="border-0 p-0 max-w-md"
            />
          )}

          {output.agent === "code" && (
            <div className="space-y-2">
              {output.meta?.code && (
                <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-md overflow-x-auto">
                  {output.meta.code}
                </pre>
              )}
              <pre className="text-sm text-slate-700 whitespace-pre-wrap">{output.content}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
