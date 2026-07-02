import type { RiskFinding, RiskLevel } from '../../shared/types';

// Helper to build a RiskFinding with a consistent shape.
// Each rule produces its own finding (findings are never merged) so the
// overlay can show users a clear, itemised list of concerns.
export function createFinding(
  severity: RiskLevel,
  title: string,
  description: string,
  recommendation: string,
): RiskFinding {
  return { severity, title, description, recommendation };
}
