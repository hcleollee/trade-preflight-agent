import test from "node:test";
import assert from "node:assert/strict";
import { authorizeExecution, buildExecutionTicket } from "../src/execution-gate.js";

const now = Date.parse("2026-09-03T05:30:00Z");
const report = {
  id: "pf_test",
  decision: "PASS",
  symbol: "BTCUSDT",
  side: "BUY",
  market: {
    source: "BINANCE_MCP",
    fetchedAt: "2026-09-03T05:29:50Z",
    midPrice: 77_000
  },
  proposedOrder: {
    quoteOrderQty: 10,
    estimatedBaseQuantity: 0.00012987,
    executable: true
  }
};

const rules = {
  symbol: "BTCUSDT",
  status: "TRADING",
  isSpotTradingAllowed: true,
  quoteOrderQtyMarketAllowed: true,
  orderTypes: ["MARKET"],
  defaultSelfTradePreventionMode: "EXPIRE_MAKER",
  filters: [
    { filterType: "LOT_SIZE", minQty: "0.00001000", stepSize: "0.00001000" },
    { filterType: "NOTIONAL", minNotional: "5.00000000", maxNotional: "9000000.00000000" }
  ]
};

test("builds a production MCP order ticket for a passing report", () => {
  const ticket = buildExecutionTicket(report, rules, { now });
  assert.equal(ticket.status, "AWAITING_CONFIRMATION");
  assert.equal(ticket.mcpCall.toolName, "spot.newOrder");
  assert.equal(ticket.mcpCall.arguments.quoteOrderQty, 10);
  assert.equal(ticket.requiredConfirmation, "CONFIRM");
});

test("blocks execution tickets for blocked reports or non-MCP data", () => {
  assert.throws(
    () => buildExecutionTicket({ ...report, decision: "BLOCK", proposedOrder: { ...report.proposedOrder, executable: false } }, rules, { now }),
    /Only PASS reports/
  );
  assert.throws(
    () => buildExecutionTicket({ ...report, decision: "WARN" }, rules, { now }),
    /Only PASS reports/
  );
  assert.throws(
    () => buildExecutionTicket({ ...report, market: { ...report.market, source: "BINANCE_PUBLIC_API" } }, rules, { now }),
    /requires Binance MCP/
  );
});

test("requires exact confirmation and consumes a ticket once", () => {
  const ticket = buildExecutionTicket(report, rules, { now });
  const consumedTicketIds = new Set();
  assert.throws(() => authorizeExecution(ticket, "confirm", { now, consumedTicketIds }), /exactly CONFIRM/);
  const authorized = authorizeExecution(ticket, "CONFIRM", { now, consumedTicketIds });
  assert.equal(authorized.status, "AUTHORIZED");
  assert.throws(() => authorizeExecution(ticket, "CONFIRM", { now, consumedTicketIds }), /already been consumed/);
});

test("rejects stale market data and expired tickets", () => {
  assert.throws(
    () => buildExecutionTicket(report, rules, { now: now + 120_000, maxSnapshotAgeMs: 60_000 }),
    /snapshot is stale/
  );
  const ticket = buildExecutionTicket(report, rules, { now, ttlMs: 1_000 });
  assert.throws(() => authorizeExecution(ticket, "CONFIRM", { now: now + 1_001 }), /expired/);
});

test("normalizes sell quantity to the Binance lot-size step", () => {
  const ticket = buildExecutionTicket({ ...report, side: "SELL" }, rules, { now });
  assert.equal(ticket.mcpCall.arguments.quantity, "0.00012");
  assert.equal("quoteOrderQty" in ticket.mcpCall.arguments, false);
});
