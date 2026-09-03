const form = document.querySelector("#preflight-form");
const result = document.querySelector("#result");
const emptyState = document.querySelector("#empty-state");
const runButton = document.querySelector("#run-preflight");
const trace = document.querySelector("#agent-trace");
const sourceLabel = document.querySelector("#source-label");
let latestReport = null;

const formatUsd = (value, digits = 2) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
}).format(value);

function now() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function setTrace(steps, danger = false) {
  trace.innerHTML = steps.map((step, index) => `
    <li class="${danger && index === steps.length - 1 ? "danger" : ""}" style="animation-delay:${index * 55}ms">
      <time>${step.time}</time><span>${step.label}</span>
    </li>
  `).join("");
}

async function checkMarket() {
  try {
    const symbol = document.querySelector("#symbol").value;
    const response = await fetch(`/api/market?symbol=${symbol}`);
    const market = await response.json();
    sourceLabel.textContent = market.source === "BINANCE_PUBLIC_API" ? "BINANCE REST LIVE" : "DEMO DATA";
  } catch {
    sourceLabel.textContent = "OFFLINE";
  }
}

function inputPayload() {
  const data = new FormData(form);
  return {
    symbol: data.get("symbol"),
    side: data.get("side"),
    quoteAmount: Number(data.get("quoteAmount")),
    portfolioValue: Number(data.get("portfolioValue")),
    maxAllocationPct: Number(data.get("maxAllocationPct")),
    maxOrderUsdt: Number(data.get("maxOrderUsdt")),
    maxSlippageBps: Number(data.get("maxSlippageBps"))
  };
}

function renderReport(report) {
  latestReport = report;
  emptyState.classList.add("hidden");
  result.classList.remove("hidden");

  const badge = document.querySelector("#decision-badge");
  badge.className = `decision-badge ${report.decision.toLowerCase()}`;
  document.querySelector("#decision").textContent = report.decision;
  document.querySelector("#risk-score").textContent = String(report.riskScore).padStart(2, "0");
  document.querySelector("#report-time").textContent = new Date(report.generatedAt).toLocaleTimeString("en-GB", { hour12: false });
  document.querySelector("#mid-price").textContent = formatUsd(report.market.midPrice, report.market.midPrice > 1000 ? 0 : 2);
  document.querySelector("#spread").textContent = `${report.market.spreadBps.toFixed(2)} BPS`;
  document.querySelector("#change").textContent = `${report.market.change24hPct >= 0 ? "+" : ""}${report.market.change24hPct.toFixed(2)}%`;
  document.querySelector("#depth").textContent = formatUsd(report.market.depth50Bps, 0);
  document.querySelector("#order-summary").textContent = `${report.side} ${formatUsd(report.proposedOrder.quoteOrderQty, 0)} ${report.symbol}`;

  document.querySelector("#checks").innerHTML = report.checks.map((check) => `
    <div class="check-row ${check.status.toLowerCase()}">
      <i>${check.status === "PASS" ? "✓" : check.status === "WARN" ? "!" : "×"}</i>
      <span>${check.label}</span>
      <small>${check.detail}</small>
    </div>
  `).join("");

  const steps = [
    { time: now(), label: `Intent parsed: ${report.side} ${report.symbol}` },
    { time: now(), label: `Market snapshot: ${report.market.source.replaceAll("_", " ")}` },
    { time: now(), label: `Simulated ${report.simulation.levelsConsumed} order-book level(s)` },
    { time: now(), label: `Ran ${report.checks.length} permission and risk controls` },
    { time: now(), label: `${report.decision}: execution held behind human gate` }
  ];
  setTrace(steps, report.decision === "BLOCK");
  sourceLabel.textContent = report.market.source === "BINANCE_PUBLIC_API" ? "BINANCE REST LIVE" : "DEMO DATA";
}

runButton.addEventListener("click", async () => {
  runButton.disabled = true;
  runButton.querySelector("span").textContent = "ANALYZING…";
  setTrace([{ time: now(), label: "Agent accepted order intent" }, { time: now(), label: "Fetching Binance order book…" }]);

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(inputPayload())
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || "Analysis failed");
    renderReport(report);
  } catch (error) {
    setTrace([
      { time: now(), label: "Preflight interrupted" },
      { time: now(), label: error instanceof Error ? error.message : "Unexpected error" }
    ], true);
  } finally {
    runButton.disabled = false;
    runButton.querySelector("span").textContent = "RUN PREFLIGHT";
  }
});

document.querySelector("#download-report").addEventListener("click", () => {
  if (!latestReport) return;
  const blob = new Blob([JSON.stringify(latestReport, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${latestReport.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#symbol").addEventListener("change", checkMarket);
checkMarket();
