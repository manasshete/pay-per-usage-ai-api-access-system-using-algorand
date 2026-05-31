import React, { memo, useCallback } from "react";
import { Position } from "@xyflow/react";
import NodeShell from "./NodeShell.jsx";
import { useWorkflow } from "../../../context/WorkflowContext.jsx";
import { useNodeExecution } from "../../../context/NodeExecutionContext.jsx";
import { openWorkflowExecutionPanel } from "../../../utils/workflowUi.js";

const FORMATS = [
  { value: "summary", label: "Summary (sections)" },
  { value: "json", label: "JSON schema" },
  { value: "report", label: "Full report" },
];

function OutputNode({ id, data, selected }) {
  const { nodes, setNodes } = useWorkflow();
  const { nodeStatuses } = useNodeExecution();
  const status = nodeStatuses[id] || "idle";
  const isDone = status === "success" || status === "completed";

  const update = useCallback(
    (patch) => {
      setNodes(nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [id, nodes, setNodes]
  );

  return (
    <NodeShell
      id={id}
      selected={selected}
      data={data}
      inputPosition={Position.Top}
      outputs={[]}
      nodeType="output"
    >
      {isDone && (
        <button
          type="button"
          className="nodrag nopan mb-2 w-full flex items-center gap-1.5 rounded-md bg-emerald-100 border border-emerald-300 px-2 py-1.5 hover:bg-emerald-200 transition-colors cursor-pointer text-left"
          onClick={(e) => {
            e.stopPropagation();
            openWorkflowExecutionPanel();
          }}
        >
          <span className="material-symbols-outlined text-emerald-700 text-base">check_circle</span>
          <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wide">
            Results ready — open panel →
          </span>
        </button>
      )}
      <p className="text-[10px] text-on-surface-variant mb-1">Structured format</p>
      <select
        className="nodrag nopan workflow-field w-full text-[11px] border border-surface-variant rounded-md px-2 py-1 bg-white text-primary"
        value={data?.outputFormat || "summary"}
        onChange={(e) => update({ outputFormat: e.target.value })}
        onClick={(e) => e.stopPropagation()}
      >
        {FORMATS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <p className="text-[9px] text-slate-400 mt-1.5">
        Aggregates all upstream steps into the execution panel
      </p>
    </NodeShell>
  );
}

export default memo(OutputNode);
