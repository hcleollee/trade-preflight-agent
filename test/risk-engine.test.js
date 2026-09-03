import test from "node:test";
import assert from "node:assert/strict";
import { analyzeTrade, simulateMarketOrder } from "../src/risk-engine.js";

const market = {
  asks: [["100.00", "5"], ["100.10", "10"]],
  bids: [["99.90", "5"], ["99.80", "10"]],
  priceChangePercent: "2.5",
  source: "TEST",
  fetchedAt: "2026-09-03T00:00:00Z",
  providerTools: ["spot.depth", "spot.ticker24hr"]
};

const safeInput = {
  symbol: "BTCUSDT",
  side: "BUY",
  quoteAmount: 100,
  portfolioValue: 10_000,
  maxAllocationPct: 10,
  maxSlippageBps: 20,
  maxOrderUsdt: 500
};

test("simulates a market order across multiple levels", () => {
  const result = simulateMarketOrder([
    { price: 100, quantity: 1 },
    { price: 101, quantity: 2 }
  ], 201);

  assert.equal(result.filled, true);
  assert.equal(result.levelsConsumed, 2);
  assert.ok(result.averagePrice > 100);
  assert.ok(result.slippageBps > 0);
});

test("passes a small liquid order", () => {
  const result = analyzeTrade(safeInput, market);
  assert.equal(result.decision, "PASS");
  assert.equal(result.proposedOrder.requiresHumanConfirmation, true);
  assert.equal(result.proposedOrder.executable, true);
  assert.equal(result.market.fetchedAt, market.fetchedAt);
  assert.deepEqual(result.market.providerTools, market.providerTools);
});

test("blocks an order above the configured cap", () => {
  const result = analyzeTrade({ ...safeInput, quoteAmount: 600 }, market);
  assert.equal(result.decision, "BLOCK");
  assert.ok(result.riskScore >= 75);
  assert.equal(result.proposedOrder.executable, false);
  assert.equal(result.checks.find((check) => check.id === "order-cap").status, "BLOCK");
});

test("blocks an order above the portfolio allocation limit", () => {
  const result = analyzeTrade({ ...safeInput, quoteAmount: 300, portfolioValue: 1_000 }, market);
  assert.equal(result.decision, "BLOCK");
  assert.equal(result.checks.find((check) => check.id === "allocation").status, "BLOCK");
});

test("blocks when the order book cannot fill the request", () => {
  const thinMarket = {
    ...market,
    asks: [["100", "0.1"]],
    bids: [["99.9", "0.1"]]
  };
  const result = analyzeTrade({ ...safeInput, quoteAmount: 100 }, thinMarket);
  assert.equal(result.decision, "BLOCK");
  assert.equal(result.simulation.filled, false);
});

test("rejects malformed input", () => {
  assert.throws(
    () => analyzeTrade({ ...safeInput, side: "HOLD" }, market),
    /BUY or SELL/
  );
});
