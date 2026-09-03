# Trade Preflight Agent

**Binance Agent OS Mini Hackathon — Track A**

Trade Preflight is a human-gated AI agent workflow that evaluates a proposed spot order before it can reach an execution tool. It reads Binance market data, simulates the order against the live order book, applies permission and risk controls, and produces an auditable order proposal.

The demo never moves funds. Execution remains locked behind explicit human confirmation.

## Why it exists

Giving an AI agent permission to trade creates a new failure mode: a syntactically valid order can still be unsafe because of poor liquidity, excess allocation, volatile conditions, or a simple sizing mistake. Trade Preflight inserts a deterministic control layer between agent reasoning and order execution.

## What it checks

- Hard per-order notional cap
- Maximum portfolio allocation
- Available order-book depth within 50 bps
- Estimated market-order slippage
- 24-hour price-change volatility proxy
- Mandatory human confirmation before execution

## Run locally

Requirements: Node.js 18 or newer. No package installation is required.

```bash
npm start
```

Open `http://127.0.0.1:4173`.

Run the test suite:

```bash
npm test
```

## Demo flow

1. Select a Binance spot symbol.
2. Set BUY or SELL and enter the intended USDT notional.
3. Configure the portfolio and permission limits.
4. Run preflight.
5. Review the PASS, WARN, or BLOCK decision and the full control matrix.
6. Download the JSON audit report.

For a blocking example, use an order size of `2500 USDT` while leaving the default `1000 USDT` order cap and `10%` allocation limit.

## Binance Agent OS integration

The demo uses Binance public Spot REST endpoints for a zero-credential, reproducible judging experience:

- `GET /api/v3/depth`
- `GET /api/v3/ticker/24hr`

The workflow is designed to sit directly in front of Binance Agent OS execution tools. Connect the official Binance MCP server in an MCP-compatible agent environment:

```toml
[mcp_servers.binance]
url = "https://agent.binance.com/mcp/agentic"
```

After browser authentication, grant only the minimum read permissions first. Keep order execution approval enabled. The `proposedOrder` object returned by this project is the handoff contract: only proposals with `executable: true` may be presented to the human for confirmation. A BLOCK result must never be forwarded to an execution tool.

The hackathon demo intentionally stops before MCP order submission. This keeps the public project safe to run and makes the human gate visible to judges.

`AGENTS.md` turns Codex into the orchestration layer: it calls Binance MCP for read-only market context, invokes the local preflight CLI, and reports the deterministic decision. See `docs/AGENT_OS_RUNBOOK.md` for the evidence and recording workflow.

Run the agent-facing CLI directly:

```bash
npm run preflight -- --symbol BTCUSDT --side BUY --amount 250 --portfolio 10000 --max-allocation 10 --max-slippage 10 --order-cap 1000
```

## API

### `GET /api/market?symbol=BTCUSDT`

Returns the current order book and 24-hour ticker. If Binance is temporarily unreachable, the response is explicitly labelled `DEMO_FIXTURE`.

### `POST /api/analyze`

```json
{
  "symbol": "BTCUSDT",
  "side": "BUY",
  "quoteAmount": 250,
  "portfolioValue": 10000,
  "maxAllocationPct": 10,
  "maxSlippageBps": 10,
  "maxOrderUsdt": 1000
}
```

The response contains the decision, score, checks, execution simulation, and a non-executing order proposal.

## Safety model

- No API keys or secrets are stored.
- No authenticated endpoint is called by the demo.
- No withdrawal or transfer capability exists.
- Every proposed order requires human confirmation.
- Hard-limit violations return BLOCK and set `executable: false`.
- The fallback dataset is visibly labelled and cannot be confused with live data.

## Project structure

```text
public/                 Browser UI
src/market.js           Binance market-data adapter
src/risk-engine.js      Deterministic controls and order simulation
src/server.js           Local HTTP server and API
test/                   Node test suite
docs/                   Architecture, demo, and submission material
```

## Disclaimer

This project is a hackathon prototype, not financial advice. It does not guarantee trade quality or prevent loss. Digital assets are volatile; users remain responsible for every decision and permission they grant.
