import type { FinalDecision, Proposal, VoteValue } from "../shared/types";
import { VOTE } from "../shared/types";
import { appendEvent, getRoomEvents, requireProposal, setProposalStatus } from "./store/state";
import { runCouncilAgent } from "./agents/councilAgent";
import { runResearchAgent } from "./agents/researchAgent";
import { runSkepticAgent } from "./agents/skepticAgent";
import { recordDecisionOnChain } from "./chain/chainClient";

export async function runProposalPipeline(proposalId: string) {
  const proposal = requireProposal(proposalId);
  try {
    const researchReport = runResearchAgent({ proposal, priorEvents: getRoomEvents(proposal.roomId) });
    appendEvent({ roomId: proposal.roomId, proposalId, type: "analysis.submitted", sender: "ResearchAgent", payload: researchReport });
    appendEvent({ roomId: proposal.roomId, proposalId, type: "vote.cast", sender: "ResearchAgent", payload: { vote: researchReport.vote, reportHash: researchReport.payloadHash } });
    setProposalStatus(proposalId, "research_complete");

    const currentAfterResearch = requireProposal(proposalId);
    const skepticReport = runSkepticAgent({ proposal: currentAfterResearch, priorEvents: getRoomEvents(proposal.roomId) });
    appendEvent({ roomId: proposal.roomId, proposalId, type: "analysis.submitted", sender: "SkepticAgent", payload: skepticReport });
    appendEvent({ roomId: proposal.roomId, proposalId, type: "vote.cast", sender: "SkepticAgent", payload: { vote: skepticReport.vote, reportHash: skepticReport.payloadHash } });
    setProposalStatus(proposalId, "skeptic_complete");

    const currentAfterSkeptic = requireProposal(proposalId);
    const finalDecision: FinalDecision = runCouncilAgent({
      proposal: currentAfterSkeptic,
      researchReport,
      skepticReport,
      priorEvents: getRoomEvents(proposal.roomId)
    });
    appendEvent({ roomId: proposal.roomId, proposalId, type: "decision.finalized", sender: "CouncilAgent", payload: finalDecision });
    appendEvent({ roomId: proposal.roomId, proposalId, type: "vote.cast", sender: "CouncilAgent", payload: { vote: finalDecision.vote, decisionHash: finalDecision.finalDecisionHash } });
    setProposalStatus(proposalId, "decision_ready");

    const recorded = await recordFinalDecision(currentAfterSkeptic, finalDecision, researchReport.payloadHash, skepticReport.payloadHash, researchReport.vote, skepticReport.vote);
    return { proposal: recorded, researchReport, skepticReport, finalDecision, events: getRoomEvents(proposal.roomId) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendEvent({ roomId: proposal.roomId, proposalId, type: "error.raised", sender: "Orchestrator", payload: { message } });
    setProposalStatus(proposalId, "failed");
    throw error;
  }
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

