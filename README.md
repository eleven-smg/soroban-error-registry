# soroban-error-registry

Static analysis for Soroban `#[contracterror]` enums.

It reads your Rust sources, builds a single registry of every contract error
code in the workspace, and fails the build when two errors fight over the same
number.

Zero runtime dependencies. No Rust toolchain required, so it runs in a lint job
that finishes in seconds rather than in a `cargo build` that takes minutes.

## Why

Soroban contract errors are `u32` values that cross the contract boundary. The
caller does not receive a variant name, only a number. That makes error codes a
public API, and it makes three mistakes expensive:

1. **Duplicate discriminants inside one enum.** `rustc` catches this as `E0081`,
   but only once the crate actually compiles. In a workspace where an unrelated
   module is already broken, the duplicate hides behind the other errors.
2. **The same code in two different contracts.** Nothing catches this. A router
   and a factory can both define `300`, and a client that only sees the number
   has no way to tell which contract rejected the call.
3. **Implicit discriminants.** `Unauthorized,` with no `= N` takes its value
   from its position. Insert a variant above it and every deployed client is
   silently reading a different error.

This tool exists because all three showed up in real Stellar Wave contract
repositories within a single week.

## Install

```bash
git clone https://github.com/eleven-smg/soroban-error-registry.git
cd soroban-error-registry
node bin/soroban-error-registry.js --help
```

Node 20 or newer. There is nothing to install.

## Usage

```bash
# Scan a contracts workspace
node bin/soroban-error-registry.js ./contracts

# Generate a committed registry file
node bin/soroban-error-registry.js ./contracts --markdown --out docs/error-codes.md

# Machine readable output
node bin/soroban-error-registry.js ./contracts --json

# Fail on warnings too
node bin/soroban-error-registry.js ./contracts --strict
```

Exit codes: `0` clean, `1` findings failed the run, `2` the tool could not run.

### In CI

```yaml
- name: Check contract error codes
  run: node bin/soroban-error-registry.js contracts --strict
```

## Rules

| Rule | Severity | What it means |
| --- | --- | --- |
| `duplicate-discriminant` | error | Two variants of one enum share a code. This is `rustc` `E0081`. |
| `code-collision` | error | Two different error enums define the same code. |
| `range-violation` | error | A variant falls outside the range declared for its enum. |
| `range-overlap` | warning | Two enums occupy overlapping ranges but do not collide yet. |
| `implicit-discriminant` | warning | A variant has no `= N`, so its code depends on declaration order. |

## Configuration

Optional, passed with `--config`:

```json
{
  "ranges": {
    "PairError": [100, 199],
    "RouterError": [200, 299],
    "FactoryError": [300, 399]
  },
  "ignore": ["implicit-discriminant"]
}
```

`ranges` turns your intended code allocation into an enforced one. `ignore`
silences a rule by id.

## Examples

`examples/clean` holds a correctly numbered token contract and exits `0`.
`examples/broken` holds a router and a factory that collide on `300` and exits
`1`. Both are checked by CI on every push, so the tool is always tested against
the failure it claims to detect.

## What the parser understands

The parser is lexical, not a full Rust front end. It recognises:

- `#[contracterror]` followed by any number of other attributes and then an
  `enum` declaration.
- Unit variants with a decimal or hexadecimal discriminant, or none at all.
- Per-variant attributes such as `#[cfg(feature = "testutils")]`.
- Line comments, nested block comments, string literals, raw strings and char
  literals, all of which are excluded before matching.

It does not understand:

- Discriminants that are expressions or constants (`= BASE + 1`). These are
  skipped rather than guessed at.
- Tuple or struct variants, which `#[contracterror]` does not support anyway.
- Enums produced by macro expansion.

When the parser cannot read a variant it stays silent about it. A false negative
is acceptable here; a false accusation in CI is not.

## Development

```bash
npm test          # node --test test/
npm run check:clean
npm run check:broken
```

## License

MIT
