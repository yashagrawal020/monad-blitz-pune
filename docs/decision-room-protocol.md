# Decision Room Protocol

The decision room is a backend event log, not a polling bus. Agents do not subscribe. The orchestrator calls each agent directly and appends events for traceability.

## Event Envelope

```json
{
  "id": "evt_...",
  "roomId": "room_...",
  "proposalId": "proposal_...",
  "type": "analysis.submitted",
  "sender": "ResearchAgent",
  "payload": {},
  "payloadHash": "0x...",
  "createdAt": "..."
}
```

## Required Ordering

```text
proposal.created
ResearchAgent analysis.submitted
ResearchAgent vote.cast
SkepticAgent analysis.submitted
SkepticAgent vote.cast
CouncilAgent decision.finalized
CouncilAgent vote.cast
decision.recorded_on_chain
```
