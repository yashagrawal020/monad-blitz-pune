import type { ProtocolMetrics, TreasuryPolicy } from "../../shared/types";

export const TREASURY_POLICY: TreasuryPolicy = {
  maxAllocationPercent: 10,
  minLiquidityScore: 0.6,
  maxRiskScore: 6.5,
  preferredReservePercent: 50
};

export const PROTOCOLS: ProtocolMetrics[] = [
  { id: "riverlend", name: "RiverLend", apy: 8.4, tvl: 12000000, liquidityScore: 0.82, adminKeyRisk: 0.25, oracleRisk: 0.2, exploitHistory: false, volatilityScore: 0.28, lockupDays: 0 },
  { id: "turbolp", name: "TurboLP", apy: 31.2, tvl: 1800000, liquidityScore: 0.41, adminKeyRisk: 0.7, oracleRisk: 0.6, exploitHistory: true, volatilityScore: 0.84, lockupDays: 14 },
  { id: "vaultsteady", name: "VaultSteady", apy: 5.1, tvl: 42000000, liquidityScore: 0.92, adminKeyRisk: 0.12, oracleRisk: 0.1, exploitHistory: false, volatilityScore: 0.12, lockupDays: 2 }
];

export const DEFAULT_TREASURY = {
  id: "treasury-demo",
  asset: "mock USDC",
  balance: 100000,
  currentReservePercent: 100
};
