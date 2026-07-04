---
inclusion: always
---

<!-- SOURCE: therealharpaljadeja/monskills — wallet-integration/SKILL.md -->
<!-- skill: wallet-integration | description: Wallet + auth for frontend on Monad using Para (embedded MPC wallets, social/email/passkey login, external wallet connect) -->

# Wallet Integration: Para on Monad

This skill covers adding wallet + authentication to a Monad frontend using **Para** and the `para` CLI (`@getpara/cli`).

Para provides:
- **Embedded MPC wallets** — email, phone, passkey, or social login (Google, Apple, Twitter, Discord, Facebook, Farcaster)
- **External wallet connect** — MetaMask, Coinbase, WalletConnect, Rainbow, Zerion, Rabby

This skill assumes the frontend already exists. Do not run `para create` — scaffolding is handled by the `scaffold` skill.

## Prerequisites
1. `@getpara/cli` installed globally: `npm install -g @getpara/cli`
2. `para login` completed (browser OAuth — only the user can complete it)
3. A Para organization and project selected as active context

**Do not install the CLI for the user. Do not run `para login` for the user.**

## Monad on Para
Para's `--networks` flag supports `evm`. Monad mainnet and testnet are EVM chains, but Para doesn't ship them as built-in chain objects. After `para init`, import from `wagmi/chains`:
```ts
import { monad, monadTestnet } from 'wagmi/chains'
```
Pass them through `externalWalletConfig.evmConnector.config.{chains,transports}` on `ParaProvider`. Default chain = first entry in `chains` array.

## v2 SDK — ParaProvider Props
v2 splits `ParaProvider` into four config objects (NOT a flat `apiKey={...}`):

```ts
<ParaProvider
  paraClientConfig={{ apiKey: "...", env: Environment.BETA }}
  config={{ appName: "My App" }}
  paraModalConfig={{
    oAuthMethods: ["GOOGLE", "TWITTER"],  // empty array = no social login
    disablePhoneLogin: false,
    recoverySecretStepEnabled: true,
  }}
  externalWalletConfig={{
    evmConnector: {
      config: {
        chains: [monadTestnet, monad],  // first = default chain
        transports: {
          [monadTestnet.id]: http("https://testnet-rpc.monad.xyz"),
          [monad.id]: http("https://rpc.monad.xyz"),
        }
      }
    },
    wallets: ["METAMASK", "COINBASE", "WALLETCONNECT"]
  }}
/>
```

There is no top-level `defaultChain` prop. No separate `wagmi.ts` `createConfig` needed.

## Integrate Para into Existing Frontend
```bash
cd web   # or wherever the frontend lives
para init
```

`para init` writes `.pararc` (org + project + environment context), then install SDK packages, wrap app in `ParaProvider`, import Para's CSS. Run `para doctor` after to verify.

In headless/sandboxed terminals (no real TTY):
```bash
para init --no-input
```

## Secrets Hygiene
- `para keys get --show-secret` / `--copy-secret` prints/copies the **secret** API key. Never echo it back or paste it into a committed file.
- Public key prefix: `NEXT_PUBLIC_PARA_API_KEY` (Next.js) or `VITE_PARA_API_KEY` (Vite).
- `.pararc` is safe to commit. `.env`/`.env.local` should be in `.gitignore`.

## Exit Code Contract

| Exit code | Meaning | How to react |
|-----------|---------|--------------|
| `0` | Success | Continue |
| `1` | User error (bad args, not logged in, `para doctor` found errors) | Read stderr, fix, retry |
| `2` | API/server error | Not user's fault. Retry once; if persists, stop. |

`para doctor --json` exits 1 when it finds errors — that's expected, not a bug.

## Official Docs
- CLI overview: https://docs.getpara.com/v2/cli/overview
- Installation: https://docs.getpara.com/v2/cli/installation
- Command reference: https://docs.getpara.com/v2/cli/commands
