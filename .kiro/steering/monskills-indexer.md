---
inclusion: always
---

<!-- SOURCE: therealharpaljadeja/monskills — indexer/SKILL.md -->
<!-- skill: indexer | description: Setup Envio HyperIndex to capture onchain smart contract events -->

# Indexer: Envio HyperIndex on Monad

Use when the user wants a historical feed, activity feed, event tracking, or any feature requiring indexing of onchain smart contract events. Also use for debugging, restarting, promoting, or deleting an existing Envio Cloud indexer.

## Prerequisites (all four required)
1. `envio-cloud` installed globally: `npm install -g envio-cloud`
2. `envio-cloud` logged in: `envio-cloud login` (browser flow, 30-day session)
3. GitHub CLI installed: `brew install gh` (macOS) or https://cli.github.com/
4. GitHub CLI logged in: `gh auth login`

**Do not run `envio-cloud login` or `gh auth login` for the user.** Both require browser-based OAuth.

**Hard prereq:** The contract must be **deployed AND verified** on a Monad explorer before running `init`. `contract-import` pulls the ABI from the explorer — an unverified contract will fail.

## Initialize a New Indexer

Create and `cd` into the `indexer/` folder first.

### Monad Mainnet
```bash
mkdir -p indexer && cd indexer
pnpx envio@3.0.0-alpha.21 init contract-import explorer \
  -b monad \
  -c <CONTRACT_ADDRESS> \
  -n <CONTRACT_NAME> \
  -l typescript \
  -d ./ -o ./ \
  --all-events --single-contract --api-token ""
```

### Monad Testnet
```bash
mkdir -p indexer && cd indexer
pnpx envio@3.0.0-alpha.21 init contract-import explorer \
  -b monad-testnet \
  -c <CONTRACT_ADDRESS> \
  -n <CONTRACT_NAME> \
  -l typescript \
  -d ./ -o ./ \
  --all-events --single-contract --api-token ""
```

**Notes:**
- `<CONTRACT_ADDRESS>` — deployed, verified contract address
- `<CONTRACT_NAME>` — Solidity contract name (e.g. `MyToken`)
- `--api-token ""` — leave empty intentionally
- Version pinned to `envio@3.0.0-alpha.21` — use exactly this
- `-l typescript` is a flag, not positional

## Opt Into Transaction Fields
By default, `event.transaction.*` is typed `never`. Add to `config.yaml` before writing handlers:
```yaml
field_selection:
  transaction_fields:
    - hash
```
Place at top level (sibling of `networks:`, `contracts:`). After editing, re-run:
```bash
pnpm codegen   # or: pnpx envio@3.0.0-alpha.21 codegen
```

## Exit Code Contract

| Exit code | Meaning | How to react |
|-----------|---------|--------------|
| `0` | Success | Continue |
| `1` | User error (bad args, unknown indexer, not logged in) | Read stderr, fix input, retry |
| `2` | API/server error | Not user's fault. Retry once; if persists, tell user and stop. |

`envio-cloud` deploy output is on Envio Cloud. Push to GitHub (`gh`) first — Envio Cloud deploys from GitHub.

## Official Docs
https://docs.envio.dev/docs/HyperIndex/envio-cloud-cli
