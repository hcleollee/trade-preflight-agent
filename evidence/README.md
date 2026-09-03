# Binance MCP evidence

Captured at `2026-09-03T04:50:20Z` using the authenticated Binance Agent OS MCP server.

Read-only tools invoked:

- `spot.depth` — `BTCUSDT`, 20 levels, `TRADING` status
- `spot.ticker24hr` — `BTCUSDT`, full 24-hour ticker, `TRADING` status

No account, balance, order, transfer, or withdrawal tool was called. The public market response is stored in `binance-mcp-btcusdt.json`.

## Verified scenarios

| Scenario | Decision | Risk score | Failed controls | Executable |
| --- | --- | ---: | --- | --- |
| BUY 250 USDT | PASS | 6 | None | Proposal only; human confirmation required |
| BUY 2,500 USDT | BLOCK | 75 | 1,000 USDT order cap; 10% allocation limit | No |

Both reports were produced by the local deterministic engine with the same MCP snapshot. No trade was submitted.

Final local acceptance: 11/11 tests passing, the 250 USDT case returns PASS, and the 2,500 USDT case returns BLOCK against this same snapshot.

## Live rerun

At `2026-09-03T04:56:25Z`, the complete read-only flow was rerun with a fresh `BTCUSDT` MCP snapshot saved as `live-run-2026-09-03T045625Z.json`:

- 250 USDT proposal: `PASS`, risk score `7`, human confirmation still required.
- 2,500 USDT proposal: `BLOCK`, risk score `75`, order-cap and allocation controls failed, `executable: false`.
- This public-evidence run invoked no production order.

At `2026-09-03T05:34:09Z`, production mode generated a `spot.newOrder` execution ticket for a 10 USDT BTCUSDT market-buy proposal using fresh MCP depth, ticker, and exchange rules. The ticket was not submitted because no transaction-specific `CONFIRM` had been provided.

The production BUY and SELL paths were later validated privately with small spot orders, including final order-status checks. No authenticated response, account data, balance, or order identifier is stored in this public evidence directory.

`EXECUTION LOCKED — HUMAN CONFIRMATION REQUIRED`
