const SUPPORTED_SYMBOL = /^[A-Z0-9]{5,20}$/;

function finiteNumber(value, name, minimum = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= minimum) {
    throw new Error(`${name} must be greater than ${minimum}`);
  }
  return number;
}

function normaliseLevels(levels, side) {
  if (!Array.isArray(levels) || levels.length === 0) {
    throw new Error(`${side} order book is unavailable`);
  }

  return levels.map(([price, quantity]) => {
    const parsedPrice = finiteNumber(price, `${side} price`);
    const parsedQuantity = finiteNumber(quantity, `${side} quantity`);
    return { price: parsedPrice, quantity: parsedQuantity };
  });
}

export function simulateMarketOrder(levels, quoteAmount) {
  let remaining = quoteAmount;
  let baseQuantity = 0;
  let quoteFilled = 0;
  let worstPrice = levels[0].price;
  let levelsConsumed = 0;

  for (const level of levels) {
    if (remaining <= 0.00000001) break;
    const levelNotional = level.price * level.quantity;
    const usedNotional = Math.min(levelNotional, remaining);
    baseQuantity += usedNotional / level.price;
    quoteFilled += usedNotional;
    remaining -= usedNotional;
    worstPrice = level.price;
    levelsConsumed += 1;
  }

  const filled = remaining <= 0.01;
  const averagePrice = baseQuantity > 0 ? quoteFilled / baseQuantity : 0;
  const bestPrice = levels[0].price;
  const slippageBps = bestPrice > 0
    ? Math.abs(averagePrice - bestPrice) / bestPrice * 10_000
    : 0;

  return {
    filled,
    quoteFilled,
    baseQuantity,
    averagePrice,
    worstPrice,
    slippageBps,
    levelsConsumed,
    unfilledQuote: Math.max(0, remaining)
  };
}

function depthWithinBps(levels, bestPrice, bps, side) {
  const boundary = side === "BUY"
    ? bestPrice * (1 + bps / 10_000)
    : bestPrice * (1 - bps / 10_000);

  return levels.reduce((total, level) => {
    const isInside = side === "BUY" ? level.price <= boundary : level.price >= boundary;
    return isInside ? total + level.price * level.quantity : total;
  }, 0);
}

function clamp(number, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, number));
}

export function analyzeTrade(input, market) {
  const symbol = String(input.symbol || "").toUpperCase();
  if (!SUPPORTED_SYMBOL.test(symbol)) throw new Error("symbol is invalid");

  const side = String(input.side || "").toUpperCase();
  if (!new Set(["BUY", "SELL"]).has(side)) throw new Error("side must be BUY or SELL");

  const quoteAmount = finiteNumber(input.quoteAmount, "quoteAmount");
  const portfolioValue = finiteNumber(input.portfolioValue, "portfolioValue");
  const maxAllocationPct = finiteNumber(input.maxAllocationPct, "maxAllocationPct");
  const maxSlippageBps = finiteNumber(input.maxSlippageBps, "maxSlippageBps");
  const maxOrderUsdt = finiteNumber(input.maxOrderUsdt, "maxOrderUsdt");

  const asks = normaliseLevels(market.asks, "ask");
  const bids = normaliseLevels(market.bids, "bid");
  const executionLevels = side === "BUY" ? asks : bids;
  const bestAsk = asks[0].price;
  const bestBid = bids[0].price;
  const midPrice = (bestAsk + bestBid) / 2;
  const spreadBps = (bestAsk - bestBid) / midPrice * 10_000;
  const change24hPct = Number(market.priceChangePercent || 0);
  const simulation = simulateMarketOrder(executionLevels, quoteAmount);
  const depth50Bps = depthWithinBps(executionLevels, executionLevels[0].price, 50, side);
  const allocationPct = quoteAmount / portfolioValue * 100;
  const depthUsagePct = depth50Bps > 0 ? quoteAmount / depth50Bps * 100 : 100;

  const checks = [];
  const addCheck = (id, label, status, detail) => checks.push({ id, label, status, detail });

  addCheck(
    "order-cap",
    "Order cap",
    quoteAmount <= maxOrderUsdt ? "PASS" : "BLOCK",
    `${quoteAmount.toFixed(2)} / ${maxOrderUsdt.toFixed(2)} USDT`
  );
  addCheck(
    "allocation",
    "Portfolio allocation",
    allocationPct <= maxAllocationPct ? "PASS" : "BLOCK",
    `${allocationPct.toFixed(2)}% / ${maxAllocationPct.toFixed(2)}%`
  );
  addCheck(
    "liquidity",
    "Order-book liquidity",
    simulation.filled ? (depthUsagePct <= 20 ? "PASS" : "WARN") : "BLOCK",
    `${depthUsagePct.toFixed(2)}% of 50 bps depth`
  );
  addCheck(
    "slippage",
    "Estimated slippage",
    simulation.slippageBps <= maxSlippageBps ? "PASS" : "BLOCK",
    `${simulation.slippageBps.toFixed(2)} / ${maxSlippageBps.toFixed(2)} bps`
  );
  addCheck(
    "volatility",
    "24h volatility proxy",
    Math.abs(change24hPct) < 8 ? "PASS" : Math.abs(change24hPct) < 15 ? "WARN" : "BLOCK",
    `${change24hPct.toFixed(2)}% price change`
  );

  const blocked = checks.some((check) => check.status === "BLOCK");
  const warned = checks.some((check) => check.status === "WARN");
  const decision = blocked ? "BLOCK" : warned ? "WARN" : "PASS";

  const liquidityRisk = clamp(simulation.slippageBps / maxSlippageBps * 30, 0, 35);
  const spreadRisk = clamp(spreadBps / 10 * 15, 0, 15);
  const allocationRisk = clamp(allocationPct / maxAllocationPct * 25, 0, 30);
  const volatilityRisk = clamp(Math.abs(change24hPct) / 15 * 20, 0, 20);
  const rawRiskScore = Math.round(clamp(liquidityRisk + spreadRisk + allocationRisk + volatilityRisk, 0, 100));
  const riskScore = blocked ? Math.max(75, rawRiskScore) : warned ? Math.max(45, rawRiskScore) : rawRiskScore;

  const reasons = checks
    .filter((check) => check.status !== "PASS")
    .map((check) => `${check.label}: ${check.detail}`);

  if (reasons.length === 0) {
    reasons.push("All configured pre-trade controls passed.");
  }

  return {
    id: `pf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    generatedAt: new Date().toISOString(),
    decision,
    riskScore,
    symbol,
    side,
    checks,
    reasons,
    market: {
      bestBid,
      bestAsk,
      midPrice,
      spreadBps,
      change24hPct,
      depth50Bps,
      source: market.source || "BINANCE_PUBLIC_API"
    },
    simulation,
    proposedOrder: {
      symbol,
      side,
      type: "MARKET",
      quoteOrderQty: quoteAmount,
      estimatedBaseQuantity: simulation.baseQuantity,
      requiresHumanConfirmation: true,
      executable: decision !== "BLOCK"
    }
  };
}
