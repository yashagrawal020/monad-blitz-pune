const baseUrl = process.env.API_URL || "http://127.0.0.1:3001";

async function main() {
  const createRes = await fetch(`${baseUrl}/api/proposals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      treasurySize: 100000,
      allocationPercent: 10,
      question: "Should this treasury allocate 10% to RiverLend, TurboLP, VaultSteady, or stay in reserve?",
      candidateProtocolIds: ["riverlend", "turbolp", "vaultsteady"]
    })
  });
  if (!createRes.ok) throw new Error(`create failed ${createRes.status}`);
  const created = await createRes.json();
  const runRes = await fetch(`${baseUrl}/api/proposals/${created.proposal.id}/run`, { method: "POST" });
  if (!runRes.ok) throw new Error(`run failed ${runRes.status}: ${await runRes.text()}`);
  const result = await runRes.json();
  console.log(JSON.stringify({
    proposalId: result.proposal.id,
    status: result.proposal.status,
    txHash: result.proposal.chainTxHash,
    finalDecisionHash: result.finalDecision?.finalDecisionHash,
    eventCount: result.events.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
