import { useEffect, useMemo, useState } from "react";
import type { AgentReport, FinalDecision, Proposal, RoomEvent } from "../../shared/types";

type ProposalResponse = {
  proposal: Proposal;
  events: RoomEvent[];
  researchReport?: AgentReport;
  skepticReport?: AgentReport;
  finalDecision?: FinalDecision;
};

type ProtocolResponse = {
  protocols: Array<{ id: string; name: string; apy: number; tvl: number; liquidityScore: number; exploitHistory: boolean }>;
  treasuryPolicy: { maxAllocationPercent: number; minLiquidityScore: number; maxRiskScore: number; preferredReservePercent: number };
};

const api = {
  async protocols(): Promise<ProtocolResponse> {
    return fetch("/api/protocols").then((res) => res.json());
  },
  async createProposal(): Promise<ProposalResponse> {
    const body = {
      treasurySize: 100000,
      allocationPercent: 10,
      question: "Should this treasury allocate 10% to RiverLend, TurboLP, VaultSteady, or stay in reserve?",
      candidateProtocolIds: ["riverlend", "turbolp", "vaultsteady"]
    };
    return fetch("/api/proposals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((res) => res.json());
  },
  async runProposal(proposalId: string): Promise<ProposalResponse> {
    return fetch(`/api/proposals/${proposalId}/run`, { method: "POST" }).then((res) => res.json());
  },
  async proposal(proposalId: string): Promise<ProposalResponse> {
    return fetch(`/api/proposals/${proposalId}`).then((res) => res.json());
  }
};

export function App() {
  const [protocolData, setProtocolData] = useState<ProtocolResponse>();
  const [proposal, setProposal] = useState<Proposal>();
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.protocols().then(setProtocolData).catch((err) => setError(String(err)));
  }, []);

  useEffect(() => {
    if (!proposal) return;
    const timer = window.setInterval(() => {
      api.proposal(proposal.id)
        .then((response) => {
          setProposal(response.proposal);
          setEvents(response.events);
        })
        .catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [proposal?.id]);

  const researchReport = useMemo(() => latestPayload<AgentReport>(events, "analysis.submitted", "ResearchAgent"), [events]);
  const skepticReport = useMemo(() => latestPayload<AgentReport>(events, "analysis.submitted", "SkepticAgent"), [events]);
  const finalDecision = useMemo(() => latestPayload<FinalDecision>(events, "decision.finalized", "CouncilAgent"), [events]);
  const chainProof = useMemo(() => latestPayload<Record<string, unknown>>(events, "decision.recorded_on_chain", "Orchestrator"), [events]);

  async function createProposal() {
    setLoading(true);
    setError(undefined);
    try {
      const response = await api.createProposal();
      setProposal(response.proposal);
      setEvents(response.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function runCouncil() {
    if (!proposal) return;
    setLoading(true);
    setError(undefined);
    try {
      const response = await api.runProposal(proposal.id);
      setProposal(response.proposal);
      setEvents(response.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Monad Agent Treasury Council</p>
          <h1>Agents reason off-chain. Monad records accountability.</h1>
          <p className="heroCopy">
            A deterministic three-agent council evaluates treasury allocation options, publishes structured reports, and anchors the final decision hash on Monad.
          </p>
        </div>
        <div className="heroCard">
          <span>Architecture</span>
          <strong>Explicit orchestration</strong>
          <p>No polling, no background watchers. The backend invokes Research, Skeptic, and Council agents in order.</p>
        </div>
      </section>

      <section className="grid two">
        <div className="panel createPanel">
          <div className="panelHeader">
            <span>01</span>
            <h2>Create proposal</h2>
          </div>
          <p>Seeded question: should a 100,000 mock USDC treasury allocate 10% across RiverLend, TurboLP, VaultSteady, or stay in reserve?</p>
          <button onClick={createProposal} disabled={loading}>{proposal ? "Reset demo proposal" : "Create demo proposal"}</button>
          {proposal && <button className="secondary" onClick={runCouncil} disabled={loading || proposal.status === "recorded_on_chain"}>Run agent council</button>}
          {error && <p className="error">{error}</p>}
        </div>

        <div className="panel statusPanel">
          <div className="panelHeader">
            <span>02</span>
            <h2>Proposal status</h2>
          </div>
          {proposal ? (
            <dl>
              <dt>Status</dt><dd>{proposal.status}</dd>
              <dt>Proposal hash</dt><dd className="hash">{proposal.proposalHash}</dd>
              <dt>Tx hash</dt><dd className="hash">{proposal.chainTxHash ?? "not recorded yet"}</dd>
            </dl>
          ) : <p>No proposal created yet.</p>}
        </div>
      </section>

      {protocolData && <ProtocolStrip data={protocolData} />}

      <section className="grid three">
        <ReportCard title="ResearchAgent" subtitle="Upside and yield" report={researchReport} />
        <ReportCard title="SkepticAgent" subtitle="Risk and objections" report={skepticReport} />
        <DecisionCard decision={finalDecision} proof={chainProof} />
      </section>

      <section className="panel timelinePanel">
        <div className="panelHeader">
          <span>03</span>
          <h2>Decision room event log</h2>
        </div>
        <div className="timeline">
          {events.length === 0 && <p>No events yet.</p>}
          {events.map((event) => (
            <article key={event.id} className="event">
              <div>
                <strong>{event.type}</strong>
                <span>{event.sender}</span>
              </div>
              <code>{event.payloadHash}</code>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function ProtocolStrip({ data }: { data: ProtocolResponse }) {
  return (
    <section className="protocolStrip">
      {data.protocols.map((protocol) => (
        <article key={protocol.id}>
          <span>{protocol.name}</span>
          <strong>{protocol.apy}% APY</strong>
          <p>TVL ${protocol.tvl.toLocaleString()} Ã‚Â· liquidity {(protocol.liquidityScore * 100).toFixed(0)}% Ã‚Â· {protocol.exploitHistory ? "exploit seeded" : "clean history"}</p>
        </article>
      ))}
    </section>
  );
}

function ReportCard({ title, subtitle, report }: { title: string; subtitle: string; report?: AgentReport }) {
  return (
    <article className="panel reportCard">
      <div className="panelHeader"><span>{subtitle}</span><h2>{title}</h2></div>
      {report ? (
        <>
          <p>{report.summary}</p>
          <div className="metricRow"><span>Vote</span><strong>{voteLabel(report.vote)}</strong></div>
          <div className="metricRow"><span>Confidence</span><strong>{Math.round(report.confidence * 100)}%</strong></div>
          <code className="hash">{report.payloadHash}</code>
        </>
      ) : <p>Waiting for explicit backend invocation.</p>}
    </article>
  );
}

function DecisionCard({ decision, proof }: { decision?: FinalDecision; proof?: Record<string, unknown> }) {
  return (
    <article className="panel decisionCard">
      <div className="panelHeader"><span>Final</span><h2>Council decision</h2></div>
      {decision ? (
        <>
          <p>{decision.summary}</p>
          <div className="decisionBig">{decision.allocationPercent}% to {decision.selectedProtocolId}</div>
          <code className="hash">{decision.finalDecisionHash}</code>
          {proof && <p className="proof">Chain mode: {String(proof.mode)} Ã‚Â· tx {String(proof.txHash)}</p>}
        </>
      ) : <p>Final decision appears after both specialist agents submit reports.</p>}
    </article>
  );
}

function latestPayload<T>(events: RoomEvent[], type: RoomEvent["type"], sender: RoomEvent["sender"]): T | undefined {
  return [...events].reverse().find((event) => event.type === type && event.sender === sender)?.payload as T | undefined;
}

function voteLabel(vote: number) {
  return ["abstain", "reject", "conditional", "approve"][vote] ?? "unknown";
}
