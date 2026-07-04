import fs from "node:fs";
import path from "node:path";
import type { AgentName, Proposal, ProposalStatus, RoomEvent, RoomEventType } from "../../shared/types";
import { hashPayload, makeId, nowIso } from "../../shared/hash";

type AppState = {
  proposals: Proposal[];
  events: RoomEvent[];
};

const state: AppState = {
  proposals: [],
  events: []
};

const dumpPath = path.resolve(process.cwd(), ".tmp", "demo-state.json");

export function getState() {
  return state;
}

export function createProposal(input: {
  treasurySize: number;
  allocationPercent: number;
  question: string;
  candidateProtocolIds: string[];
}) {
  const id = makeId("proposal");
  const roomId = makeId("room");
  const createdAt = nowIso();
  const proposalBody = {
    id,
    roomId,
    treasurySize: input.treasurySize,
    allocationPercent: input.allocationPercent,
    question: input.question,
    candidateProtocolIds: input.candidateProtocolIds
  };
  const proposal: Proposal = {
    ...proposalBody,
    status: "open",
    proposalHash: hashPayload(proposalBody),
    createdAt,
    updatedAt: createdAt
  };
  state.proposals.push(proposal);
  appendEvent({
    roomId,
    proposalId: id,
    type: "proposal.created",
    sender: "Orchestrator",
    payload: proposalBody
  });
  persistState();
  return proposal;
}

export function getProposal(proposalId: string) {
  return state.proposals.find((proposal) => proposal.id === proposalId);
}

export function requireProposal(proposalId: string) {
  const proposal = getProposal(proposalId);
  if (!proposal) throw new Error(`proposal ${proposalId} not found`);
  return proposal;
}

export function setProposalStatus(proposalId: string, status: ProposalStatus, patch: Partial<Proposal> = {}) {
  const proposal = requireProposal(proposalId);
  Object.assign(proposal, patch, { status, updatedAt: nowIso() });
  persistState();
  return proposal;
}

export function appendEvent(input: {
  roomId: string;
  proposalId: string;
  type: RoomEventType;
  sender: AgentName;
  payload: unknown;
}) {
  const event: RoomEvent = {
    id: makeId("evt"),
    roomId: input.roomId,
    proposalId: input.proposalId,
    type: input.type,
    sender: input.sender,
    payload: input.payload,
    payloadHash: hashPayload(input.payload),
    createdAt: nowIso()
  };
  state.events.push(event);
  persistState();
  return event;
}

export function getRoomEvents(roomId: string) {
  return state.events.filter((event) => event.roomId === roomId);
}

function persistState() {
  fs.mkdirSync(path.dirname(dumpPath), { recursive: true });
  fs.writeFileSync(dumpPath, JSON.stringify(state, null, 2));
}
