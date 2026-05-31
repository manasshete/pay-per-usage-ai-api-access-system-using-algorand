/** Parse scene visuals / narration from script text (pipe or markdown formats). */

export function parseKeyframeCount(inputText, fallback = 3) {
  const m = String(inputText || "").match(/(\d+)\s*(key\s*frame|keyframe|image)/i);
  if (m) return Math.min(3, Math.max(1, parseInt(m[1], 10)));
  return fallback;
}

export function extractVisualPromptsFromScript(text, max = 3) {
  const prompts = [];
  const t = String(text || "");

  for (const m of t.matchAll(/SCENE\s*(\d+)\s*:\s*([^|\n]+)/gi)) {
    let visual = m[2].replace(/\*\*/g, "").trim();
    visual = visual.replace(/^\[.*?\]\s*/i, "").trim();
    if (visual.length > 12) prompts.push(visual);
  }
  if (prompts.length) return [...new Set(prompts)].slice(0, max);

  const blocks = t.split(/(?=#{0,3}\s*SCENE\s*\d+)/i);
  for (const block of blocks) {
    if (!/SCENE\s*\d+/i.test(block)) continue;
    const vd = block.match(
      /Visual\s*Description\s*:?\s*\*?\*?\s*([\s\S]*?)(?=\n\s*\*?\*?(?:NARRATION|Audio|Sound)|\n#{0,3}\s*SCENE|\n---|\[KEYFRAME|$)/i
    );
    if (vd?.[1]) {
      const visual = vd[1]
        .replace(/\*\*/g, "")
        .replace(/\n+/g, " ")
        .trim();
      if (visual.length > 12) prompts.push(visual);
    }
  }
  if (prompts.length) return [...new Set(prompts)].slice(0, max);

  const scene1 = t.match(/SCENE\s*1\s*:?\s*([^\n]+)/i);
  if (scene1?.[1]) {
    return [scene1[1].replace(/\*\*/g, "").trim()].slice(0, max);
  }

  return [];
}

export function extractNarrationFromScript(text) {
  const t = String(text || "");
  const parts = [];

  for (const m of t.matchAll(/NARRATION\s*:?\s*\*?\*?\s*([^\n]+)/gi)) {
    const line = m[1].replace(/\*\*/g, "").trim();
    if (line) parts.push(line);
  }
  if (parts.length) return parts.join(" ");

  const blocks = t.split(/(?=#{0,3}\s*SCENE\s*\d+)/i);
  for (const block of blocks) {
    const nar = block.match(
      /NARRATION\s*:?\s*\*?\*?\s*([\s\S]*?)(?=\n\s*\*?\*?(?:Audio|Sound|SCENE)|\n---|$)/i
    );
    if (nar?.[1]) {
      const line = nar[1].replace(/\*\*/g, "").replace(/\n+/g, " ").trim();
      if (line) parts.push(line);
    }
  }

  return parts.join(" ").trim();
}
