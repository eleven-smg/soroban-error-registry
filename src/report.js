/** Output formats for the registry and its findings. */

import { summarize } from "./analyze.js"

/**
 * Human readable output for a terminal.
 *
 * @param {import("./parse.js").ErrorEnum[]} enums
 * @param {import("./analyze.js").Finding[]} findings
 */
export function toText(enums, findings) {
	const lines = []

	if (enums.length === 0) {
		return "No #[contracterror] enums found."
	}

	for (const declaration of enums) {
		lines.push(`${declaration.name}  (${declaration.file}:${declaration.line})`)
		for (const variant of declaration.variants) {
			const code = variant.value === null ? "implicit" : String(variant.value)
			lines.push(`  ${code.padStart(8)}  ${variant.name}`)
		}
		lines.push("")
	}

	for (const finding of findings) {
		lines.push(`${finding.severity}: ${finding.file}:${finding.line}  [${finding.rule}]`)
		lines.push(`  ${finding.message}`)
	}

	const counts = summarize(findings)
	lines.push("")
	lines.push(
		`${enums.length} enum(s), ${counts.errors} error(s), ${counts.warnings} warning(s).`,
	)

	return lines.join("\n")
}

/**
 * Markdown suitable for committing as a generated error-code registry.
 *
 * @param {import("./parse.js").ErrorEnum[]} enums
 * @param {import("./analyze.js").Finding[]} findings
 */
export function toMarkdown(enums, findings) {
	const lines = ["# Contract error registry", ""]

	if (enums.length === 0) {
		lines.push("No `#[contracterror]` enums found.")
		return lines.join("\n")
	}

	lines.push("| Code | Enum | Variant | Source |")
	lines.push("| ---: | --- | --- | --- |")

	const rows = []
	for (const declaration of enums) {
		for (const variant of declaration.variants) {
			rows.push({
				value: variant.value,
				code: variant.value === null ? "_implicit_" : String(variant.value),
				enumName: declaration.name,
				variant: variant.name,
				source: `${declaration.file}:${variant.line}`,
			})
		}
	}

	rows.sort((a, b) => {
		if (a.value === null) return 1
		if (b.value === null) return -1
		return a.value - b.value
	})

	for (const row of rows) {
		lines.push(`| ${row.code} | \`${row.enumName}\` | \`${row.variant}\` | ${row.source} |`)
	}

	lines.push("")
	lines.push("## Findings")
	lines.push("")

	if (findings.length === 0) {
		lines.push("No issues found.")
	} else {
		lines.push("| Severity | Rule | Location | Detail |")
		lines.push("| --- | --- | --- | --- |")
		for (const finding of findings) {
			lines.push(
				`| ${finding.severity} | \`${finding.rule}\` | ${finding.file}:${finding.line} | ${finding.message} |`,
			)
		}
	}

	return lines.join("\n")
}
