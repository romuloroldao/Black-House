export type CoachRuleDomain =
  | "general"
  | "nutrition"
  | "training"
  | "checkin"
  | "communication"
  | "free_meal";

export type CoachRuleTrigger =
  | "always"
  | "restaurant"
  | "substitution"
  | "workout"
  | "late"
  | "complete"
  | "checkin";

export type CoachRule = {
  id: string;
  coach_id: string;
  domain: CoachRuleDomain;
  trigger: CoachRuleTrigger;
  priority: number;
  title: string;
  body: string;
  active: boolean;
  source: string;
  source_ref?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CoachRuleInput = {
  domain: CoachRuleDomain;
  trigger: CoachRuleTrigger;
  title: string;
  body: string;
  priority?: number;
  active?: boolean;
};
