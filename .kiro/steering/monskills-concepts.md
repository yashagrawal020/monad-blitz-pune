---
inclusion: always
---

<!-- SOURCE: therealharpaljadeja/monskills — concepts/SKILL.md -->
<!-- skill: concepts | description: Monad architecture concepts that affect how developers build apps -->

# Monad Architecture Concepts

Monad is Ethereum-compatible but its architecture introduces behaviors developers must understand.

## Quick Reference

| Issue / Task | Concept |
|---|---|
| Newly funded accounts can't send transactions, funding delays | Async execution |
| Whether existing Solidity contracts need changes for Monad | Parallel execution |
| Choosing between `latest`, `safe`, `finalized` block tags | Block states |
| Transaction reverts due to low balance, 10 MON floor, emptying transactions | Reserve balance |
| Smart wallet delegation, EIP-7702, session keys, gas sponsorship | EIP-7702 |
| Subscribing to events, WebSocket feeds, high-throughput data ingestion | Real-time data |
| Block lifecycle events, speculative data, BLOCK_START/QC/FINALIZED | Execution events |

## Quick Summaries

### Async Execution
Consensus and execution are decoupled. 3-block delayed state view. Newly funded accounts need ~1.2s before sending txs.

### Parallel Execution
Optimistic concurrency — produces identical results to Ethereum sequential execution. No contract changes needed.

### Block States
Proposed → Voted → Finalized → Verified. Maps to `latest` / `safe` / `finalized`.

### Reserve Balance
10 MON floor per EOA. Low-balance accounts are limited to 1 tx per ~1.2s. Never drain a wallet to exactly 0 MON — keep at least 10 MON.

### EIP-7702
EOAs can delegate to contracts for smart wallet features (session keys, gas sponsorship). The 10 MON floor applies. No `CREATE`/`CREATE2` in a delegated context.

### Real-time Data
Three sources:
1. **Geth-compatible WebSocket** — most apps use this
2. **Monad extended WebSocket** — additional Monad-specific events
3. **Execution Events SDK** — consensus events + speculative EVM traces

### Execution Events
Consensus events track block state transitions. Execution events are speculative EVM traces that arrive before finalization.

## Chain IDs

| Network | Chain ID |
|---------|---------|
| Monad Mainnet | 143 |
| Monad Testnet | 10143 |

## RPC Endpoints

| Network | RPC URL |
|---------|---------|
| Monad Mainnet | https://rpc.monad.xyz |
| Monad Testnet | https://testnet-rpc.monad.xyz |
