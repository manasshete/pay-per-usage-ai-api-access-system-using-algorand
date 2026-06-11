import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client.js";
import { useAgenticPipeline } from "../../../hooks/useAgenticPipeline.js";
import PipelineBuilder from "./PipelineBuilder.jsx";
import RunHistory from "./RunHistory.jsx";
import Templates from "./Templates.jsx";

const TABS = [
  { id: "builder", label: "Pipeline Builder" },
  { id: "history", label: "Run History" },
  { id: "templates", label: "Templates" },
];

export default function AgenticPipeline() {
  const [tab, setTab] = useState("builder");
  const [selectedRun, setSelectedRun] = useState(null);

  const { data: usage } = useQuery({
    queryKey: ["studio-usage"],
    queryFn: async () => (await api.get("/api/studio/usage")).data,
  });
  const creditsLow = false;

  const pipeline = useAgenticPipeline({ atCap: false });

  useEffect(() => {
    pipeline.loadHistory();
  }, [pipeline.loadHistory]);

  useEffect(() => {
    if (tab === "history") pipeline.loadHistory();
  }, [tab, pipeline.loadHistory]);

  return (
    <div className="pt-6">
      <header className="mb-6">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-[#031634] text-3xl">hub</span>
          <div>
            <h1 className="font-headline text-2xl font-semibold text-primary">Agentic Pipeline</h1>
            <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
              Seven-phase multimodal automation — memory, routing, Gemini agents, evaluation, and
              delivery.
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Pay-per-Call Mode · Micropayments enabled
            </p>
          </div>
        </div>
      </header>

      <div className="flex gap-1 border-b border-surface-variant mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-[#031634] text-primary"
                : "border-transparent text-on-surface-variant hover:text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "builder" && <PipelineBuilder pipeline={pipeline} />}
      {tab === "history" && (
        <RunHistory
          history={pipeline.history}
          selectedRun={selectedRun}
          onSelect={setSelectedRun}
        />
      )}
      {tab === "templates" && (
        <Templates
          onUse={(prompt, runType = "agentic_text") => {
            pipeline.setInputText(prompt);
            pipeline.setRunType(runType);
            setTab("builder");
          }}
        />
      )}
    </div>
  );
}
