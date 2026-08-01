# Contributing

Thanks for taking a look. This project is small on purpose, and the bar for a
change is simple: it should make the tool catch a real mistake, or stop it from
reporting one that is not real.

## Getting set up

```bash
git clone https://github.com/eleven-smg/soroban-error-registry.git
cd soroban-error-registry
npm test
```

There is nothing to install. The project has no runtime and no development
dependencies; tests run on the Node built-in test runner. You need Node 20 or
newer.

## Ground rules

- **Every behaviour change needs a test.** Parser changes go in
  `test/parse.test.js`, rule changes go in `test/analyze.test.js`.
- **A false positive is worse than a miss.** This tool is meant to sit in CI. If
  the parser is not sure it understood a variant, it should stay quiet rather
  than fail somebody's build.
- **No runtime dependencies.** A lint tool that needs an install step will not
  be added to a pipeline. If a change needs a dependency, open an issue first
  and make the case.
- **Keep the rule ids stable.** Projects silence rules by id in their config, so
  renaming one is a breaking change.

## Adding a rule

1. Add an entry to `RULES` in `src/analyze.js` with an id, a severity and a one
   line summary.
2. Emit the finding through the local `report()` helper so `config.ignore`
   keeps working.
3. Document it in `README.md` and `docs/rules.md`.
4. Add a test that fails without the rule and passes with it.

Use `error` only when the code is certainly wrong. Anything that is merely
risky, or that a project might reasonably choose to do, is a `warning`.

## Commits and pull requests

Commit messages follow Conventional Commits: `feat:`, `fix:`, `docs:`,
`test:`, `refactor:`, `chore:`.

A pull request should say what it changes, why, and how it was verified. Keep
unrelated changes out; two small pull requests are easier to review than one
large one.

## Reporting a parser bug

The most useful bug report is a minimal Rust snippet that the parser reads
incorrectly, with what you expected and what you got. Snippets are easy to turn
straight into a regression test.
