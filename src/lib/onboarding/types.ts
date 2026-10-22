export type OnboardingState =
  | "never"
  | "in_progress"
  | "completed"
  | "skipped"
  | "dismissed_permanently";

export type OnboardingStep = {
  id: string;
  title: string;
  body: string;
  /** Seletor CSS do elemento a destacar (ex.: [data-onboarding="checkin-photos"]). */
  target?: string;
};

export type FeatureOnboardingDefinition = {
  id: string;
  version: number;
  title: string;
  /** Se true, completed/skipped podem voltar a auto-exibir nesta versão. */
  forceReshowOnVersionBump?: boolean;
  steps: OnboardingStep[];
};

export type OnboardingPreference = {
  onboarding_id: string;
  version: number;
  state: OnboardingState;
  dismiss_permanently: boolean;
  current_step: number;
  completed_at?: string | null;
  updated_at?: string | null;
};

export type ShouldAutoShowInput = {
  definition: FeatureOnboardingDefinition;
  preference: OnboardingPreference | null;
  /** Bloqueios temporários (submit, wizard, etc.). */
  blocked?: boolean;
};
