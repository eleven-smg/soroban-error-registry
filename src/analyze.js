/**
 * Rules applied to parsed `#[contracterror]` enums.
 *
 * Every finding carries a stable `rule` id so that a project can silence a rule
 * it does not care about without silencing the whole tool.
 */

/**
 * @typedef {object} Finding
 * @property {string} rule
 * @property {"error"|"warning"} severity
 * @property {string} file
 * @property {number} line
 * @property {string} message
 */

export const RULES = [
	{
		id: "duplicate-discriminant",
		severity: "error",
		summary: "Two variants of the same enum are assigned the same numeric code.",
	},
	{
		id: "code-collision",
		severity: "error",
		summary: "Two different error enums define the same numeric code.",
	},
	{
		id: "range-violation",
		severity: "error",
		summary: "A variant falls outside the range declared for its enum in the config file.",
	},
	{
		id: "range-overlap",
		severity: "warning",
		summary: "Two error enums occupy overlapping numeric ranges.",
	},
	{
		id: "implicit-discriminant",
		severity: "warning",
		summary: "A variant has no explicit discriminant, so its code depends on declaration order.",
	},
]

/**
 * @param {import("./parse.js").ErrorEnum[]} enums
 * @param {{ignore?: string[], ranges?: Record<string, [number, number]>}} [config]
 * @returns {Finding[]}
 */
export function analyze(enums, config = {}) {
	const ignored = new Set(config.ignore ?? [])
	const findings = []
	const report = (finding) => {
		if (!ignored.has(finding.rule)) findings.push(finding)
	}

	for (const declaration of enums) {
		const seen = new Map()

		for (const variant of declaration.variants) {
			if (variant.value === null) {
				report({
					rule: "implicit-discriminant",
					severity: "warning",
					file: declaration.file,
					line: variant.line,
					message:
						`${declaration.name}::${variant.name} has no explicit discriminant. ` +
						"Its numeric code depends on declaration order, so inserting a variant " +
						"above it silently changes the code every client already depends on.",
				})
				continue
			}

			const previous = seen.get(variant.value)
			if (previous) {
				report({
					rule: "duplicate-discriminant",
					severity: "error",
					file: declaration.file,
					line: variant.line,
					message:
						`${declaration.name}::${variant.name} reuses code ${variant.value}, already ` +
						`assigned to ${declaration.name}::${previous.name} on line ${previous.line}. ` +
						"rustc rejects this with E0081.",
				})
				continue
			}

			seen.set(variant.value, variant)
		}
	}

	const spans = []
	for (const declaration of enums) {
		const values = declaration.variants
			.filter((variant) => variant.value !== null)
			.map((variant) => variant.value)
		if (values.length === 0) continue
		spans.push({
			declaration,
			min: Math.min(...values),
			max: Math.max(...values),
			values: new Set(values),
		})
	}

	for (let i = 0; i < spans.length; i++) {
		for (let j = i + 1; j < spans.length; j++) {
			const a = spans[i]
			const b = spans[j]
			if (a.max < b.min || b.max < a.min) continue

			const shared = [...a.values].filter((value) => b.values.has(value)).sort((x, y) => x - y)

			if (shared.length > 0) {
				report({
					rule: "code-collision",
					severity: "error",
					file: b.declaration.file,
					line: b.declaration.line,
					message:
						`${a.declaration.name} (${a.declaration.file}) and ${b.declaration.name} ` +
						`(${b.declaration.file}) both define code${shared.length > 1 ? "s" : ""} ` +
						`${shared.join(", ")}. A caller that only sees the numeric code cannot tell ` +
						"which contract rejected the call.",
				})
				continue
			}

			report({
				rule: "range-overlap",
				severity: "warning",
				file: b.declaration.file,
				line: b.declaration.line,
				message:
					`${a.declaration.name} occupies ${a.min}-${a.max} and ${b.declaration.name} ` +
					`occupies ${b.min}-${b.max}. The ranges overlap, so the next variant added to ` +
					"either enum is likely to collide.",
			})
		}
	}

	const declaredRanges = config.ranges ?? {}
	for (const span of spans) {
		const range = declaredRanges[span.declaration.name]
		if (!range) continue
		const [low, high] = range

		for (const variant of span.declaration.variants) {
			if (variant.value === null) continue
			if (variant.value >= low && variant.value <= high) continue
			report({
				rule: "range-violation",
				severity: "error",
				file: span.declaration.file,
				line: variant.line,
				message:
					`${span.declaration.name}::${variant.name} = ${variant.value} falls outside the ` +
					`range ${low}-${high} declared for ${span.declaration.name}.`,
			})
		}
	}

	return findings
}

/** @param {Finding[]} findings */
export function summarize(findings) {
	return {
		errors: findings.filter((finding) => finding.severity === "error").length,
		warnings: findings.filter((finding) => finding.severity === "warning").length,
	}
}
