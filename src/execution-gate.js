import { createHash } from "node:crypto";

const REQUIRED_CONFIRMATION = "CONFIRM";

function filterByType(symbolInfo, type) {
  return symbolInfo.filters?.find((filter) => filter.filterType === type);
}

function decimals(value) {
  const [, fraction = ""] = String(value).split(".");
  return fraction.replace(/0+$/, "").length;
}

function floorToStep(value, step) {
  const numericStep = Number(step);
  if (!numericStep) return value;
  const precision = decimals(step);
  return Number((Math.floor((value + Number.EPSILON) / numericStep) * numericStep).toFixed(precision));
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function validateSymbolRules(report, symbolInfo) {
  if (!symbolInfo || symbolInfo.symbol !== report.symbol) {
    throw new Error("Binance symbol rules do not match the proposed order");
  }
  if (symbolInfo.status !== "TRADING" || !symbolInfo.isSpotTradingAllowed) {
    throw new Error(`${report.symbol} is not available for spot trading`);
  }
  if (!symbolInfo.orderTypes?.includes("MARKET")) {
    throw new Error(`${report.symbol} does not support market orders`);
  }
}

function buildOrderArguments(report, symbolInfo) {
  const notionalFilter = filterByType(symbolInfo, "NOTIONAL");
  const minNotional = Number(notionalFilter?.minNotional || 0);
  const maxNotional = Number(notionalFilter?.maxNotional || Number.POSITIVE_INFINITY);
  const requestedNotional = report.proposedOrder.quoteOrderQty;

  if (requestedNotional < minNotional || requestedNotional > maxNotional) {
    throw new Error(`Order notional is outside Binance limits: ${minNotional}–${maxNotional}`);
  }

  const common = {
    symbol: report.symbol,
    side: report.side,
    type: "MARKET",
    newOrderRespType: "FULL",
    selfTradePreventionMode: symbolInfo.defaultSelfTradePreventionMode
  };

  if (report.side === "BUY") {
    if (!symbolInfo.quoteOrderQtyMarketAllowed) {
      throw new Error(`${report.symbol} does not allow quoteOrderQty market buys`);
    }
    return { ...common, quoteOrderQty: requestedNotional };
  }

  const lotFilter = filterByType(symbolInfo, "LOT_SIZE");
  const quantity = floorToStep(report.proposedOrder.estimatedBaseQuantity, lotFilter?.stepSize || 0);
  if (quantity <= 0 || quantity < Number(lotFilter?.minQty || 0)) {
    throw new Error("Sell quantity is below the Binance minimum quantity");
  }
  if (quantity * report.market.midPrice < minNotional) {
    throw new Error("Rounded sell quantity is below the Binance minimum notional");
  }
  return { ...common, quantity: quantity.toFixed(decimals(lotFilter?.stepSize || 0)) };
}

export function buildExecutionTicket(report, symbolInfo, options = {}) {
  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? 60_000;
  const maxSnapshotAgeMs = options.maxSnapshotAgeMs ?? 60_000;
  const snapshotTime = Date.parse(report.market.fetchedAt || "");

  if (!report.proposedOrder?.executable || report.decision !== "PASS") {
    throw new Error("Only PASS reports can produce execution tickets");
  }
  if (report.market.source !== "BINANCE_MCP") {
    throw new Error("Production execution requires Binance MCP market data");
  }
  if (!Number.isFinite(snapshotTime) || now - snapshotTime > maxSnapshotAgeMs || snapshotTime > now + 5_000) {
    throw new Error("Binance MCP market snapshot is stale or invalid");
  }

  validateSymbolRules(report, symbolInfo);
  const arguments_ = buildOrderArguments(report, symbolInfo);
  const digest = sha256({ reportId: report.id, fetchedAt: report.market.fetchedAt, arguments: arguments_ });

  return {
    id: `xt_${digest.slice(0, 24)}`,
    mode: "PRODUCTION",
    status: "AWAITING_CONFIRMATION",
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
    intentDigest: digest,
    requiredConfirmation: REQUIRED_CONFIRMATION,
    refreshMarketBeforeExecution: true,
    mcpCall: {
      toolName: "spot.newOrder",
      arguments: {
        ...arguments_,
        newClientOrderId: `tp_${digest.slice(0, 20)}`
      }
    }
  };
}

export function authorizeExecution(ticket, confirmation, options = {}) {
  const now = options.now ?? Date.now();
  const consumedTicketIds = options.consumedTicketIds ?? new Set();

  if (confirmation !== REQUIRED_CONFIRMATION) {
    throw new Error(`Production execution requires exactly ${REQUIRED_CONFIRMATION}`);
  }
  if (ticket.status !== "AWAITING_CONFIRMATION" || consumedTicketIds.has(ticket.id)) {
    throw new Error("Execution ticket has already been consumed");
  }
  if (now > Date.parse(ticket.expiresAt)) {
    throw new Error("Execution ticket has expired");
  }

  consumedTicketIds.add(ticket.id);
  return {
    ...ticket,
    status: "AUTHORIZED",
    authorizedAt: new Date(now).toISOString()
  };
}
