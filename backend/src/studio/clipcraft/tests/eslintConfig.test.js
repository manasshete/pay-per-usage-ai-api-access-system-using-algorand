// @filename: backend/src/studio/clipcraft/tests/eslintConfig.test.js

import { Linter } from "eslint";
import { ok, test } from "./helpers/assert.js";

// Import the two ESLint configs under test
import baseConfig from "../../../../eslint.config.mjs";
import bugsConfig from "../../../../eslint-bugs.config.mjs";

// ── helpers ──────────────────────────────────────────────────────────────────

function lint(config, code) {
  const l = new Linter({ configType: "flat" });
  return l.verify(code, config);
}

function violationsFor(config, code, ruleId) {
  return lint(config, code).filter((m) => m.ruleId === ruleId);
}

/**
 * Returns the rule value from the LAST (user-defined) config entry only.
 * This deliberately excludes js.configs.recommended so tests reflect what
 * the config author explicitly set.
 */
function userRuleValue(config, ruleId) {
  const userEntry = config[config.length - 1];
  if (userEntry?.rules && Object.prototype.hasOwnProperty.call(userEntry.rules, ruleId)) {
    return userEntry.rules[ruleId];
  }
  return undefined;
}

function userHasRule(config, ruleId) {
  return userRuleValue(config, ruleId) !== undefined;
}

// ── eslint.config.mjs (base config) structure tests ──────────────────────────

