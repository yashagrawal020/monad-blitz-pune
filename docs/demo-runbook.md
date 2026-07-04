# Demo Runbook

## Local Mock-Proof Demo

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

1. Create demo proposal.
2. Run agent council.
3. Verify timeline includes eight events.
4. Verify final decision hash and mock tx hash are visible.

## CLI Seed Demo

With the API server running:

```powershell
npm run demo:seed
```

Expected output includes:

```text
status: recorded_on_chain
txHash: 0x...
finalDecisionHash: 0x...
eventCount: 8
```

## Monad Testnet Demo

1. Copy `.env.example` to `.env`.
2. Add `MONSKILLS_KEYSTORE_FILE` for the funded agent wallet, or use a throwaway `PRIVATE_KEY` only for local/testnet fallback.
3. Run `npm run deploy:monad`.
4. Confirm `.tmp/deployment.json` contains contract addresses.
5. Run `npm run dev`.
6. Execute the UI demo.

Notes:

- Newly funded accounts can need about 1.2 seconds before sending follow-up transactions because Monad consensus uses a delayed state view.
- The app estimates gas and adds a 10% buffer before `recordDecision` so users are not charged for excessive gas limits.
- The backend waits for the transaction receipt before setting proposal status to `recorded_on_chain`.
