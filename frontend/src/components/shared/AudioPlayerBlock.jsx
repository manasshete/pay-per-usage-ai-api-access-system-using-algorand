import React from "react";
import { mediaSrc } from "../../utils/mediaUrl.js";

export default function AudioPlayerBlock({ audio, label = "Voiceover", className = "" }) {
  const src = mediaSrc(audio);
  if (!src) return null;

  const downloadName =
    typeof audio === "object" && audio?.url?.includes(".mp3") ? "voiceover.mp3" : "voiceover.wav";

  return (
    <section className={`rounded-md bg-white border border-slate-100 p-3 space-y-2 ${className}`}>
      <h4 className="text-[10px] font-bold text-slate-500 uppercase">{label}</h4>
      <audio controls preload="metadata" className="w-full" src={src}>
        <track kind="captions" />
      </audio>
      <a
        href={src}
        download={downloadName}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#031634] hover:underline"
      >
        <span className="material-symbols-outlined text-sm">download</span>
        Download audio
      </a>
    </section>
  );
}
