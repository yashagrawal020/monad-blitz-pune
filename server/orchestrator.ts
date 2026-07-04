import type { AgentName, AgentToolTrace, FinalDecision, ParallelDemoRun, Proposal, VoteValue } from "../shared/types";
import { VOTE } from "../shared/types";
import { appendEvent, createProposal, getRoomEvents, requireProposal, setProposalStatus } from "./store/state";
import { runCouncilAgent } from "./agents/councilAgent";
import { runResearchAgent } from "./agents/researchAgent";
import { runSkepticAgent } from "./agents/skepticAgent";
import { recordDecisionOnChain, recordDecisionsInParallelOnChain } from "./chain/chainClient";

export async function runCouncilToDecision(proposalId: string) {
  const proposal = requireProposal(proposalId);
  try {
    const researchReport = await runResearchAgent({
      proposal,
      priorEvents: getRoomEvents(proposal.roomId),
      onToolResult: appendToolEvent(proposal.roomId, proposalId, "ResearchAgent")
    });
    appendEvent({ roomId: proposal.roomId, proposalId, type: "analysis.submitted", sender: "ResearchAgent", payload: researchReport });
    appendEvent({ roomId: proposal.roomId, proposalId, type: "vote.cast", sender: "ResearchAgent", payload: { vote: researchReport.vote, reportHash: researchReport.payloadHash } });
    setProposalStatus(proposalId, "research_complete");

    const currentAfterResearch = requireProposal(proposalId);
    const skepticReport = await runSkepticAgent({
      proposal: currentAfterResearch,
      researchReport,
      priorEvents: getRoomEvents(proposal.roomId),
      onToolResult: appendToolEvent(proposal.roomId, proposalId, "SkepticAgent")
    });
    appendEvent({ roomId: proposal.roomId, proposalId, type: "analysis.submitted", sender: "SkepticAgent", payload: skepticReport });
    appendEvent({ roomId: proposal.roomId, proposalId, type: "vote.cast", sender: "SkepticAgent", payload: { vote: skepticReport.vote, reportHash: skepticReport.payloadHash } });
    setProposalStatus(proposalId, "skeptic_complete");

    const currentAfterSkeptic = requireProposal(proposalId);
    const finalDecision: FinalDecision = await runCouncilAgent({
      proposal: currentAfterSkeptic,
      researchReport,
      skepticReport,
      priorEvents: getRoomEvents(proposal.roomId),
      onToolResult: appendToolEvent(proposal.roomId, proposalId, "CouncilAgent")
    });
    appendEvent({ roomId: proposal.roomId, proposalId, type: "decision.finalized", sender: "CouncilAgent", payload: finalDecision });
    appendEvent({ roomId: proposal.roomId, proposalId, type: "vote.cast", sender: "CouncilAgent", payload: { vote: finalDecision.vote, decisionHash: finalDecision.finalDecisionHash } });
    const decisionReady = setProposalStatus(proposalId, "decision_ready");
    return { proposal: decisionReady, researchReport, skepticReport, finalDecision, events: getRoomEvents(proposal.roomId) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendEvent({ roomId: proposal.roomId, proposalId, type: "error.raised", sender: "Orchestrator", payload: { message } });
    setProposalStatus(proposalId, "failed");
    throw error;
  }
}

export async function runProposalPipeline(proposalId: string) {
  const result = await runCouncilToDecision(proposalId);
  const recorded = await recordFinalDecision(
    result.proposal,
    result.finalDecision,
    result.researchReport.payloadHash,
    result.skepticReport.payloadHash,
    result.researchReport.vote,
    result.skepticReport.vote
  );
  return { ...result, proposal: recorded, events: getRoomEvents(recorded.roomId) };
}

export async function runParallelCommitDemo(): Promise<{ runs: ParallelDemoRun[] }> {
  const seeds = [
    {
      label: "Reserve-safe yield",
      treasurySize: 100000,
      allocationPercent: 8,
      question: "Should this treasury allocate a cautious 8% to RiverLend or VaultSteady, or stay in reserve?",
      candidateProtocolIds: ["riverlend", "vaultsteady"]
    },
    {
      label: "High-yield challenge",
      treasurySize: 125000,
      allocationPercent: 10,
      question: "Should this treasury chase 10% allocation across TurboLP and RiverLend, or reject the higher-risk path?",
      candidateProtocolIds: ["turbolp", "riverlend"]
    },
    {
      label: "Balanced council",
      treasurySize: 150000,
      allocationPercent: 6,
      question: "Should this treasury allocate 6% across VaultSteady, RiverLend, and TurboLP while preserving reserves?",
      candidateProtocolIds: ["vaultsteady", "riverlend", "turbolp"]
    }
  ];

  const prepared = [];
  for (const seed of seeds) {
    const proposal = createProposal(seed);
    const result = await runCouncilToDecision(proposal.id);
    prepared.push({ label: seed.label, ...result });
  }

  const receipts = await recordDecisionsInParallelOnChain(prepared.map((run) => ({
    proposal: run.proposal,
    finalDecision: run.finalDecision,
    researchReportHash: run.researchReport.payloadHash,
    skepticReportHash: run.skepticReport.payloadHash,
    researchVote: run.researchReport.vote,
    skepticVote: run.skepticReport.vote
  })));

  const runs = prepared.map((run, index): ParallelDemoRun => {
    const receipt = receipts[index];
    const recorded = setProposalStatus(run.proposal.id, "recorded_on_chain", {
      chainTxHash: receipt.txHash,
      chainDecisionId: receipt.decisionId
    });
    appendEvent({
      roomId: recorded.roomId,
      proposalId: recorded.id,
      type: "decision.recorded_on_chain",
      sender: "Orchestrator",
      payload: receipt
    });
    return {
      label: run.label,
      proposal: recorded,
      researchReport: run.researchReport,
      skepticReport: run.skepticReport,
      finalDecision: run.finalDecision,
      chainReceipt: receipt,
      events: getRoomEvents(recorded.roomId)
    };
  });

  return { runs };
}

function appendToolEvent(roomId: string, proposalId: string, sender: AgentName) {
  return (trace: AgentToolTrace) => {
    appendEvent({
      roomId,
      proposalId,
      type: "tool.used",
      sender,
      payload: trace
    });
  };
}

export async function recordFinalDecision(
  proposal: Proposal,
  finalDecision: FinalDecision,
  researchReportHash: `0x${string}`,
  skepticReportHash: `0x${string}`,
  researchVote: VoteValue = VOTE.abstain,
  skepticVote: VoteValue = VOTE.abstain
) {
  setProposalStatus(proposal.id, "recording_on_chain");
  const receipt = await recordDecisionOnChain({ proposal, finalDecision, researchReportHash, skepticReportHash, researchVote, skepticVote });
  const recorded = setProposalStatus(proposal.id, "recorded_on_chain", { chainTxHash: receipt.txHash, chainDecisionId: receipt.decisionId });
  appendEvent({ roomId: proposal.roomId, proposalId: proposal.id, type: "decision.recorded_on_chain", sender: "Orchestrator", payload: receipt });
  return recorded;
}

