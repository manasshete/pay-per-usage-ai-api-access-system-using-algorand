import React from "react";

const TEMPLATES = [
  {
    title: "Promo video",
    description: "Script → key frames → cinematic video",
    chain: ["text", "image", "video"],
    prompt: "Create a 30-second cinematic promo video for my product",
  },
  {
    title: "Blog post",
    description: "Research and write SEO content",
    chain: ["text"],
    prompt: "Write a comprehensive SEO blog post about ",
  },
  {
    title: "Podcast voiceover",
    description: "Script → TTS narration",
    chain: ["text", "audio"],
    prompt: "Write and narrate a 2-minute podcast intro about ",
  },
  {
    title: "Image series",
    description: "Creative brief → images",
    chain: ["text", "image"],
    prompt: "Generate a cinematic image series for ",
  },
  {
    title: "Data script",
    description: "Python automation",
    chain: ["code"],
    prompt: "Write a Python script that ",
  },
];

export default function Templates({ onUse }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {TEMPLATES.map((t) => (
        <div
          key={t.title}
          className="bg-white border border-surface-variant rounded-md p-4 flex flex-col gap-2"
        >
          <div className="flex flex-wrap gap-1">
            {t.chain.map((c) => (
              <span
                key={c}
                className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700"
              >
                {c}
              </span>
            ))}
          </div>
          <h3 className="text-sm font-semibold text-primary">{t.title}</h3>
          <p className="text-xs text-on-surface-variant flex-1">{t.description}</p>
          <button
            type="button"
            onClick={() => onUse(t.prompt)}
            className="mt-2 text-xs font-semibold py-2 rounded-md bg-[#031634] text-white hover:opacity-95"
          >
            Use template
          </button>
        </div>
      ))}
    </div>
  );
}
