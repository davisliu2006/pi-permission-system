import type { AllowAlwaysRule } from "./types.ts";

function ruleEq(a: AllowAlwaysRule, b: AllowAlwaysRule): boolean {
  return a.kind === b.kind && a.tool === b.tool && a.body === b.body;
}

export class SessionApprovalStore {
  /**
   * Stored as an array rather than a set because JS
   * objects don't compare by value.
   */
  private readonly rules: AllowAlwaysRule[] = [];

  add(rule: AllowAlwaysRule): void {
    if (this.rules.some((existing) => ruleEq(existing, rule))) {return;}
    this.rules.push(rule);
  }

  getRules(): readonly AllowAlwaysRule[] {
    return this.rules;
  }

  clear(): void {
    this.rules.length = 0;
  }
}
