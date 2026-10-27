export type Stage = 'intro' | 'signals' | 'first' | 'second' | 'analysis' | 'decision' | 'results';
export type Path = 'advanced' | 'credit' | 'funding' | 'decoy' | 'general';
export type RecoveryChoice = 'credit' | 'funding' | 'deepen' | 'none';
export type SecondTake = 'balanced' | 'resolved' | 'profit' | 'crisis';
export type CausalChoice = 'balanced' | 'underwriting' | 'lcr' | 'bonds';
export type CfoChoice = 'balanced' | 'dismiss' | 'breach' | 'credit';
export type SecondaryChoice = 'sector' | 'margin' | 'none' | 'everything';
export type FinalChoice = 'monitor' | 'inquiry' | 'remediation' | 'emergency';

export interface GameState {
  version: 8;
  stage: Stage;
  startedAt: number | null;
  selectedSignals: string[];
  evidence: string[];
  recoveryChoice: RecoveryChoice | null;
  hintCount: number;
  secondTake: SecondTake | null;
  selectedRoots: string[];
  causalChoice: CausalChoice | null;
  cfoChoice: CfoChoice | null;
  secondaryChoice: SecondaryChoice | null;
  finalChoice: FinalChoice | null;
  advancedReselected: boolean;
  overtime: boolean;
}

export interface ScoreBreakdown {
  independence: number;
  understanding: number;
  judgment: number;
  supervisory: number;
  timePenalty: number;
  total: number;
  profile: string;
  profileDescription: string;
}
