import cors from "cors";
import express from "express";
import { z } from "zod";
import { PROTOCOLS, TREASURY_POLICY } from "./data/demoData";
import { runProposalPipeline } from "./orchestrator";
import { createProposal, getProposal, getRoomEvents, getState } from "./store/state";

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const createProposalSchema = z.object({
  treasurySize: z.number().positive().default(100000),
  allocationPercent: z.number().min(1).max(25).default(10),
  question: z.string().min(10).default("Should this treasury allocate 10% to RiverLend, TurboLP, VaultSteady, or stay in reserve?"),
  candidateProtocolIds: z.array(z.string()).min(1).default(PROTOCOLS.map((protocol) => protocol.id))
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "monad-agent-treasury-council" });
});

app.get("/api/protocols", (_req, res) => {
  res.json({ protocols: PROTOCOLS, treasuryPolicy: TREASURY_POLICY });
});

app.get("/api/state", (_req, res) => {
  res.json(getState());
});

app.post("/api/proposals", (req, res) => {
  const parsed = createProposalSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const proposal = createProposal(parsed.data);
  res.status(201).json({ proposal, events: getRoomEvents(proposal.roomId) });
});

app.get("/api/proposals/:proposalId", (req, res) => {
  const proposal = getProposal(req.params.proposalId);
  if (!proposal) {
    res.status(404).json({ error: "proposal not found" });
    return;
  }
  res.json({ proposal, events: getRoomEvents(proposal.roomId) });
});

app.get("/api/rooms/:roomId/events", (req, res) => {
  res.json({ events: getRoomEvents(req.params.roomId) });
});

app.post("/api/proposals/:proposalId/run", async (req, res) => {
  try {
    const result = await runProposalPipeline(req.params.proposalId);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/proposals/:proposalId/record-on-chain", (_req, res) => {
  const proposal = getProposal(_req.params.proposalId);
  if (!proposal) {
    res.status(404).json({ error: "proposal not found" });
    return;
  }
  if (proposal.status === "recorded_on_chain") {
    res.json({ proposal, events: getRoomEvents(proposal.roomId) });
    return;
  }
  res.status(409).json({ error: "run the proposal pipeline first; MVP records on-chain during /run" });
});

app.listen(port, () => {
  console.log(`Monad Agent Treasury Council API listening on http://127.0.0.1:${port}`);
});
