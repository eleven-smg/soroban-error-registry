# Security policy

## Scope

`soroban-error-registry` is a read-only static analysis tool. It parses Rust
source files and writes a report. It does not execute the code it reads, does
not make network requests, and has no runtime dependencies.

The realistic risks are therefore limited to:

- A crafted source file causing the parser to hang or exhaust memory in CI.
- The tool writing a report to an unexpected path via `--out`.
- A missed finding giving false confidence that a contract's error codes are
  unique.

All three are in scope.

## Reporting

Please report anything in the list above privately through GitHub's
[security advisory form](https://github.com/eleven-smg/soroban-error-registry/security/advisories/new)
rather than as a public issue.

Expect an acknowledgement within 72 hours and an assessment within seven days.

## Not in scope

Vulnerabilities in the Soroban contracts you point the tool at. Report those to
the project that owns them.
