import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { streamPipelineRun, fetchPipelineRuns } from "../api/agenticPipeline.js";
import { playCompletionSound } from "../utils/completionSound.js";

export const PIPELINE_PHASES = [
  { id: 1, label: "Input received" },
  { id: 2, label: "Memory fetch" },
  { id: 3, label: "Intent routing" },
  { id: 4, label: "Agent execution" },
  { id: 5, label: "Quality evaluation" },
  { id: 6, label: "Memory write" },
  { id: 7, label: "Delivery" },
];

export const CHAIN_NODES = [
  { id: "input", label: "Your prompt", sub: "Text / image", phase: 1 },
  { id: "memory", label: "Memory", sub: "embeddings", phase: 2 },
  { id: "router", label: "Router", sub: "gemini-flash", phase: 3 },
  { id: "agents", label: "Agents", sub: "text · image · video", phase: 4 },
  { id: "eval", label: "Evaluator", sub: "quality score", phase: 5 },
  { id: "memwrite", label: "Memory write", sub: "vector store", phase: 6 },
  { id: "deliver", label: "Delivery", sub: "outputs", phase: 7 },
];

export function useAgenticPipeline({ atCap = false } = {}) {
  const queryClient = useQueryClient();
  const [inputText, setInputText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  const loadHistory = useCallback(async () => {
    try {
      const runs = await fetchPipelineRuns();
      setHistory(runs);
    } catch {
      /* ignore */
    }
  }, []);

  const run = useCallback(() => {
    if (atCap) {
      toast.error("Monthly Studio AI limit reached.");
      return;
    }
    if (!inputText.trim()) {
      toast.error("Enter a prompt first.");
      return;
    }

    setIsRunning(true);
    setCurrentPhase(1);
    setResult(null);
    setError(null);

    streamPipelineRun(inputText, imageFile, {
      onProgress: (event) => {
        setCurrentPhase(event.phase || 0);
        setPhaseLabel(event.label || "");
      },
      onComplete: (event) => {
        setResult(event.run);
        setIsRunning(false);
        setCurrentPhase(7);
        queryClient.invalidateQueries({ queryKey: ["studio-usage"] });
        playCompletionSound();
        toast.success("Pipeline complete — scroll down for outputs", { duration: 5000 });
        loadHistory();
        window.dispatchEvent(new CustomEvent("agenticPipelineComplete"));
      },
      onError: (msg) => {
        const text = typeof msg === "string" ? msg : msg?.message || "Pipeline failed";
        setError(text);
        setIsRunning(false);
        toast.error(text);
      },
    });
  }, [inputText, imageFile, atCap, loadHistory, queryClient]);

  return {
    inputText,
    setInputText,
    imageFile,
    setImageFile,
    isRunning,
    currentPhase,
    phaseLabel,
    result,
    error,
    setError,
    history,
    loadHistory,
    run,
    phases: PIPELINE_PHASES,
    chainNodes: CHAIN_NODES,
  };
}
