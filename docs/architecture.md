# High-Level Architecture

The system is a three-agent treasury decision council. The backend explicitly invokes agents in sequence, stores a visible decision-room event trace, and commits final accountability records on Monad.

## Runtime Planes

- Frontend: creates proposals and shows timeline/reports/proofs.
- Backend: owns lifecycle, state, orchestration, and chain writes.
- Agents: deterministic functions with role-specific tool routers.
- Tools: synthetic DeFi data, yield scoring, risk scoring, policy checks, canonical hashing.
- Contracts: `AgentRegistry` and `TreasuryDecisionRegistry`.

## Execution Flow

1. `POST /api/proposals` creates proposal and `proposal.created` event.
2. `POST /api/proposals/:proposalId/run` invokes `ResearchAgent`.
3. Backend appends `analysis.submitted` and `vote.cast`.
4. Backend invokes `SkepticAgent` and appends its events.
5. Backend invokes `CouncilAgent` and appends `decision.finalized` plus council vote.
6. Backend records final decision on Monad or mock chain mode.
7. Backend awaits receipt/proof and marks proposal `recorded_on_chain`.

## Boundary Rule

- Private agent context stays off-chain and per-run.
- Shared room context contains structured events only.
- Monad stores final commitments, votes, identities, hashes, and transaction metadata.
