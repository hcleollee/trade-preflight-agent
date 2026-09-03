# Architecture

```text
┌────────────────────┐
│ User / AI intent   │
│ symbol, side, size │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐      ┌─────────────────────┐
│ Market adapter     │─────▶│ Binance market data │
│ timeout + fallback │      │ depth + 24h ticker  │
└─────────┬──────────┘      └─────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────┐
│ Deterministic preflight engine               │
│                                              │
│ order cap · allocation · liquidity           │
│ slippage · volatility · fill simulation      │
└─────────┬────────────────────────────────────┘
          │
          ▼
┌────────────────────┐
│ PASS / WARN / BLOCK│
│ audit report       │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐      ┌─────────────────────┐
│ Human confirmation │ - - ▶│ Binance MCP execute │
│ mandatory gate     │      │ production only     │
└────────────────────┘      └─────────────────────┘
```

## Boundary decisions

The probabilistic agent may interpret user intent and gather context, but it does not own the final control decision. Risk checks are deterministic, testable, and auditable. This separation prevents a model from talking itself around a hard account limit.

The public demo consumes public data and ends at the human gate; it never invokes an authenticated endpoint. A separate production adapter is implemented for explicitly requested spot orders. It accepts only a fresh PASS report and current exchange rules, generates a short-lived ticket, requires an exact transaction-specific `CONFIRM`, refreshes the market and checks again, then permits one MCP order call followed by a status query.

Production validation is private. Account data, balances, order identifiers, and authenticated responses do not belong in the repository or judging video.

## Decision states

- **PASS:** every configured control passes.
- **WARN:** no hard rule is breached, but liquidity or volatility deserves review.
- **BLOCK:** at least one hard rule fails. The proposal is not executable.

## Failure handling

Live market requests have a five-second timeout. If Binance data is unavailable, a clearly labelled deterministic fixture keeps the interface demonstrable. Production execution must reject fixture data; it exists only for judging and local development.
