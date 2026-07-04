# Agent Context Model

## Private Context

Private context is in-memory for the current agent run. It may include raw tool outputs, intermediate scores, assumptions, and scratch notes. It is not shared directly and is never written on-chain.

## Shared Room Context

Shared room context is the backend event log. Events are visible in the UI and contain summaries, scores, votes, and deterministic hashes.

Event types:

```text
proposal.created
analysis.submitted
vote.cast
decision.finalized
decision.recorded_on_chain
error.raised
```

## On-Chain Context

On-chain context is limited to identity and decision commitments:

```text
agent ids
proposal hash
research report hash
skeptic report hash
final decision hash
votes
tx hash
```

This preserves auditability without leaking private reasoning or raw tool data.