export async function runEslintConfigTests() {
  const results = [];

  results.push(
    await test("base config exports an array", () => {
      ok(Array.isArray(baseConfig), "Expected config to be an array");
    })
  );

  results.push(
    await test("base config array is non-empty", () => {
      ok(baseConfig.length > 0, "Expected config array to have at least one entry");
    })
  );

  results.push(
    await test("base config contains a languageOptions entry", () => {
      const hasLangOpts = baseConfig.some((entry) => entry.languageOptions != null);
      ok(hasLangOpts, "Expected at least one config entry with languageOptions");
    })
  );

  results.push(
    await test("base config sets ecmaVersion to 2022", () => {
      const entry = baseConfig.find((e) => e.languageOptions?.ecmaVersion != null);
      ok(entry != null, "Expected a config entry with languageOptions.ecmaVersion");
      ok(entry.languageOptions.ecmaVersion === 2022, "Expected ecmaVersion 2022");
    })
  );

  results.push(
    await test("base config sets sourceType to module", () => {
      const entry = baseConfig.find((e) => e.languageOptions?.sourceType != null);
      ok(entry != null, "Expected a config entry with languageOptions.sourceType");
      ok(entry.languageOptions.sourceType === "module", "Expected sourceType 'module'");
    })
  );

  results.push(
    await test("base config includes node globals", () => {
      const entry = baseConfig.find((e) => e.languageOptions?.globals != null);
      ok(entry != null, "Expected a config entry with languageOptions.globals");
      const g = entry.languageOptions.globals;
      ok(
        "process" in g || "require" in g || "Buffer" in g,
        "Expected node globals (process, require, or Buffer) to be present"
      );
    })
  );

  results.push(
    await test("base config user entry defines no-unused-vars as error array with ^_ pattern", () => {
      ok(userHasRule(baseConfig, "no-unused-vars"), "Expected no-unused-vars in user config entry");
      const val = userRuleValue(baseConfig, "no-unused-vars");
      ok(Array.isArray(val), "Expected no-unused-vars to be an array config [severity, options]");
      const severity = val[0];
      ok(severity === "error" || severity === 2, "Expected no-unused-vars severity to be 'error'");
      ok(val[1]?.argsIgnorePattern === "^_", "Expected argsIgnorePattern '^_'");
    })
  );

  results.push(
    await test("base config user entry defines no-console as off", () => {
      ok(userHasRule(baseConfig, "no-console"), "Expected no-console in user config entry");
      const val = userRuleValue(baseConfig, "no-console");
      ok(val === "off" || val === 0, "Expected no-console to be 'off'");
    })
  );

  // The user-defined entry in eslint.config.mjs must NOT override the bugs-specific rules;
  // those belong exclusively to eslint-bugs.config.mjs.
  results.push(
    await test("base config user entry does not override no-useless-assignment", () => {
      ok(
        !userHasRule(baseConfig, "no-useless-assignment"),
        "Expected no-useless-assignment not to be explicitly set in base config user entry"
      );
    })
  );

  results.push(
    await test("base config user entry does not override no-useless-catch", () => {
      ok(
        !userHasRule(baseConfig, "no-useless-catch"),
        "Expected no-useless-catch not to be explicitly set in base config user entry"
      );
    })
  );

  results.push(
    await test("base config user entry does not override no-constant-binary-expression", () => {
      ok(
        !userHasRule(baseConfig, "no-constant-binary-expression"),
        "Expected no-constant-binary-expression not to be explicitly set in base config user entry"
      );
    })
  );

  results.push(
    await test("base config user entry does not override no-undef", () => {
      ok(
        !userHasRule(baseConfig, "no-undef"),
        "Expected no-undef not to be explicitly set in base config user entry"
      );
    })
  );

  results.push(
    await test("base config user entry does not override no-empty", () => {
      ok(
        !userHasRule(baseConfig, "no-empty"),
        "Expected no-empty not to be explicitly set in base config user entry"
      );
    })
  );

  // ── Behavioural tests for base config ──

  results.push(
    await test("base config: no-console does not flag console.log", () => {
      const msgs = violationsFor(baseConfig, "console.log('hello');", "no-console");
      ok(msgs.length === 0, "Expected no violations for console.log when no-console is off");
    })
  );

  results.push(
    await test("base config: no-unused-vars flags a genuinely unused variable", () => {
      const msgs = violationsFor(baseConfig, "const unused = 42;", "no-unused-vars");
      ok(msgs.length > 0, "Expected no-unused-vars to flag an unused const");
    })
  );

  results.push(
    await test("base config: no-unused-vars does not flag underscore-prefixed arg", () => {
      const code = "export function handler(_req) { return 'ok'; }";
      const msgs = violationsFor(baseConfig, code, "no-unused-vars");
      const argViolations = msgs.filter((m) => m.message.includes("_req"));
      ok(argViolations.length === 0, "Expected _req arg to be ignored by argsIgnorePattern");
    })
  );

  results.push(
    await test("base config: no-unused-vars flags an arg not matching ^_", () => {
      const code = "export function handler(req) { return 'ok'; }";
      const msgs = violationsFor(baseConfig, code, "no-unused-vars");
      const argViolations = msgs.filter((m) => m.message.includes("req"));
      ok(argViolations.length > 0, "Expected req (no underscore prefix) to be flagged");
    })
  );

  // ── eslint-bugs.config.mjs (bugs config) structure tests ──

  results.push(
    await test("bugs config exports an array", () => {
      ok(Array.isArray(bugsConfig), "Expected bugs config to be an array");
    })
  );

  results.push(
    await test("bugs config array is non-empty", () => {
      ok(bugsConfig.length > 0, "Expected bugs config array to have at least one entry");
    })
  );

  results.push(
    await test("bugs config sets ecmaVersion to 2022", () => {
      const entry = bugsConfig.find((e) => e.languageOptions?.ecmaVersion != null);
      ok(entry != null, "Expected a bugs config entry with languageOptions.ecmaVersion");
      ok(entry.languageOptions.ecmaVersion === 2022, "Expected ecmaVersion 2022");
    })
  );

  results.push(
    await test("bugs config sets sourceType to module", () => {
      const entry = bugsConfig.find((e) => e.languageOptions?.sourceType != null);
      ok(entry != null, "Expected a bugs config entry with languageOptions.sourceType");
      ok(entry.languageOptions.sourceType === "module", "Expected sourceType 'module'");
    })
  );

  results.push(
    await test("bugs config user entry defines no-unused-vars as error array with ^_ pattern", () => {
      ok(userHasRule(bugsConfig, "no-unused-vars"), "Expected no-unused-vars in bugs user entry");
      const val = userRuleValue(bugsConfig, "no-unused-vars");
      ok(Array.isArray(val), "Expected no-unused-vars to be an array config [severity, options]");
      const severity = val[0];
      ok(severity === "error" || severity === 2, "Expected no-unused-vars severity 'error'");
      ok(val[1]?.argsIgnorePattern === "^_", "Expected argsIgnorePattern '^_'");
    })
  );

  results.push(
    await test("bugs config user entry defines no-console as off", () => {
      ok(userHasRule(bugsConfig, "no-console"), "Expected no-console in bugs user entry");
      const val = userRuleValue(bugsConfig, "no-console");
      ok(val === "off" || val === 0, "Expected no-console 'off'");
    })
  );

  results.push(
    await test("bugs config user entry defines no-useless-assignment as error", () => {
      ok(userHasRule(bugsConfig, "no-useless-assignment"), "Expected no-useless-assignment in bugs user entry");
      const val = userRuleValue(bugsConfig, "no-useless-assignment");
      ok(val === "error" || val === 2, "Expected no-useless-assignment severity 'error'");
    })
  );

  results.push(
    await test("bugs config user entry defines no-useless-catch as error", () => {
      ok(userHasRule(bugsConfig, "no-useless-catch"), "Expected no-useless-catch in bugs user entry");
      const val = userRuleValue(bugsConfig, "no-useless-catch");
      ok(val === "error" || val === 2, "Expected no-useless-catch severity 'error'");
    })
  );

  results.push(
    await test("bugs config user entry defines no-constant-binary-expression as error", () => {
      ok(
        userHasRule(bugsConfig, "no-constant-binary-expression"),
        "Expected no-constant-binary-expression in bugs user entry"
      );
      const val = userRuleValue(bugsConfig, "no-constant-binary-expression");
      ok(val === "error" || val === 2, "Expected no-constant-binary-expression severity 'error'");
    })
  );

  results.push(
    await test("bugs config user entry defines no-undef as error", () => {
      ok(userHasRule(bugsConfig, "no-undef"), "Expected no-undef in bugs user entry");
      const val = userRuleValue(bugsConfig, "no-undef");
      ok(val === "error" || val === 2, "Expected no-undef severity 'error'");
    })
  );

  results.push(
    await test("bugs config user entry defines no-empty as error", () => {
      ok(userHasRule(bugsConfig, "no-empty"), "Expected no-empty in bugs user entry");
      const val = userRuleValue(bugsConfig, "no-empty");
      ok(val === "error" || val === 2, "Expected no-empty severity 'error'");
    })
  );

  // ── Behavioural tests for bugs config ──

  results.push(
    await test("bugs config: no-useless-assignment flags a value overwritten before use", () => {
      const code = "function foo() { let x = 1; x = 2; return x; }";
      const msgs = violationsFor(bugsConfig, code, "no-useless-assignment");
      ok(msgs.length > 0, "Expected no-useless-assignment to flag the overwritten initial assignment");
    })
  );

  results.push(
    await test("bugs config: no-useless-assignment does not flag a normally used assignment", () => {
      const code = "function foo() { let x = 1; return x; }";
      const msgs = violationsFor(bugsConfig, code, "no-useless-assignment");
      ok(msgs.length === 0, "Expected no-useless-assignment not to flag a single-use assignment");
    })
  );

  results.push(
    await test("bugs config: no-useless-catch flags a catch that only rethrows", () => {
      const code = "try { doWork(); } catch(e) { throw e; }";
      const l = new Linter({ configType: "flat" });
      // Inject doWork as a global so no-undef does not interfere with this test
      const lastEntry = bugsConfig[bugsConfig.length - 1];
      const configWithGlobal = [
        ...bugsConfig.slice(0, -1),
        {
          ...lastEntry,
          languageOptions: {
            ...lastEntry.languageOptions,
            globals: { ...lastEntry.languageOptions.globals, doWork: "readonly" },
          },
        },
      ];
      const msgs = l.verify(code, configWithGlobal).filter((m) => m.ruleId === "no-useless-catch");
      ok(msgs.length > 0, "Expected no-useless-catch to flag a catch that only rethrows");
    })
  );

  results.push(
    await test("bugs config: no-useless-catch does not flag a catch that adds extra handling", () => {
      const code = "try { doWork(); } catch(e) { console.error(e); throw e; }";
      const l = new Linter({ configType: "flat" });
      const lastEntry = bugsConfig[bugsConfig.length - 1];
      const configWithGlobal = [
        ...bugsConfig.slice(0, -1),
        {
          ...lastEntry,
          languageOptions: {
            ...lastEntry.languageOptions,
            globals: { ...lastEntry.languageOptions.globals, doWork: "readonly" },
          },
        },
      ];
      const msgs = l.verify(code, configWithGlobal).filter((m) => m.ruleId === "no-useless-catch");
      ok(msgs.length === 0, "Expected no-useless-catch to allow a catch with extra handling");
    })
  );

  results.push(
    await test("bugs config: no-constant-binary-expression flags comparing two object literals", () => {
      const code = "const result = {} === {};";
      const msgs = violationsFor(bugsConfig, code, "no-constant-binary-expression");
      ok(msgs.length > 0, "Expected no-constant-binary-expression to flag {} === {}");
    })
  );

  results.push(
    await test("bugs config: no-constant-binary-expression flags always-true nullish coalescing", () => {
      const code = "const x = false ?? true;";
      const msgs = violationsFor(bugsConfig, code, "no-constant-binary-expression");
      ok(msgs.length > 0, "Expected no-constant-binary-expression to flag false ?? true");
    })
  );

  results.push(
    await test("bugs config: no-undef flags an undeclared variable reference", () => {
      const code = "const x = undeclaredVariable;";
      const msgs = violationsFor(bugsConfig, code, "no-undef");
      ok(msgs.length > 0, "Expected no-undef to flag an undeclared variable");
    })
  );

  results.push(
    await test("bugs config: no-undef does not flag node global process", () => {
      const code = "const env = process.env.NODE_ENV;";
      const msgs = violationsFor(bugsConfig, code, "no-undef");
      ok(msgs.length === 0, "Expected no-undef not to flag node global 'process'");
    })
  );

  results.push(
    await test("bugs config: no-empty flags an empty block statement", () => {
      const code = "if (true) {}";
      const msgs = violationsFor(bugsConfig, code, "no-empty");
      ok(msgs.length > 0, "Expected no-empty to flag an empty if block");
    })
  );

  results.push(
    await test("bugs config: no-empty does not flag a non-empty block", () => {
      const code = "if (true) { const x = 1; }";
      const msgs = violationsFor(bugsConfig, code, "no-empty");
      ok(msgs.length === 0, "Expected no-empty not to flag a non-empty block");
    })
  );

  results.push(
    await test("bugs config: no-console does not flag console.log (rule is off)", () => {
      const msgs = violationsFor(bugsConfig, "console.log('debug');", "no-console");
      ok(msgs.length === 0, "Expected no console violations when no-console is off");
    })
  );

  // ── Regression / boundary tests ──

  results.push(
    await test("base config: valid module code produces no violations", () => {
      const code = [
        "export function add(a, b) {",
        "  return a + b;",
        "}",
      ].join("\n");
      const msgs = lint(baseConfig, code);
      ok(msgs.length === 0, "Expected clean module code to produce zero ESLint violations");
    })
  );

  results.push(
    await test("bugs config: valid module code produces no violations", () => {
      const code = [
        "export function multiply(a, b) {",
        "  const result = a * b;",
        "  return result;",
        "}",
      ].join("\n");
      const msgs = lint(bugsConfig, code);
      ok(msgs.length === 0, "Expected clean module code to produce zero violations in bugs config");
    })
  );

  results.push(
    await test("bugs config: multiple rule violations are all reported", () => {
      // Code with both an empty block (no-empty) and an undefined reference (no-undef)
      const code = "if (undeclaredVar) {}";
      const msgs = lint(bugsConfig, code);
      const ruleIds = msgs.map((m) => m.ruleId);
      ok(ruleIds.includes("no-undef"), "Expected no-undef violation");
      ok(ruleIds.includes("no-empty"), "Expected no-empty violation");
    })
  );

  results.push(
    await test("bugs config: both configs share the same no-unused-vars argsIgnorePattern", () => {
      const baseVal = userRuleValue(baseConfig, "no-unused-vars");
      const bugsVal = userRuleValue(bugsConfig, "no-unused-vars");
      ok(
        Array.isArray(baseVal) && Array.isArray(bugsVal),
        "Expected both to configure no-unused-vars as an array"
      );
      ok(
        baseVal[1]?.argsIgnorePattern === bugsVal[1]?.argsIgnorePattern,
        "Expected both configs to share the same argsIgnorePattern"
      );
    })
  );

  return results;
}