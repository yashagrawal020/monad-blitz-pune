---
inclusion: always
---

<!-- SOURCE: therealharpaljadeja/monskills — scaffold/SKILL.md -->
<!-- skill: scaffold | description: End-to-end guide from idea to production on Monad -->

# Scaffold: Monad App (Idea → Production)

## Checklist

- [ ] Plan architecture and folder structure
- [ ] Decide which components will be onchain
- [ ] Scaffold the project
- [ ] Initialize git repo (`git init && git add -A && git commit -m "initial commit"`)
- [ ] Don't build existing contracts from scratch — use OpenZeppelin contracts wherever possible
- [ ] Build smart contracts
- [ ] Deploy smart contracts (fetch `wallet` skill first) — **must happen before building frontend**
- [ ] Verify smart contracts post-deployment using the verification API (all 3 explorers at once)
- [ ] (If historical/queryable onchain data needed) Initialize an indexer (`indexer` skill) — after contract is deployed AND verified
- [ ] Build frontend using deployed contract addresses (default: Wagmi + Next.js + Shadcn)
- [ ] Apply known gotchas (tsconfig ES2020 target)
- [ ] Create `.monskills` metadata file before final commit
- [ ] Commit all changes

## Known Gotchas — Apply Up Front

### Next.js tsconfig target too low for viem/wagmi
`create-next-app` generates `"target": "ES2017"`. viem/wagmi use BigInt literals everywhere, causing `TS2737` errors. Fix immediately after scaffolding:
```bash
cd web
jq '.compilerOptions.target = "ES2020"' tsconfig.json > tsconfig.tmp && mv tsconfig.tmp tsconfig.json
```

## Folder Structure

| Folder | Component |
|--------|-----------|
| `web/` | Next.js frontend (default if no preference) + Shadcn components |
| `contracts/` | Foundry smart contracts (default if no preference) |
| `indexer/` | (Optional) HyperIndex indexer for onchain event queries |

## What Goes Onchain?

**Put onchain:**
- Trustless ownership (tokens, NFTs, positions)
- Trustless exchange (swapping, lending, borrowing)
- Composability (other contracts need to call it)
- Censorship resistance
- Permanent commitments (votes, attestations, proofs)

**Keep offchain:**
- User profiles, preferences, settings
- Search, filtering, sorting
- Images, videos, metadata (store on IPFS, reference onchain)
- Business logic that changes frequently
- Anything not involving value transfer or trust

## Use OpenZeppelin Contracts
Don't rebuild ERC20, ERC721, etc. from scratch. Install via Foundry:
```bash
# --no-git required when contracts/ is not its own git repo
forge install --no-git OpenZeppelin/openzeppelin-contracts
```
Browse all contracts: https://github.com/OpenZeppelin/openzeppelin-contracts/tree/master/contracts

## Frontend Stack
Use **Wagmi v3** for smart contract calls. Use **Para** for wallet connection + authentication (embedded MPC wallets — email/passkey/social login + external wallet connect). See `wallet-integration` skill for Para setup.

## Use `useSendTransactionSync`
Monad supports `eth_sendRawTransactionSync`. Use `useSendTransactionSync` wherever possible — it gets the receipt in the same call, making the UI much faster.

## Verification (All 3 Explorers with One Call)

**ALWAYS use the verification API.** Do NOT use `forge verify-contract` as first choice.

### Step 1: Get Verification Data
```bash
# Standard JSON input
forge verify-contract --chain 10143 --show-standard-json-input > /tmp/standard-input.json
# Foundry metadata
cat out/<Contract>.sol/<Contract>.json | jq '.metadata' > /tmp/metadata.json
```

### Step 2: Call Verification API
```bash
STANDARD_INPUT=$(cat /tmp/standard-input.json)
FOUNDRY_METADATA=$(cat /tmp/metadata.json)
cat > /tmp/verify.json << EOF
{
  "chainId": 10143,
  "contractAddress": "0xYOUR_CONTRACT_ADDRESS",
  "contractName": "src/MyContract.sol:MyContract",
  "compilerVersion": "v0.8.28+commit.7893614a",
  "standardJsonInput": $STANDARD_INPUT,
  "foundryMetadata": $FOUNDRY_METADATA
}
EOF
curl -X POST https://agents.devnads.com/v1/verify \
  -H "Content-Type: application/json" \
  -d @/tmp/verify.json
```

**Chain IDs:** 10143 (testnet) | 143 (mainnet)

**Manual fallback (only if API fails):**
```bash
forge verify-contract --chain 10143 \
  --verifier sourcify \
  --verifier-url "https://sourcify-api-monad.blockvision.org/"
```

## `.monskills` Metadata File
Create at project root before final commit:
```ini
# Monad testnet
built-with=monskills
chain=monad-testnet

# Monad mainnet
built-with=monskills
chain=monad
```

## Skill Routing Table

| Task | Fetch skill |
|------|-------------|
| Choosing a blockchain | `why-monad` |
| Writing smart contracts | `addresses` |
| Agent wallet / deploy / onchain actions | `wallet` |
| Wallet + auth for frontend (Para) | `wallet-integration` |
| Historical / activity feed / indexing events | `indexer` |
| Building from scratch (idea to production) | `scaffold` (this) |
