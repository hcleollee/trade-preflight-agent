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
│ mandatory gate     │      │ intentionally locked│
└────────────────────┘      └─────────────────────┘
```

## Boundary decisions

The probabilistic agent may interpret user intent and gather context, but it does not own the final control decision. Risk checks are deterministic, testable, and auditable. This separation prevents a model from talking itself around a hard account limit.

The current demo consumes public data and ends at the human gate. An authenticated Binance MCP execution adapter is deliberately excluded from the public demo build. The returned order contract makes the future boundary explicit without exposing credentials or moving funds during judging.

## Decision states

- **PASS:** every configured control passes.
- **WARN:** no hard rule is breached, but liquidity or volatility deserves review.
- **BLOCK:** at least one hard rule fails. The proposal is not executable.

## Failure handling

Live market requests have a five-second timeout. If Binance data is unavailable, a clearly labelled deterministic fixture keeps the interface demonstrable. Production execution must reject fixture data; it exists only for judging and local development.
