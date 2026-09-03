# 90-second demo script

## 0:00–0:12 — MCP proof

Show the successful Binance MCP connection and the completed read-only `spot.depth` and `spot.ticker24hr` calls. Do not show account data.

“Trade Preflight uses Binance Agent OS for current market context, then applies a deterministic safety policy locally.”

## 0:12–0:24 — Problem

“AI agents can generate orders, but a valid order is not necessarily a safe order. Trade Preflight adds a deterministic control layer before Binance execution.”

Show the headline and the four-stage Intent → Market → Risk → Human Gate route.

## 0:24–0:45 — Safe intent

Use the defaults: BTC/USDT, BUY, 250 USDT, 10,000 USDT portfolio, 10% allocation, 1,000 USDT order cap, 10 bps slippage.

Click **RUN PREFLIGHT**.

“The agent reads Binance’s live order book and ticker, simulates the market order, and runs five controls.”

Show PASS, market metrics, and the control matrix.

## 0:45–1:03 — Unsafe intent

Change order size to 2,500 USDT and run again.

“This order exceeds both the account’s order cap and portfolio allocation policy.”

Show BLOCK and the agent trace.

## 1:03–1:20 — Safety boundary

“The model can propose. It cannot bypass deterministic controls. Even a passing order is held behind explicit human confirmation, and this public demo never invokes execution.”

Show the locked execution button and safety stamp.

## 1:20–1:30 — Close

“Trade Preflight turns agentic trading from blind execution into permission-scoped, explainable action — built for Binance Agent OS.”
