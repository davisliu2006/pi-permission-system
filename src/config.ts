import { readFile } from "node:fs/promises";
import { ASK } from "./constants.ts";
import { parseJsonc } from "./jsonc.ts";
import {
  createDefaultPermissionConfig,
  parseAiModelRef,
  toPermissionState,
  toRecord,
  type ConfigWarning,
  type PermissionConfig,
  type PermissionSection,
  type PermissionSettings,
  type PermissionState,
} from "./types.ts";
import {
  CONFIG_MUST_BE_OBJECT,
  formatConfigParseFailure,
  formatConfigReadFailure,
  formatIgnoredSectionEntryWarning,
  formatIgnoredSectionWarning,
  IGNORED_AI_MODEL_WARNING,
  IGNORED_AUTO_ALLOW_CRITERIA_WARNING,
  IGNORED_DEFAULT_WARNING,
  IGNORED_SETTINGS_WARNING,
} from "./warning-strings.ts";

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Helper used by normalizeConfig.
 * Ensures section is a valid PermissionSection.
 */
function normalizeSection(
  raw: unknown,
  sectionName: string,
  configPath: string | undefined,
  warnings: ConfigWarning[]
): PermissionSection {
  if (raw === undefined) {return {};}
  const record = toRecord(raw);
  if (!record) {
    warnings.push({
      path: configPath,
      message: formatIgnoredSectionWarning(sectionName),
    });
    return {};
  }

  const result: PermissionSection = {};
  for (const [key, entry] of Object.entries(record)) {
    if (UNSAFE_KEYS.has(key)) {continue;}
    const state = toPermissionState(entry);
    if (state !== undefined) {
      result[key] = state;
    } else {
      warnings.push({
        path: configPath,
        message: formatIgnoredSectionEntryWarning(sectionName, key),
      });
    }
  }
  return result;
}

/**
 * Helper used by normalizeConfig.
 * Ensures settings is a valid PermissionSettings object.
 */
function normalizeSettings(
  raw: unknown,
  configPath: string | undefined,
  warnings: ConfigWarning[]
): PermissionSettings {
  if (raw === undefined) {return {};}
  const record = toRecord(raw);
  if (!record) {
    warnings.push({
      path: configPath,
      message: IGNORED_SETTINGS_WARNING,
    });
    return {};
  }

  const settings: PermissionSettings = {};
  if (record.ai_model !== undefined) {
    if (typeof record.ai_model === "string" && parseAiModelRef(record.ai_model)) {
      settings.ai_model = record.ai_model.trim();
    } else {
      warnings.push({
        path: configPath,
        message: IGNORED_AI_MODEL_WARNING,
      });
    }
  }
  if (record.auto_allow_criteria !== undefined) {
    if (
      typeof record.auto_allow_criteria === "string"
      && record.auto_allow_criteria.trim()
    ) {
      settings.auto_allow_criteria = record.auto_allow_criteria.trim();
    } else {
      warnings.push({
        path: configPath,
        message: IGNORED_AUTO_ALLOW_CRITERIA_WARNING,
      });
    }
  }
  return settings;
}

/**
 * Convert the raw config to a PermissionConfig.
 * Ensures the config is valid.
 */
export function normalizeConfig(
  rawConfig: unknown,
  configPath: string | undefined,
  warnings: ConfigWarning[]
): PermissionConfig {
  const config = toRecord(rawConfig);
  if (!config) {
    warnings.push({
      path: configPath,
      message: CONFIG_MUST_BE_OBJECT,
    });
    return createDefaultPermissionConfig();
  }

  const parsedDefault = toPermissionState(config.default);
  if (config.default !== undefined && parsedDefault === undefined) {
    warnings.push({
      path: configPath,
      message: IGNORED_DEFAULT_WARNING,
    });
  }
  const defaultState = parsedDefault ?? ASK;

  return {
    default: defaultState,
    tools: normalizeSection(config.tools, "tools", configPath, warnings),
    bash: normalizeSection(config.bash, "bash", configPath, warnings),
    external_directory: normalizeSection(
      config.external_directory,
      "external_directory",
      configPath,
      warnings
    ),
    settings: normalizeSettings(config.settings, configPath, warnings),
  };
}

/**
 * Loads the config file and appends to the list of warnings.
 */
async function loadConfigFile(
  path: string,
  warnings: ConfigWarning[]
): Promise<PermissionConfig | undefined> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {return undefined;} // file does not exist
    warnings.push({
      path,
      message: formatConfigReadFailure(error),
    });
    return undefined;
  }

  try {
    return normalizeConfig(parseJsonc(raw), path, warnings);
  } catch (error) {
    warnings.push({
      path,
      message: formatConfigParseFailure(error),
    });
    return undefined;
  }
}

/**
 * Local overrides global, preserves order.
 */
function mergeBashSections(
  globalSection: PermissionSection,
  localSection: PermissionSection
): PermissionSection {
  const merged = new Map<string, PermissionState>();
  for (const [pattern, state] of Object.entries(globalSection)) {
    merged.set(pattern, state);
  }
  for (const [pattern, state] of Object.entries(localSection)) {
    merged.delete(pattern);
    merged.set(pattern, state);
  }
  return Object.fromEntries(merged);
}

/**
 * Merges configs such that local config overrides global config.
 */
export function mergeConfigs(
  globalConfig: PermissionConfig | undefined,
  localConfig: PermissionConfig | undefined
): PermissionConfig {
  if (!globalConfig && !localConfig) {
    return createDefaultPermissionConfig();
  }

  globalConfig = globalConfig ?? createDefaultPermissionConfig();

  return {
    default: localConfig?.default ?? globalConfig.default,
    tools: { ...globalConfig.tools, ...(localConfig?.tools ?? {}) },
    bash: mergeBashSections(globalConfig.bash, localConfig?.bash ?? {}),
    external_directory: {
      ...globalConfig.external_directory,
      ...(localConfig?.external_directory ?? {}),
    },
    settings: {
      ...globalConfig.settings,
      ...(localConfig?.settings ?? {}),
    },
  };
}

/**
 * Loads merged config where local overrides global.
 */
export async function loadMergedConfig(
  globalPath: string,
  localPath: string
): Promise<{ config: PermissionConfig; warnings: ConfigWarning[] }> {
  const warnings: ConfigWarning[] = [];
  const globalConfig = await loadConfigFile(globalPath, warnings);
  const localConfig = await loadConfigFile(localPath, warnings);
  return {
    config: mergeConfigs(globalConfig, localConfig),
    warnings,
  };
}
