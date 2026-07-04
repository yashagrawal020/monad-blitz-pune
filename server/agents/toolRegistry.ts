import type { AgentReport, FinalDecision, Proposal } from "../../shared/types";
import {
  calculateRiskScore,
  calculateYieldScore,
  checkPolicyViolations,
  compareAllocationOptions,
  evaluatePolicy,
  generateFailureCases,
  getCandidateProtocols,
  getProtocolDataset,
  getTreasuryState,
  loadTreasuryPolicy
} from "../tools/defiTools";

export type AgentToolContext = {
  proposal: Proposal;
  researchReport?: AgentReport;
  skepticReport?: AgentReport;
};

export type AgentTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, context: AgentToolContext) => unknown;
};

export function researchTools(): AgentTool[] {
  return [
    {
      name: "getTreasuryState",
      description: "Read the current treasury balance and asset for the proposal.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      execute: (_args, context) => getTreasuryState(context.proposal)
    },
    {
      name: "getCandidateProtocols",
      description: "Read the protocol candidates selected in the proposal.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      execute: (_args, context) => getCandidateProtocols(context.proposal)
    },
    {
      name: "calculateYieldScore",
      description: "Calculate a 0-10 yield/opportunity score for one protocol id.",
      parameters: {
        type: "object",
        properties: { protocolId: { type: "string" } },
        required: ["protocolId"],
        additionalProperties: false
      },
      execute: (args) => {
        const protocol = requireProtocol(String(args.protocolId));
        return { protocolId: protocol.id, protocolName: protocol.name, yieldScore: calculateYieldScore(protocol) };
      }
    },
    {
      name: "compareAllocationOptions",
      description: "Rank candidate protocols by yield-adjusted opportunity.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      execute: (_args, context) => compareAllocationOptions(getCandidateProtocols(context.proposal))
    }
  ];
}

export function skepticTools(): AgentTool[] {
  return [
    {
      name: "getCandidateProtocols",
      description: "Read the protocol candidates selected in the proposal.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      execute: (_args, context) => getCandidateProtocols(context.proposal)
    },
    {
      name: "calculateRiskScore",
      description: "Calculate a 0-10 downside/risk score for one protocol id.",
      parameters: {
        type: "object",
        properties: { protocolId: { type: "string" } },
        required: ["protocolId"],
        additionalProperties: false
      },
      execute: (args) => {
        const protocol = requireProtocol(String(args.protocolId));
        return { protocolId: protocol.id, protocolName: protocol.name, riskScore: calculateRiskScore(protocol) };
      }
    },
    {
      name: "checkPolicyViolations",
      description: "Check whether a protocol violates treasury risk policy.",
      parameters: {
        type: "object",
        properties: { protocolId: { type: "string" } },
        required: ["protocolId"],
        additionalProperties: false
      },
      execute: (args) => {
        const protocol = requireProtocol(String(args.protocolId));
        return { protocolId: protocol.id, violations: checkPolicyViolations(protocol, loadTreasuryPolicy()) };
      }
    },
    {
      name: "generateFailureCases",
      description: "Generate adversarial failure cases for one protocol id.",
      parameters: {
        type: "object",
        properties: { protocolId: { type: "string" } },
        required: ["protocolId"],
        additionalProperties: false
      },
      execute: (args) => {
        const protocol = requireProtocol(String(args.protocolId));
        return { protocolId: protocol.id, failureCases: generateFailureCases(protocol) };
      }
    }
  ];
}

export function councilTools(): AgentTool[] {
  return [
    {
      name: "loadTreasuryPolicy",
      description: "Read the treasury policy used to judge the final allocation.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      execute: () => loadTreasuryPolicy()
    },
    {
      name: "evaluatePolicy",
      description: "Evaluate a proposed protocol allocation against treasury policy.",
      parameters: {
        type: "object",
        properties: {
          protocolId: { type: "string" },
          allocationPercent: { type: "number" }
        },
        required: ["protocolId", "allocationPercent"],
        additionalProperties: false
      },
      execute: (args) => {
        const protocol = requireProtocol(String(args.protocolId));
        return {
          protocolId: protocol.id,
          allocationPercent: Number(args.allocationPercent),
          policyResult: evaluatePolicy(protocol, Number(args.allocationPercent), loadTreasuryPolicy())
        };
      }
    },
    {
      name: "aggregateVotes",
      description: "Aggregate the injected specialist reports and propose a final vote direction.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      execute: (_args, context) => {
        if (!context.researchReport || !context.skepticReport) {
          throw new Error("aggregateVotes requires injected research and skeptic reports");
        }
        return {
          researchVote: context.researchReport.vote,
          skepticVote: context.skepticReport.vote,
          researchTarget: context.researchReport.targetProtocolId,
          skepticTarget: context.skepticReport.targetProtocolId
        };
      }
    }
  ];
}

export function summarizeToolResult(result: unknown) {
  const value = JSON.stringify(result);
  return value.length > 220 ? `${value.slice(0, 217)}...` : value;
}

function requireProtocol(protocolId: string) {
  const protocol = getProtocolDataset().find((candidate) => candidate.id === protocolId);
  if (!protocol) throw new Error(`unknown protocol id ${protocolId}`);
  return protocol;
}
