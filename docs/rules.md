# Rule reference

Every finding carries a stable `rule` id. Silence one by adding its id to the
`ignore` array in your config file.

---

## `duplicate-discriminant`

**Severity:** error

Two variants of the same enum are assigned the same number.

```rust
#[contracterror]
#[repr(u32)]
pub enum RouterError {
    PairNotFound = 300,
    IdenticalAddresses = 300, // duplicate-discriminant
}
```

`rustc` also rejects this, as `E0081`. The reason to catch it here as well is
timing: in a workspace where another module already fails to compile, the
duplicate is buried in a wall of unrelated errors, and it can survive review for
a long time. This check runs in seconds and does not need the crate to build.

**Fix:** give each variant its own number. Do not renumber an existing variant
that is already deployed; add the new one at the end of the block instead.

---

## `code-collision`

**Severity:** error

Two different error enums define the same number.

```rust
// router.rs
pub enum RouterError { PairNotFound = 300 }

// factory.rs
pub enum FactoryError { NotInitialized = 300 } // code-collision
```

Contract errors cross the contract boundary as bare `u32` values. A client that
receives `300` from a call that touched both contracts cannot tell which one
rejected it, and any error-mapping table in an SDK will be wrong for one of
them.

**Fix:** give each contract its own block of numbers and record the allocation
in your config `ranges` so the tool enforces it from then on.

---

## `range-violation`

**Severity:** error

A variant falls outside the range its enum declared in the config file.

```json
{ "ranges": { "RouterError": [200, 299] } }
```

```rust
pub enum RouterError {
    DeadlineExpired = 201,
    PairNotFound = 300, // range-violation
}
```

This is the rule that keeps an agreed allocation from drifting. It only fires
for enums that appear in `ranges`, so adopting it is opt-in and can be done one
contract at a time.

**Fix:** move the variant into its block, or widen the declared range if the
block genuinely needs to grow.

---

## `range-overlap`

**Severity:** warning

Two enums occupy overlapping spans of numbers but do not share one yet.

```rust
pub enum RouterError  { A = 200, B = 310 }
pub enum FactoryError { C = 300, D = 305 } // overlaps 300-310
```

Nothing is broken today. The point is that the next variant added to either
enum is likely to land on a number the other one already uses, which turns this
warning into a `code-collision`.

It is a warning rather than an error because some projects deliberately share a
numbering space, for example when several enums are folded into one public error
type.

**Fix:** separate the blocks, or ignore the rule if the sharing is deliberate.

---

## `implicit-discriminant`

**Severity:** warning

A variant has no `= N`.

```rust
pub enum RouterError {
    NotInitialized = 200,
    Unauthorized, // implicit-discriminant
}
```

Rust assigns the value from the variant's position. Insert a variant above it,
or reorder the enum during a refactor, and the number changes. The contract
still compiles, the tests still pass, and every deployed client is now reading
the wrong error.

**Fix:** write the number down. For a public error type there is no good reason
to leave it implicit.
