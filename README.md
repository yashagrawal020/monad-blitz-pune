# Monad Agent Treasury Council

A Monad-backed multi-agent decision council for DeFi treasury allocation. Agents reason off-chain, publish structured outputs to a decision room, and commit final decision hashes/votes on-chain.

Built with MONSKILLS for Monad testnet.

## What It Demonstrates

- Explicit backend orchestration instead of autonomous polling.
- Three deterministic specialist agents: ResearchAgent, SkepticAgent, CouncilAgent.
- Tool-calling for yield scoring, risk scoring, policy checks, and canonical hashing.
- On-chain identity through `AgentRegistry`.
- On-chain decision accountability through `TreasuryDecisionRegistry`.
- Monad-specific UX: fast finality, synchronous receipt waiting, and explicit gas-limit handling.
- Monad-specific parallel commit demo: three independent proposal decisions are submitted concurrently from three wallets.
- Frontend timeline showing off-chain reasoning and final chain proof.

## Quick Start

```powershell
npm install
npm test
npm run compile
npm run test:contracts
npm run dev
```

Open `http://127.0.0.1:5173`.

Use the UI:

1. Click `Create demo proposal`.
2. Click `Run agent council`.
3. Watch the event timeline, reports, and final proof panel.
4. Click `Run Monad Parallel Demo` to run three councils and submit the final decision commits concurrently.

If wallet and contract env vars are not configured, the backend records a deterministic mock proof. This keeps the local demo runnable before deploying contracts.

## Monad Testnet Setup

Copy `.env.example` to `.env`.

Preferred MONSKILLS wallet path:

```text
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
MONAD_CHAIN_ID=10143
MONSKILLS_KEYSTORE_DIR=~/.monskills/keystore
MONSKILLS_KEYSTORE_FILE=<your-keystore-file>
TREASURY_DECISION_REGISTRY_ADDRESS=0x...
```

Create/list keystores with Foundry if needed:

```powershell
cast wallet new ~/.monskills/keystore --unsafe-password ""
cast wallet list --dir ~/.monskills/keystore
```

A `PRIVATE_KEY` env var is still supported only as a throwaway testnet fallback. Do not commit real keys.

Deploy contracts after funding the wallet. Because Monad uses async execution, newly funded accounts may need about 1.2 seconds before they can send a follow-up transaction.

```powershell
npm run deploy:monad
```

The deployment script writes `.tmp/deployment.json`; the backend can read this file if explicit contract env vars are omitted.

For the live parallel demo, configure three funded keystore files:

```text
PARALLEL_MONSKILLS_KEYSTORE_FILES=file1,file2,file3
PARALLEL_RECORD_DECISION_GAS_LIMIT=650000
```

If Foundry/cast keystores are unavailable during the hackathon, use funded testnet burner private keys instead:

```text
PARALLEL_PRIVATE_KEYS=0xkey1,0xkey2,0xkey3
PARALLEL_RECORD_DECISION_GAS_LIMIT=650000
```

The councils run sequentially for reliability. Only the three final `recordDecision` transactions are fired concurrently. This keeps the demo focused on Monad's independent transaction execution instead of LLM concurrency.

## Monad Notes Applied

- Monad is EVM-compatible, so the app uses Solidity, Hardhat, and viem.
- The backend awaits the decision transaction receipt before marking `recorded_on_chain`; Monad finality is fast enough for this to be demo-friendly.
- Monad charges based on gas limit, so the chain client estimates gas and applies only a 10% buffer for the `recordDecision` call.
- The parallel demo hardcodes the `recordDecision` gas limit to avoid live estimation variance during the timed run.
- Parallel demo transactions write to `decisionsByProposalId[proposalId]` and use three wallets to avoid shared storage counters and account nonce serialization.
- Never use unverified/hallucinated contract addresses. Deployment output is written to `.tmp/deployment.json`, and production/testnet addresses should be verified on the explorer before use.

## Architecture

```text
Frontend Dashboard
  -> create proposal
  -> display event timeline
  -> display agent reports
  -> display final decision and tx proof

Backend Orchestrator
  -> owns proposal lifecycle
  -> invokes agents directly
  -> appends room events
  -> records final decision on-chain

Agent Runtime
  -> ResearchAgent
  -> SkepticAgent
  -> CouncilAgent

Tool Layer
  -> synthetic DeFi dataset
  -> yield/risk scoring
  -> policy checks
  -> canonical hashing
  -> Monad write adapter

Monad Contracts
  -> AgentRegistry
  -> TreasuryDecisionRegistry
```

## API

```text
GET  /api/health
GET  /api/protocols
GET  /api/state
POST /api/proposals
GET  /api/proposals/:proposalId
GET  /api/rooms/:roomId/events
POST /api/proposals/:proposalId/run
POST /api/proposals/:proposalId/record-on-chain
POST /api/demo/parallel
```

`POST /api/proposals/:proposalId/run` executes the full MVP pipeline.
`POST /api/demo/parallel` creates three seeded proposals, prepares each council decision, and commits all three final decisions concurrently.

## Non-Goals For MVP

- No autonomous polling.
- No P2P or WebSocket transport.
- No x402 payment flow.
- No real DeFi protocol integration.
- No autonomous treasury execution.
- No private context stored on-chain.
