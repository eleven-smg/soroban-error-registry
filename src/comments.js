/**
 * Blanking pass for Rust source text.
 *
 * Comments, string literals, raw string literals and character literals are
 * replaced with spaces so that later passes can search the source with plain
 * string/regex operations without matching text that only *looks* like code.
 *
 * Newlines are preserved, and every replacement is exactly as long as the text
 * it replaces, so byte offsets and line numbers stay valid.
 */

const IDENT_CHAR = /[A-Za-z0-9_]/

/**
 * @param {string} source Rust source text.
 * @returns {string} The same text with comments and literals blanked out.
 */
export function blankComments(source) {
	const out = source.split("")
	const length = source.length
	let i = 0

	const blank = (from, to) => {
		for (let k = from; k < to && k < length; k++) {
			if (out[k] !== "\n") out[k] = " "
		}
	}

	while (i < length) {
		const ch = source[i]

		// Line comment, including doc comments.
		if (ch === "/" && source[i + 1] === "/") {
			let j = i
			while (j < length && source[j] !== "\n") j++
			blank(i, j)
			i = j
			continue
		}

		// Block comment. Rust allows these to nest.
		if (ch === "/" && source[i + 1] === "*") {
			let depth = 1
			let j = i + 2
			while (j < length && depth > 0) {
				if (source[j] === "/" && source[j + 1] === "*") {
					depth++
					j += 2
					continue
				}
				if (source[j] === "*" && source[j + 1] === "/") {
					depth--
					j += 2
					continue
				}
				j++
			}
			blank(i, j)
			i = j
			continue
		}

		// Raw string: r"...", r#"..."#, br#"..."#
		const hashes = rawStringHashes(source, i)
		if (hashes !== -1) {
			const end = endOfRawString(source, i, hashes)
			blank(i, end)
			i = end
			continue
		}

		// Ordinary string literal.
		if (ch === '"') {
			const end = endOfString(source, i)
			blank(i, end)
			i = end
			continue
		}

		// Character literal. A lone quote is far more likely to be a lifetime
		// (`'a`), so only consume text that actually looks like a char literal.
		if (ch === "'") {
			const end = endOfCharLiteral(source, i)
			if (end !== -1) {
				blank(i, end)
				i = end
				continue
			}
		}

		i++
	}

	return out.join("")
}

/**
 * @returns {number} Number of `#` characters in the raw string prefix, or -1
 * when no raw string starts at `i`.
 */
function rawStringHashes(source, i) {
	const previous = i > 0 ? source[i - 1] : " "
	if (IDENT_CHAR.test(previous)) return -1

	let j = i
	if (source[j] === "b") j++
	if (source[j] !== "r") return -1
	j++

	let hashes = 0
	while (source[j] === "#") {
		hashes++
		j++
	}
	return source[j] === '"' ? hashes : -1
}

function endOfRawString(source, i, hashes) {
	const openQuote = source.indexOf('"', i)
	const terminator = '"' + "#".repeat(hashes)
	const end = source.indexOf(terminator, openQuote + 1)
	return end === -1 ? source.length : end + terminator.length
}

function endOfString(source, i) {
	let j = i + 1
	while (j < source.length) {
		if (source[j] === "\\") {
			j += 2
			continue
		}
		if (source[j] === '"') return j + 1
		j++
	}
	return source.length
}

function endOfCharLiteral(source, i) {
	const window = source.slice(i, i + 16)
	const match = /^'(\\(?:x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]{1,6}\}|.)|[^\\'])'/.exec(window)
	return match ? i + match[0].length : -1
}
