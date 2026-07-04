---
inclusion: always
---

<!-- SOURCE: therealharpaljadeja/monskills — gas/SKILL.md -->
<!-- skill: gas | description: How gas pricing works on Monad and how it differs from Ethereum -->

# Gas Pricing on Monad

Monad's gas pricing is EIP-1559 compatible but differs from Ethereum in critical ways.

## Key Difference: Monad Charges on Gas **Limit**, Not Gas Used

On Ethereum, users pay for gas actually consumed. On Monad:
```
gas_paid = gas_limit * price_per_gas
```
This is because Monad uses asynchronous execution — block leaders build blocks before executing them, so actual gas consumption isn't known at inclusion time.

**Impact:**
- Setting an unnecessarily high gas limit directly costs users more MON.
- Always set tight, accurate gas limits.
- For native MON transfers: gas cost is always 21,000 — hardcode this, don't rely on `eth_estimateGas`.

## EIP-1559 Transaction Pricing
```
price_per_gas = min(base_price_per_gas + priority_price_per_gas, max_price_per_gas)
```

## Block and Transaction Limits

| Parameter | Value |
|-----------|-------|
| Block gas limit | 200M gas |
| Transaction gas limit | 30M gas |
| Minimum base fee | 100 MON-gwei (100 × 10⁻⁹ MON) |

## Base Fee Controller
Monad's base fee **increases more slowly and decreases more quickly** than Ethereum's — preventing blockspace underutilization from overpricing. Gas prices are more stable and recover faster after spikes.

## Developer Guidelines

### Set Explicit Gas Limits for Known Costs
```typescript
// Good: explicit gas limit for a native transfer
const tx = {
  to: recipient,
  value: parseEther("1.0"),
  gasLimit: 21000n,
};
```

### Gas Estimation in Frontend Code
```typescript
// Keep buffer small — the estimate is what users actually pay
const estimate = await publicClient.estimateGas({ ... });
const gasLimit = estimate + (estimate / 10n); // 10% buffer at most
```

### Displaying Gas Costs to Users
```typescript
// Calculate from gas limit, not gas used
const gasCost = gasLimit * gasPrice;
```

## Opcode Pricing Differences

### Cold State Access is Much More Expensive

| Operation | Ethereum | Monad | Increase |
|-----------|----------|-------|----------|
| Account access (cold) | 2,600 | 10,100 | +7,500 |
| Storage access (cold) | 2,100 | 8,100 | +6,000 |
| Account access (warm) | 100 | 100 | unchanged |
| Storage access (warm) | 100 | 100 | unchanged |

Affected opcodes (account): `BALANCE`, `EXTCODESIZE`, `EXTCODECOPY`, `EXTCODEHASH`, `CALL`, `CALLCODE`, `DELEGATECALL`, `STATICCALL`, `SELFDESTRUCT`
Affected opcodes (storage): `SLOAD`, `SSTORE`

Contracts that touch many cold storage slots or call many external contracts will cost significantly more on Monad.

### Precompile Repricing (2-5x more than Ethereum)

| Precompile | Address | Ethereum | Monad | Multiplier |
|------------|---------|----------|-------|------------|
| ecRecover | 0x01 | 3,000 | 6,000 | 2x |
| ecAdd | 0x06 | 150 | 300 | 2x |
| ecMul | 0x07 | 6,000 | 30,000 | 5x |
| ecPairing | 0x08 | 45,000 | 225,000 | 5x |
| blake2f | 0x09 | rounds×1 | rounds×2 | 2x |
| point evaluation | 0x0a | 50,000 | 200,000 | 4x |

**Impact:** ZK-related operations (ecMul, ecPairing, point evaluation) are 4-5x more expensive. On-chain ZK proof verification gas estimates from Ethereum will be significantly off on Monad.
