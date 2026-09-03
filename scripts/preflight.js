import { analyzeTrade } from "../src/risk-engine.js";
import { buildExecutionTicket } from "../src/execution-gate.js";
import { getMarketSnapshot } from "../src/market.js";
import { readFile } from "node:fs/promises";

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
const mode = args.mode || "demo";
if (!new Set(["demo", "production"]).has(mode)) {
  throw new Error("mode must be demo or production");
}
if (mode === "production" && !args["rules-file"]) {
  throw new Error("Production mode requires --rules-file from Binance MCP exchangeInfo");
}
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
  const market = args["market-file"]
    ? JSON.parse(await readFile(args["market-file"], "utf8"))
    : await getMarketSnapshot(input.symbol);

  if (market.symbol && market.symbol !== input.symbol) {
    throw new Error(`Market snapshot symbol ${market.symbol} does not match ${input.symbol}`);
  }

  const report = analyzeTrade(input, market);
  const output = mode === "production" && report.decision === "PASS"
      ? {
        ...report,
        executionTicket: buildExecutionTicket(
          report,
          JSON.parse(await readFile(args["rules-file"], "utf8")),
          args["ticket-ttl-ms"]
            ? { ttlMs: Number(args["ticket-ttl-ms"]) }
            : undefined
        )
      }
    : report;

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = report.decision === "BLOCK" ? 2 : 0;
} catch (error) {
  const message = error instanceof Error ? error.message : "Preflight failed";
  process.stderr.write(`${JSON.stringify({ error: message })}\n`);
  process.exitCode = 1;
}
