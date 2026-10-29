import type { AllowAlwaysRule } from "./types.ts";

export class SessionApprovalStore {
  private readonly rules: AllowAlwaysRule[] = [];

  add(rule: AllowAlwaysRule): void {
    this.rules.push(rule);
  }

  getRules(): readonly AllowAlwaysRule[] {
    return this.rules;
  }

  clear(): void {
    this.rules.length = 0;
  }
}
