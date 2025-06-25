export interface RuleResult {
  isValid: boolean;
  message?: string;
  transformedValue?: any;
  appliedRules?: string[];
}