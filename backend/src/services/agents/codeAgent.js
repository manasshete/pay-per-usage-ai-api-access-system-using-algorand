import fs from "fs";
import path from "path";
import os from "os";
import { execSync, spawnSync } from "child_process";
import { geminiGenerateContent } from "../../utils/geminiRest.js";

const USE_DOCKER = process.env.CODE_SANDBOX === "docker";

function stripMarkdownFences(text) {
  return String(text || "")
    .replace(/```(?:python)?\n?/g, "")
    .replace(/```/g, "")
    .trim();
}

async function generateCode(inputText) {
  const system = `You are an expert Python developer.
Return ONLY a Python code block — no markdown fences, no explanation.
The code must be self-contained, safe (no network calls, no os.system), and print its result.`;

  const { text } = await geminiGenerateContent("gemini-2.0-flash", {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: inputText }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
  });
  return stripMarkdownFences(text);
}

function runInDocker(code) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentinal-"));
  const tmpFile = path.join(tmpDir, "script.py");
  fs.writeFileSync(tmpFile, code);

  const result = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "--network",
      "none",
      "--memory",
      "128m",
      "--cpus",
      "0.5",
      "-v",
      `${tmpFile}:/sandbox/script.py:ro`,
      "python:3.11-slim",
      "python",
      "/sandbox/script.py",
    ],
    { timeout: 30000 }
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
  return {
    stdout: result.stdout?.toString().trim() || "",
    stderr: result.stderr?.toString().trim() || "",
  };
}

function runRestricted(code) {
  const tmpFile = path.join(os.tmpdir(), `sentinal_${Date.now()}.py`);
  fs.writeFileSync(tmpFile, code);
  let stdout = "";
  let stderr = "";
  try {
    stdout = execSync(`python "${tmpFile}"`, {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    }).toString().trim();
  } catch (e) {
    stderr = e.stderr?.toString() || e.message;
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  }
  return { stdout, stderr };
}

export async function runCodeAgent(inputText) {
  const code = await generateCode(inputText);
  const { stdout, stderr } = USE_DOCKER ? runInDocker(code) : runRestricted(code);

  return {
    agent: "code",
    content: stdout || stderr,
    meta: { model: "gemini-2.0-flash", code, sandboxed: USE_DOCKER },
  };
}
