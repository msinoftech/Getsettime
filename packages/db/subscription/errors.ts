import type { PlanLimitErrorCode } from './types';

export class PlanLimitError extends Error {
  readonly code: PlanLimitErrorCode;
  readonly planSlug: string;
  readonly upgradeRequired: boolean;

  constructor(
    message: string,
    code: PlanLimitErrorCode,
    planSlug: string,
    upgradeRequired = true
  ) {
    super(message);
    this.name = 'PlanLimitError';
    this.code = code;
    this.planSlug = planSlug;
    this.upgradeRequired = upgradeRequired;
  }
}
