/**
 * Parser for Soroban `#[contracterror]` enum declarations.
 *
 * This is deliberately a lexical parser rather than a full Rust front end: the
 * tool has to run in CI without a Rust toolchain, and error enums are a small,
 * highly regular corner of the language. See README.md for the exact set of
 * shapes that are recognised.
 */

import { blankComments } from "./comments.js"

const ATTRIBUTE = "#[contracterror]"
const IDENT_CHAR = /[A-Za-z0-9_]/

/**
 * @typedef {object} Variant
 * @property {string} name
 * @property {number|null} value Explicit discriminant, or null when omitted.
 * @property {number} line 1-based line number of the variant.
 *
 * @typedef {object} ErrorEnum
 * @property {string} name
 * @property {string} file
 * @property {number} line 1-based line number of the `#[contracterror]` attribute.
 * @property {Variant[]} variants
 */

/**
 * @param {string} source Rust source text.
 * @param {string} [filePath] Path recorded on each result, for reporting.
 * @returns {ErrorEnum[]}
 */
export function parseContractErrors(source, filePath = "<memory>") {
	const clean = blankComments(source)
	const lineOffsets = buildLineOffsets(clean)
	const found = []

	let cursor = 0
	while (true) {
		const attributeAt = clean.indexOf(ATTRIBUTE, cursor)
		if (attributeAt === -1) break
		cursor = attributeAt + ATTRIBUTE.length

		// Only look for the enum keyword before the next attribute, so an
		// attribute that is not followed by an enum cannot swallow the next one.
		const nextAttribute = clean.indexOf(ATTRIBUTE, cursor)
		const limit = nextAttribute === -1 ? clean.length : nextAttribute

		const keywordAt = findEnumKeyword(clean, cursor, limit)
		if (keywordAt === -1) continue

		const identifier = readIdentifier(clean, skipWhitespace(clean, keywordAt + 4))
		if (!identifier) continue

		const bodyStart = clean.indexOf("{", identifier.end)
		if (bodyStart === -1 || bodyStart >= limit) continue

		const bodyEnd = matchBrace(clean, bodyStart)
		if (bodyEnd === -1) continue

		found.push({
			name: identifier.name,
			file: filePath,
			line: lineOf(lineOffsets, attributeAt),
			variants: parseVariants(clean.slice(bodyStart + 1, bodyEnd), bodyStart + 1, lineOffsets),
		})

		cursor = bodyEnd + 1
	}

	return found
}

function buildLineOffsets(source) {
	const offsets = [0]
	for (let i = 0; i < source.length; i++) {
		if (source[i] === "\n") offsets.push(i + 1)
	}
	return offsets
}

/** @returns {number} 1-based line number containing `index`. */
function lineOf(offsets, index) {
	let low = 0
	let high = offsets.length - 1
	while (low < high) {
		const mid = (low + high + 1) >> 1
		if (offsets[mid] <= index) low = mid
		else high = mid - 1
	}
	return low + 1
}

function skipWhitespace(source, i) {
	while (i < source.length && /\s/.test(source[i])) i++
	return i
}

function readIdentifier(source, i) {
	if (i >= source.length || !/[A-Za-z_]/.test(source[i])) return null
	let j = i
	while (j < source.length && IDENT_CHAR.test(source[j])) j++
	return { name: source.slice(i, j), end: j }
}

function findEnumKeyword(source, from, limit) {
	let i = from
	while (i < limit) {
		const at = source.indexOf("enum", i)
		if (at === -1 || at >= limit) return -1
		const before = at === 0 ? " " : source[at - 1]
		const after = at + 4 < source.length ? source[at + 4] : " "
		if (!IDENT_CHAR.test(before) && !IDENT_CHAR.test(after)) return at
		i = at + 4
	}
	return -1
}

function matchBrace(source, openAt) {
	let depth = 0
	for (let i = openAt; i < source.length; i++) {
		if (source[i] === "{") depth++
		else if (source[i] === "}") {
			depth--
			if (depth === 0) return i
		}
	}
	return -1
}

/** Split an enum body on top-level commas, keeping each entry's offset. */
function splitEntries(body) {
	const entries = []
	let depth = 0
	let start = 0
	for (let i = 0; i < body.length; i++) {
		const ch = body[i]
		if (ch === "(" || ch === "[" || ch === "{") depth++
		else if (ch === ")" || ch === "]" || ch === "}") depth--
		else if (ch === "," && depth === 0) {
			entries.push({ text: body.slice(start, i), offset: start })
			start = i + 1
		}
	}
	if (body.slice(start).trim().length > 0) {
		entries.push({ text: body.slice(start), offset: start })
	}
	return entries
}

function parseVariants(body, bodyStart, lineOffsets) {
	const variants = []

	for (const entry of splitEntries(body)) {
		let text = entry.text
		let consumed = 0

		// Drop per-variant attributes such as #[cfg(...)].
		while (true) {
			const attribute = /^\s*#\[[^\]]*\]/.exec(text)
			if (!attribute) break
			consumed += attribute[0].length
			text = text.slice(attribute[0].length)
		}

		const leading = /^\s*/.exec(text)[0]
		consumed += leading.length
		text = text.slice(leading.length)

		const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*(?:=\s*(0[xX][0-9a-fA-F]+|\d+))?\s*$/.exec(text)
		if (!match) continue

		variants.push({
			name: match[1],
			value: match[2] === undefined ? null : Number(match[2]),
			line: lineOf(lineOffsets, bodyStart + entry.offset + consumed),
		})
	}

	return variants
}
