export const WORKFLOW_OPEN_EXECUTION_PANEL = "sentinal-workflow-open-execution-panel";

export function openWorkflowExecutionPanel() {
  window.dispatchEvent(new CustomEvent(WORKFLOW_OPEN_EXECUTION_PANEL));
}
