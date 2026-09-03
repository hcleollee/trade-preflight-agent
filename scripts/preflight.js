import { analyzeTrade } from "../src/risk-engine.js";
import { getMarketSnapshot } from "../src/market.js";

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error("Arguments must use --name value pairs");
    }
    values[key.slice(2)] = value;
  }
  return values;
}

const args = parseArguments(process.argv.slice(2));
const input = {
  symbol: args.symbol || "BTCUSDT",
  side: args.side || "BUY",
  quoteAmount: Number(args.amount || 250),
  portfolioValue: Number(args.portfolio || 10_000),
  maxAllocationPct: Number(args["max-allocation"] || 10),
  maxSlippageBps: Number(args["max-slippage"] || 10),
  maxOrderUsdt: Number(args["order-cap"] || 1_000)
};

try {
  const market = await getMarketSnapshot(input.symbol);
  const report = analyzeTrade(input, market);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.decision === "BLOCK" ? 2 : 0;
} catch (error) {
  const message = error instanceof Error ? error.message : "Preflight failed";
  process.stderr.write(`${JSON.stringify({ error: message })}\n`);
  process.exitCode = 1;
}
