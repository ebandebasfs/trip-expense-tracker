# F<N> — <Feature name>

_Status: Draft · Last updated: <YYYY-MM-DD> · Spec: [F<N>-<slug>.md](../specs/features/F<N>-<slug>.md)_

## Summary
What gets built and in what order, in 2–4 sentences. Name any shared work reused from another feature's plan.

## Tasks

### F<N>.T1 <short title>
- **Files:** `<path>` (new), `<path>` (changed)
- **Does:** what this task builds, in a few short lines.
- **Covers:** F<N>.R1, F<N>.AC1
- **Done when:** `npm test -w app/api -- -t "\bF<N>\.AC1\b"` passes.

### F<N>.T2 <short title>
- **Files:** `<path>` (new)
- **Does:** …
- **Covers:** …
- **Done when:** …

## AC coverage

| AC ID | Test file | Test name or "code review" | Reason (code review only) |
|---|---|---|---|
| F<N>.AC1 | `<test file path>` | F<N>.AC1 <test name> | |
| F<N>.AC2 | `<file>` | code review | <one-line reason: ownership check, database constraint, or cascading delete> |

## Out of scope
- Anything the spec puts out of scope, and anything this plan leaves for later. Write "None" if there is none.

## Decisions log
- <YYYY-MM-DD>: <technical choice> → <reason, or the decision that was made>
