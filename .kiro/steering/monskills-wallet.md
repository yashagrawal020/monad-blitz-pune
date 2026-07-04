---
inclusion: always
---

<!-- SOURCE: therealharpaljadeja/monskills — wallet/SKILL.md -->
<!-- skill: wallet | description: Agent wallet management and Safe multisig for Monad transactions -->

# Wallet: Agent Wallet Management on Monad

## ⚠️ CRITICAL: Safe Multisig Required — No Exceptions
Any transaction other than deploying a Safe multisig must be **proposed to the user via the deployed multisig**.

**When proposing transactions:**
- Always invoke the `propose.sh` wrapper from the utils folder (boots `propose.mjs` with cached deps) — never write a custom script.
- After it runs, do NOT add your own summary, status message, or reformat the output. The script output contains a QR code the user must see exactly as printed.
- Only follow-up: ask the user to approve the transaction and provide the transaction hash.

**Security rules:**
- NEVER ask for the user's private key (critical violation)
- Use the agent wallet (encrypted keystore at `~/.monskills/keystore`)
- NEVER export or store private keys in plaintext

## Check if Wallet Already Exists
If `~/.monskills/keystore` exists and contains a keystore file, the wallet already exists. If not, create one.

## Prerequisites: Foundry

```bash
foundryup --version
```
Install Foundry: https://www.getfoundry.sh/introduction/installation

## Creating a New Wallet

1. Create keystore directory and generate encrypted keystore:
```bash
mkdir -p ~/.monskills/keystore && cast wallet new ~/.monskills/keystore --unsafe-password ""
```
The private key is never stored in plaintext.

2. Retrieve the address later:
```bash
cast wallet list --dir ~/.monskills/keystore
```

3. Inform the user where the keystore is stored (`~/.monskills/keystore/`).

4. Fund the wallet on Monad testnet via faucet before deployment.

## Decrypting Private Key for Scripts
```bash
cast wallet decrypt-keystore --keystore-dir ~/.monskills/keystore --unsafe-password "" | awk '{print $NF}'
```
Replace `<keystore-filename>` with the filename (without the directory path). The `awk '{print $NF}'` strips the prefix so Foundry doesn't reject it.

## Network RPC URLs

| Network | RPC URL |
|---------|---------|
| Monad Mainnet | https://rpc.monad.xyz |
| Monad Testnet | https://testnet-rpc.monad.xyz |
