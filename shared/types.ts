export const VOTE = {
  abstain: 0,
  reject: 1,
  conditional: 2,
  approve: 3
} as const;

export type VoteLabel = keyof typeof VOTE;
export type VoteValue = (typeof VOTE)[VoteLabel];

export type ProposalStatus =
  | "open"
  | "research_complete"
  | "skeptic_complete"
  | "decision_ready"
  | "recording_on_chain"
  | "recorded_on_chain"
  | "failed";

export type RoomEventType =
  | "proposal.created"
  | "analysis.submitted"
  | "vote.cast"
  | "decision.finalized"
  | "decision.recorded_on_chain"
  | "error.raised";

export type AgentName = "ResearchAgent" | "SkepticAgent" | "CouncilAgent" | "Orchestrator";

export type ProtocolMetrics = {
  id: string;
  name: string;
  apy: number;
  tvl: number;
  liquidityScore: number;
  adminKeyRisk: number;
  oracleRisk: number;
  exploitHistory: boolean;
  volatilityScore: number;
  lockupDays: number;
};

export type TreasuryPolicy = {
  maxAllocationPercent: number;
  minLiquidityScore: number;
  maxRiskScore: number;
  preferredReservePercent: number;
};

export type Proposal = {
  id: string;
  roomId: string;
  treasurySize: number;
  allocationPercent: number;
  question: string;
  candidateProtocolIds: string[];
  status: ProposalStatus;
  proposalHash: `0x${string}`;
  chainTxHash?: `0x${string}`;
  chainDecisionId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ScoreBreakdown = {
  label: string;
  score: number;
  rationale: string;
};

export type AgentReport = {
  agentName: "ResearchAgent" | "SkepticAgent";
  role: "research" | "risk";
  recommendation: string;
  vote: VoteValue;
  confidence: number;
  targetProtocolId: string;
  summary: string;
  scores: ScoreBreakdown[];
  evidenceRefs: string[];
  assumptions: string[];
  payloadHash: `0x${string}`;
};

export type FinalDecision = {
  agentName: "CouncilAgent";
  recommendation: string;
  vote: VoteValue;
  confidence: number;
  selectedProtocolId: string;
  allocationPercent: number;
  reservePercent: number;
  summary: string;
  researchReportHash: `0x${string}`;
  skepticReportHash: `0x${string}`;
  finalDecisionHash: `0x${string}`;
};

export type RoomEvent = {
  id: string;
  roomId: string;
  proposalId: string;
  type: RoomEventType;
  sender: AgentName;
  payload: unknown;
  payloadHash: `0x${string}`;
  createdAt: string;
};

export type RunResult = {
  proposal: Proposal;
  researchReport?: AgentReport;
  skepticReport?: AgentReport;
  finalDecision?: FinalDecision;
  events: RoomEvent[];
};
