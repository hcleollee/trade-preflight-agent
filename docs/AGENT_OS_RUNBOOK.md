# Binance Agent OS runbook

This runbook produces clear evidence that Trade Preflight is an Agent OS workflow rather than a standalone dashboard.

## 1. Connect the official MCP server

The local Codex configuration should contain:

```toml
[mcp_servers.binance]
url = "https://agent.binance.com/mcp/agentic"
```

Authenticate through Binance OAuth. Grant read-only market access first. Do not grant trading or transfer permissions for the hackathon demo.

## 2. Verify the connection

Start a fresh Codex session after authentication so the newly configured MCP tools enter the session tool inventory. Ask Codex to list or use only the Binance market-data tools.

Capture one screenshot showing:

- the Binance MCP server is connected;
- a read-only Binance market-data tool completed;
- no trade or transfer tool was invoked.

Save the public response in the same schema as `evidence/binance-mcp-btcusdt.json`, set `source` to `BINANCE_MCP`, and record the exact read-only tool names and UTC capture time. Then pass it to the CLI with `--market-file`.

## 3. Run the safe scenario

Use the safe prompt in `AGENTS.md`. The expected result is normally PASS, although live volatility or liquidity may produce WARN. The execution state must remain locked.

## 4. Run the blocked scenario

Use the blocked prompt in `AGENTS.md`. It must return BLOCK because 2,500 USDT exceeds both the 1,000 USDT order cap and the 10% allocation policy for a 10,000 USDT portfolio.

## 5. Evidence checklist

- MCP connection visible
- MCP read tool name visible
- current symbol and timestamp visible
- PASS/WARN result visible
- BLOCK result visible
- `requiresHumanConfirmation: true` visible
- `executable: false` visible for BLOCK
- no private identifiers or balances visible
- no production transaction invoked by the public demo

Private production validation, if performed, must remain separate from the submission evidence. Do not record authenticated responses, balances, account identifiers, order identifiers, or transaction history.

## 6. Video order

Record the MCP proof first, then switch to the dashboard for the visual PASS and BLOCK comparison. Finish on the “PUBLIC DEMO — EXECUTION LOCKED” state.
