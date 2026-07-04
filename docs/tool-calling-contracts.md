# Tool Calling Contracts

Agents use deterministic tool routers. Tools are ordinary TypeScript functions and return structured data.

## ResearchAgent Tools

```text
getTreasuryState
getProtocolDataset
calculateYieldScore
compareAllocationOptions
hashPayload
```

## SkepticAgent Tools

```text
getProtocolDataset
calculateRiskScore
checkPolicyViolations
generateFailureCases
hashPayload
```

## CouncilAgent Tools

```text
loadTreasuryPolicy
evaluatePolicy
aggregate report hashes
create final decision
recordDecisionOnChain
```

## Monad Write Tool Rules

`recordDecisionOnChain` must:

- Use mock mode when wallet/contract env vars are absent.
- Prefer MONSKILLS encrypted keystore when configured.
- Estimate gas and apply only a small buffer.
- Await receipt before returning success.
- Return tx hash, registry address, decision id, and gas limit.

Raw tool outputs may influence private context. Shared room events only publish structured summaries and hashes.
