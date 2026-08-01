#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { parseContractErrors } from "../src/parse.js"
import { analyze, summarize } from "../src/analyze.js"
import { toText, toMarkdown } from "../src/report.js"

const SKIPPED_DIRECTORIES = new Set([".git", "node_modules", "target", "dist", "build"])

const USAGE = `soroban-error-registry [options] [paths...]

Scans Rust sources for #[contracterror] enums and reports duplicate
discriminants, cross-contract code collisions and overlapping code ranges.

Options:
  --json             Emit machine readable JSON instead of text.
  --markdown         Emit a Markdown registry table instead of text.
  --out <file>       Write the report to a file instead of stdout.
  --config <file>    JSON config with "ranges" and/or "ignore" keys.
  --strict           Treat warnings as failures.
  -h, --help         Show this message.

Exit codes:
  0  no errors (and no warnings when --strict is set)
  1  at least one finding failed the run
  2  the tool could not run (bad arguments, unreadable file)
`

function parseArguments(argv) {
	const options = {
		paths: [],
		json: false,
		markdown: false,
		out: null,
		config: null,
		strict: false,
		help: false,
	}

	for (let i = 0; i < argv.length; i++) {
		const argument = argv[i]
		switch (argument) {
			case "-h":
			case "--help":
				options.help = true
				break
			case "--json":
				options.json = true
				break
			case "--markdown":
				options.markdown = true
				break
			case "--strict":
				options.strict = true
				break
			case "--out":
				options.out = argv[++i]
				if (!options.out) throw new Error("--out requires a file path")
				break
			case "--config":
				options.config = argv[++i]
				if (!options.config) throw new Error("--config requires a file path")
				break
			default:
				if (argument.startsWith("-")) throw new Error(`Unknown option: ${argument}`)
				options.paths.push(argument)
		}
	}

	if (options.json && options.markdown) {
		throw new Error("--json and --markdown cannot be combined")
	}
	if (options.paths.length === 0) options.paths.push(".")

	return options
}

function collectRustFiles(root) {
	const found = []
	const stack = [root]

	while (stack.length > 0) {
		const current = stack.pop()
		const stats = statSync(current)

		if (stats.isDirectory()) {
			for (const entry of readdirSync(current)) {
				if (SKIPPED_DIRECTORIES.has(entry)) continue
				stack.push(join(current, entry))
			}
			continue
		}

		if (current.endsWith(".rs")) found.push(current)
	}

	return found.sort()
}

function main() {
	const options = parseArguments(process.argv.slice(2))

	if (options.help) {
		process.stdout.write(USAGE)
		return 0
	}

	const config = options.config ? JSON.parse(readFileSync(options.config, "utf8")) : {}

	const enums = []
	for (const path of options.paths) {
		for (const file of collectRustFiles(path)) {
			const source = readFileSync(file, "utf8")
			if (!source.includes("#[contracterror]")) continue
			enums.push(...parseContractErrors(source, relative(process.cwd(), file) || file))
		}
	}

	const findings = analyze(enums, config)

	let output
	if (options.json) output = JSON.stringify({ enums, findings }, null, 2)
	else if (options.markdown) output = toMarkdown(enums, findings)
	else output = toText(enums, findings)

	if (options.out) writeFileSync(options.out, `${output}\n`)
	else process.stdout.write(`${output}\n`)

	const counts = summarize(findings)
	const failed = counts.errors > 0 || (options.strict && counts.warnings > 0)
	return failed ? 1 : 0
}

try {
	process.exit(main())
} catch (error) {
	process.stderr.write(`soroban-error-registry: ${error.message}\n`)
	process.exit(2)
}
