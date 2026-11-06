import assert from "node:assert/strict";
import test from "node:test";

import { mergeConfigs, normalizeConfig } from "../src/config.ts";
import { parseJsonc } from "../src/jsonc.ts";
import {
  parseAiModelRef,
  toPermissionState,
  toRecord,
  type ConfigWarning,
  type PermissionConfig,
} from "../src/types.ts";
import { IGNORED_AI_MODEL_WARNING } from "../src/warning-strings.ts";

test("normalizes permission state strings", () => {
  assert.equal(toPermissionState("allow"), "allow");
  assert.equal(toPermissionState("ask"), "ask");
  assert.equal(toPermissionState("deny"), "deny");
  assert.equal(toPermissionState("ALLOW"), undefined);
  assert.equal(toPermissionState(undefined), undefined);
  assert.equal(toPermissionState(null), undefined);
});

test("converts records without accepting arrays or null", () => {
  const input = { path: "a.txt" };
  assert.equal(toRecord(input), input);
  assert.equal(toRecord(null), undefined);
  assert.equal(toRecord(undefined), undefined);
  assert.equal(toRecord([]), undefined);
  assert.equal(toRecord("value"), undefined);
});

test("parses jsonc comments and trailing commas", () => {
  const value = parseJsonc(`{
    // line comment
    "default": "ask",
    "tools": {
      "read": "allow", /* block comment */
    },
    "bash": {
      "echo // not a comment": "allow",
      "echo \\"quoted\\"": "deny",
    },
  }`);
  assert.deepEqual(value, {
    default: "ask",
    tools: { read: "allow" },
    bash: {
      "echo // not a comment": "allow",
      'echo "quoted"': "deny",
    },
  });
});

test("local config overrides global config including deny", () => {
  const globalConfig: PermissionConfig = {
    default: "ask",
    tools: { bash: "deny", read: "allow" },
    bash: {
      "*": "deny",
      "git status*": "deny",
    },
    external_directory: { write: "deny" },
    settings: {},
  };
  const localConfig: PermissionConfig = {
    default: "allow",
    tools: { bash: "allow" },
    bash: {
      "*": "ask",
      "git status*": "allow",
    },
    external_directory: { write: "allow" },
    settings: {},
  };

  const merged = mergeConfigs(globalConfig, localConfig);
  assert.equal(merged.default, "allow");
  assert.equal(merged.tools.bash, "allow");
  assert.equal(merged.tools.read, "allow");
  assert.equal(merged.bash["*"], "ask");
  assert.equal(merged.bash["git status*"], "allow");
  assert.equal(merged.external_directory.write, "allow");
});

test("local bash rules move to the local position", () => {
  const merged = mergeConfigs(
    {
      default: "ask",
      tools: {},
      bash: {
        "*": "ask",
        "git *": "deny",
        "rm -rf *": "deny",
      },
      external_directory: {},
      settings: {},
    },
    {
      default: "ask",
      tools: {},
      bash: {
        "git *": "allow",
      },
      external_directory: {},
      settings: {},
    }
  );

  assert.deepEqual(Object.keys(merged.bash), ["*", "rm -rf *", "git *"]);
  assert.equal(merged.bash["git *"], "allow");
});

test("parseAiModelRef accepts provider/model-id", () => {
  assert.deepEqual(parseAiModelRef("deepseek/deepseek-flash"), {
    provider: "deepseek",
    modelId: "deepseek-flash",
  });
  assert.deepEqual(parseAiModelRef(" custom/org/model "), {
    provider: "custom",
    modelId: "org/model",
  });
  assert.equal(parseAiModelRef("missing-slash"), undefined);
  assert.equal(parseAiModelRef("/no-provider"), undefined);
  assert.equal(parseAiModelRef("provider/"), undefined);
});

test("normalizes and merges settings.ai_model", () => {
  const warnings: ConfigWarning[] = [];
  const normalized = normalizeConfig(
    {
      default: "ask",
      settings: { ai_model: " deepseek/deepseek-flash " },
    },
    "test.jsonc",
    warnings
  );
  assert.equal(normalized.settings.ai_model, "deepseek/deepseek-flash");
  assert.equal(warnings.length, 0);

  const ignoredWarnings: ConfigWarning[] = [];
  const ignored = normalizeConfig(
    { default: "ask", settings: { ai_model: "not-a-ref" } },
    "test.jsonc",
    ignoredWarnings
  );
  assert.equal(ignored.settings.ai_model, undefined);
  assert.equal(ignoredWarnings[0]?.message, IGNORED_AI_MODEL_WARNING);

  const merged = mergeConfigs(
    {
      default: "ask",
      tools: {},
      bash: {},
      external_directory: {},
      settings: { ai_model: "deepseek/deepseek-flash" },
    },
    {
      default: "ask",
      tools: {},
      bash: {},
      external_directory: {},
      settings: { ai_model: "deepseek/deepseek-pro" },
    }
  );
  assert.equal(merged.settings.ai_model, "deepseek/deepseek-pro");

  const keptGlobal = mergeConfigs(
    {
      default: "ask",
      tools: {},
      bash: {},
      external_directory: {},
      settings: { ai_model: "deepseek/deepseek-flash" },
    },
    {
      default: "ask",
      tools: {},
      bash: {},
      external_directory: {},
      settings: {},
    }
  );
  assert.equal(keptGlobal.settings.ai_model, "deepseek/deepseek-flash");
});
