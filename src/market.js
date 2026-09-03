const SUPPORTED_SYMBOLS = new Set(["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"]);
const BINANCE_API = "https://api.binance.com";

const FIXTURES = {
  BTCUSDT: 111420,
  ETHUSDT: 4420,
  BNBUSDT: 842,
  SOLUSDT: 214
};

function fixtureMarket(symbol) {
  const mid = FIXTURES[symbol];
  const step = mid * 0.00008;
  const asks = Array.from({ length: 20 }, (_, index) => [
    (mid + step * (index + 1)).toFixed(8),
    (0.35 + index * 0.11).toFixed(8)
  ]);
  const bids = Array.from({ length: 20 }, (_, index) => [
    (mid - step * (index + 1)).toFixed(8),
    (0.4 + index * 0.12).toFixed(8)
  ]);

  return {
    symbol,
    asks,
    bids,
    lastPrice: String(mid),
    priceChangePercent: "2.84",
    quoteVolume: "1884500000",
    source: "DEMO_FIXTURE",
    fetchedAt: new Date().toISOString()
  };
}

async function fetchJson(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "trade-preflight-agent/1.0" }
    });
    if (!response.ok) throw new Error(`Binance API returned ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export function validateSymbol(symbol) {
  const normalised = String(symbol || "").toUpperCase();
  if (!SUPPORTED_SYMBOLS.has(normalised)) {
    throw new Error(`Unsupported symbol: ${normalised}`);
  }
  return normalised;
}

export async function getMarketSnapshot(requestedSymbol) {
  const symbol = validateSymbol(requestedSymbol);
  try {
    const [book, ticker] = await Promise.all([
      fetchJson(`${BINANCE_API}/api/v3/depth?symbol=${symbol}&limit=100`),
      fetchJson(`${BINANCE_API}/api/v3/ticker/24hr?symbol=${symbol}`)
    ]);

    return {
      symbol,
      asks: book.asks,
      bids: book.bids,
      lastPrice: ticker.lastPrice,
      priceChangePercent: ticker.priceChangePercent,
      quoteVolume: ticker.quoteVolume,
      source: "BINANCE_PUBLIC_API",
      fetchedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      ...fixtureMarket(symbol),
      fallbackReason: error instanceof Error ? error.message : "Live market unavailable"
    };
  }
}
