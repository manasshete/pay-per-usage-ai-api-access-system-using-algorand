import { fetchMemory, writeMemory } from "./memoryService.js";
import { routeIntent } from "./routerService.js";
import { runTextAgent } from "./agents/textAgent.js";
import { runImageAgent } from "./agents/imageAgent.js";
import { runVideoAgent } from "./agents/videoAgent.js";
import { runAudioAgent } from "./agents/audioAgent.js";
import { runCodeAgent } from "./agents/codeAgent.js";
import { evaluate } from "./evaluatorService.js";
import { deliver } from "./deliveryService.js";
import { PipelineRun } from "../models/PipelineRun.js";

const AGENT_MAP = {
  text: runTextAgent,
  image: runImageAgent,
  video: runVideoAgent,
  audio: runAudioAgent,
  code: runCodeAgent,
};

const MAX_RETRIES = 2;

export async function runPipeline(userId, inputText, imagePath, onProgress) {
  const run = await PipelineRun.create({
    userId,
    inputText,
    imagePath: imagePath || null,
    chain: [],
    outputs: [],
    status: "running",
  });

  try {
    onProgress?.({ phase: 1, label: "Input received" });

    onProgress?.({ phase: 2, label: "Fetching memory…" });
    const memory = await fetchMemory(userId, inputText);

    onProgress?.({ phase: 3, label: "Routing intent…" });
    const decision = await routeIntent(inputText, memory);
    run.chain = decision.chain || ["text"];
    await run.save();

    onProgress?.({
      phase: 4,
      label: `Running agents: ${run.chain.join(" → ")}`,
    });

    const outputs = [];
    let prior = null;

    for (const agentName of run.chain) {
      onProgress?.({ phase: 4, label: `Running ${agentName} agent…` });
      const agentFn = AGENT_MAP[agentName];
      if (!agentFn) continue;
      try {
        const output =
          agentName === "code"
            ? await agentFn(inputText)
            : await agentFn(inputText, memory, prior);
        outputs.push(output);
        prior = output;
      } catch (agentErr) {
        outputs.push({
          agent: agentName,
          content: null,
          meta: { error: agentErr.message?.slice(0, 200) },
        });
        prior = outputs[outputs.length - 1];
      }
    }

    onProgress?.({ phase: 5, label: "Evaluating quality…" });
    let evalResult = { score: 0.8, passed: true, feedback: "OK" };
    if (outputs.length) {
      const evalTarget =
        outputs.find((o) => o.agent === "text" && o.content) ||
        outputs.filter((o) => o.content).pop() ||
        outputs[outputs.length - 1];
      evalResult = await evaluate(inputText, {
        ...evalTarget,
        agent: run.chain.join("+") || evalTarget.agent,
      });
    }

    let retries = 0;
    while (!evalResult.passed && retries < MAX_RETRIES && outputs.length) {
      retries += 1;
      onProgress?.({
        phase: 5,
        label: `Retrying (${retries})… ${evalResult.feedback}`,
      });
      const lastAgent = run.chain[run.chain.length - 1];
      const retryText = `${inputText}\n\n[CORRECTION]: ${evalResult.feedback}`;
      const retryFn = AGENT_MAP[lastAgent];
      const retryOut =
        lastAgent === "code"
          ? await runCodeAgent(retryText)
          : await retryFn(retryText, memory, outputs[outputs.length - 2] || null);
      outputs[outputs.length - 1] = retryOut;
      evalResult = await evaluate(inputText, retryOut);
    }

    onProgress?.({ phase: 6, label: "Saving to memory…" });
    const summary = `User wanted: ${inputText}. Produced: ${run.chain.join(", ")}. Score: ${(evalResult.score ?? 0).toFixed(2)}.`;
    await writeMemory(userId, summary);

    onProgress?.({ phase: 7, label: "Packaging outputs…" });
    const deliveryUrl = await deliver(run, outputs);

    run.outputs = outputs;
    run.evalScore = evalResult.score;
    run.evalPassed = evalResult.passed;
    run.evalFeedback = evalResult.feedback;
    run.deliveryUrl = deliveryUrl;
    run.status = "completed";
    await run.save();

    onProgress?.({ phase: 7, label: "Done", done: true });
    return run;
  } catch (err) {
    run.status = "failed";
    run.evalFeedback = err.message?.slice(0, 300) || "Pipeline failed";
    await run.save();
    throw err;
  }
}
