# On-Chain Identity And Decision Spec

## AgentRegistry

Stores wallet-bound agent identity records:

```text
owner
name
role
agentURI
capabilitiesHash
contextPolicyHash
active
createdAt
```

The registry is ERC-8004-inspired but intentionally minimal for the hackathon MVP.

## TreasuryDecisionRegistry

Stores final decision commitments:

```text
proposalId
proposer
researchAgentId
skepticAgentId
councilAgentId
proposalHash
researchReportHash
skepticReportHash
finalDecisionHash
researchVote
skepticVote
councilVote
decisionURI
createdAt
```

Vote encoding:

```text
0 abstain
1 reject
2 conditional
3 approve
```

Full reports and private agent context stay off-chain.

## Monad-Specific Rules

- Use deployed addresses from `.tmp/deployment.json` or env vars; verify real addresses before use.
- Do not hallucinate protocol/contract addresses.
- Prefer MONSKILLS encrypted keystore for deploy/write flows.
- Use tight gas limits because Monad charges by gas limit, not gas used.
- The backend waits for receipt before setting `recorded_on_chain`; Monad finality makes this viable for the demo.
