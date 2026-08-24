// The purpose of this function is, given an english word and its ipa, it adds marks to the word that serves as a prononunciation gude.
// via gpt5.5

type Stress = "primary" | "secondary";

type SoundToken = {
	p: string;
	stress?: Stress | undefined;
};

type Options = {
	markSilent?: boolean;
	markStress?: boolean;
};

type Rule = {
	ipa: string;
	spellings: string[];
	cost?: number;
	annotate: (segment: string, token: SoundToken, opts: Required<Options>) => string;
};

const DEFAULT_OPTIONS: Required<Options> = {
	markSilent: true,
	markStress: true,
};

// Combining marks
const M = {
	SMALL_R: "\u036C", // ◌ͬ
	DOT_ABOVE: "\u0307", // ◌̇
	SMALL_A: "\u0363", // ◌ͣ
	BREVE: "\u0306", // ◌̆
	CIRCUMFLEX: "\u0302", // ◌̂
	SMALL_E: "\u0364", // ◌ͤ
	DOUBLE_GRAVE: "\u030F", // ◌̏
	ACUTE: "\u0301", // ◌́
	SMALL_I: "\u0365", // ◌ͥ
	MACRON: "\u0304", // ◌̄
	RING: "\u030A", // ◌̊
	DIAERESIS: "\u0308", // ◌̈
	IPA_U_MARK: "\u1DC1", // Note: // x. Can't render: THREE_DOTS_ABOVE: "\u20DB",
	SUSPENSION_MARK: "\u1DC3", // ◌᷃ "\u1DC3" (suspension_mark)

	SMALL_D: "\u0369", // ◌ͩ
	SMALL_H: "\u036A", // ◌ͪ
	SMALL_W: "\u1DF1", // ◌ᷱ
	SMALL_F: "\u1DEB", // ◌ᷫ
	SMALL_K: "\u1DDC", // ◌ᷜ
	SMALL_Z: "\u1DE6",

	CEDILLA: "\u0327", // ◌̧
	TILDE: "\u0303", // ◌̃

	SILENT: "\u0329", // ◌̩
	STRESS: "\u032D", // ◌̭ // STRESS: "\u0331", // ◌̱
};

const VOWEL_RE = /[aeiouyAEIOUY]/;

const VOWEL_IPA = new Set([
	"a",
	"ɑ",
	"ɒ",
	"ɔ",
	"æ",
	"ʌ",
	"ə",
	"ɚ",
	"ɝ",
	"ɜː",
	"aʊ",
	"aɪ",
	"ɛ",
	"eɪ",
	"ɪ",
	"i",
	"oʊ", "əʊ",
	"ɔɪ",
	"ʊ",
	"u",
	"ju",
]);

function stressMark(token: SoundToken, opts: Required<Options>): string {
	return opts.markStress && token.stress ? M.STRESS : "";
}

function firstVowelIndex(s: string): number {
	for (let i = 0; i < s.length; i++) {
		if (VOWEL_RE.test(s[i]!)) return i;
	}
	return 0;
}

function addMarksAt(s: string, index: number, marks: string): string {
	if (!marks) return s;
	return s.slice(0, index + 1) + marks + s.slice(index + 1);
}

function markFirstVowel(
	segment: string,
	marks: string,
): string {
	return addMarksAt(segment, firstVowelIndex(segment), marks);
}

function markAtAndSilenceNonStarterVowels(
	segment: string,
	index: number,
	marks: string,
	opts: Required<Options>,
): string {
	let out = "";

	for (let k = 0; k < segment.length; k++) {
		const ch = segment[k]!;
		out += ch;

		if (k === index) {
			out += marks;
		} else if (k > index && VOWEL_RE.test(ch)) { // This only silences VOWELS e.g. in "eight": "i"
			// } else if (k > index) { // This would silence ALL LETTERS e.g. "eight": "igh" - but also the "r" in "er,ar,or for /ɚ/ sound"
			out += opts.markSilent ? M.SILENT : "";
		}
	}

	return out;
}

function markFirstVowelAndSilenceNonStarters(
	segment: string,
	marks: string,
	opts: Required<Options>,
): string {
	return markAtAndSilenceNonStarterVowels(
		segment,
		firstVowelIndex(segment),
		marks,
		opts,
	);
}

function lower(s: string): string {
	return s.toLocaleLowerCase();
}

function startsWithAt(haystackLower: string, needleLower: string, index: number): boolean {
	return haystackLower.slice(index, index + needleLower.length) === needleLower;
}

/**
 * Tokenizes IPA-ish input.
 *
 * This follows your table mostly literally.
 *
 * Note: standard IPA normally uses /uː/ for “food” and /ʊ/ for “book”.
 * Your table appears to use `ʊ` for “food” and `u` for “book”.
 * This tokenizer therefore maps `uː` to `ʊ`, but leaves bare `ʊ` and `u`
 * as written.
 */
function tokenizeIPA(rawIpa: string): SoundToken[] {
	let ipa = rawIpa
		.trim()
		.replace(/^\/|\/$/g, "")
		.replace(/^\[|\]$/g, "")
		.replace(/\s+/g, "")
		.replace(/ɡ/g, "g")
		.replace(/t͡ʃ/g, "tʃ")
		.replace(/d͡ʒ/g, "dʒ");

	const symbols = [
		"tʃ",
		"dʒ",

		"aʊ",
		"aɪ",
		"eɪ",
		"oʊ", "əʊ",
		"ɔɪ",
		"ɪə",
		"eə",
		"ʊə",

		"ɜː",
		"iː",
		"uː",
		"ju",

		"a",
		"ɑ",
		"ɒ",
		"ɔ",
		"æ",
		"ʌ",
		"ə",
		"ɚ",
		"ɝ",
		"ɛ",
		"ɪ",
		"i",
		"ʊ",
		"u",

		"ŋ",
		"ɹ",
		"ð",
		"θ",
		"ʃ",
		"ʒ",
		"w",
		"f",
		"k",
		"s",
		"z",

		"b",
		"d",
		"g",
		"h",
		"l",
		"m",
		"n",
		"p",
		"r",
		"t",
		"v",
		"j",
	];

	const out: SoundToken[] = [];
	let pendingStress: Stress | undefined;

	for (let i = 0; i < ipa.length;) {
		const ch = ipa[i];

		if (ch === "ˈ") {
			pendingStress = "primary";
			i++;
			continue;
		}

		if (ch === "ˌ") {
			pendingStress = "secondary";
			i++;
			continue;
		}

		// Ignore syllable separators and length marks not part of a known symbol.
		if (ch === "." || ch === "ː") {
			i++;
			continue;
		}

		let matched: string | undefined;

		for (const sym of symbols) {
			if (ipa.slice(i, i + sym.length) === sym) {
				matched = sym;
				break;
			}
		}

		if (!matched) {
			// Unknown IPA char: skip it rather than crashing.
			i++;
			continue;
		}

		let canonical = matched;

		// A few common aliases.
		if (canonical === "a") canonical = "æ";
		if (canonical === "iː") canonical = "i";
		if (canonical === "uː") canonical = "u";

		// Your table says these should apply the same rules to individual letters.
		const expanded =
			canonical === "ɪə" ? ["ɪ", "ə"] :
			canonical === "eə" ? ["ɛ", "ə"] :
			canonical === "ʊə" ? ["ʊ", "ə"] :
			[canonical];

		for (const p of expanded) {
			const token: SoundToken = { p };

			if (pendingStress && VOWEL_IPA.has(p)) {
				token.stress = pendingStress;
				pendingStress = undefined;
			}

			out.push(token);
		}

		i += matched.length;
	}

	// Collapse j + u/ʊ → ju
	const collapsed: SoundToken[] = [];
	for (let k = 0; k < out.length; k++) {
		if (
			out[k]!.p === "j" &&
			k + 1 < out.length &&
			(out[k + 1]!.p === "u" || out[k + 1]!.p === "ʊ")
		) {
			collapsed.push({ p: "ju", stress: out[k + 1]!.stress });
			k++;
		} else {
			collapsed.push(out[k]!);
		}
	}
	return collapsed;
}

function buildRules(): Record<string, Rule[]> {
	const rules: Record<string, Rule[]> = {};

	function add(
		ipa: string,
		spellings: string[],
		annotate: Rule["annotate"],
		cost = 0,
	) {
		rules[ipa] ??= [];
		rules[ipa].push({ ipa, spellings, annotate, cost });
	}

	function plain(segment: string): string {
		return segment;
	}

	function vowelAlways(mark: string): Rule["annotate"] {
		// A.
		return (seg, tok, opts) => markFirstVowel(seg, mark + stressMark(tok, opts));
		// B. (Silence Subsequent Vowels)
		// return (seg, tok, opts) =>
		// 	markFirstVowelAndSilenceNonStarters(
		// 		seg,
		// 		mark + stressMark(tok, opts),
		// 		opts,
		// 	);
	}

	function vowelConditional(
		mark: string,
		canonicalLetters: string[],
	): Rule["annotate"] {
		return (seg, tok, opts) => {
			const idx = firstVowelIndex(seg);
			const ch = lower(seg[idx] ?? "");
			const segLower = lower(seg);

			const canonical = canonicalLetters.map(lower);

			const needsMark =
				!canonical.includes(ch) &&
				!canonical.includes(segLower);

			// A.
			return addMarksAt(seg, idx, (needsMark ? mark : "") + stressMark(tok, opts));

			// B. (Silence Subsequent Vowels)
			// return markAtAndSilenceNonStarterVowels(
			// 	seg,
			// 	idx,
			// 	(needsMark ? mark : "") + stressMark(tok, opts),
			// 	opts,
			// );
		};
	}

	function noVowelMark(): Rule["annotate"] {
		return (seg, tok, opts) => {
			const sm = stressMark(tok, opts);
			// A.
			return sm ? markFirstVowel(seg, sm) : seg;
			// B. (Silence Subsequent Vowels)
			// // return markFirstVowelAndSilenceNonStarters( seg, sm, opts, ); // this would silence the 'u' in 'mountain'
		};
	}

	// ----------------
	// VOWELS
	// ----------------

	// ɑ
	add("ɑ", ["a", "al", "au", "o", "ar"], vowelAlways(M.SMALL_R));

	// ɒ and ɔ: no mark for simple “o”, dot above otherwise / ambiguous digraphs.
	add("ɒ", ["o", "a", "au", "aw", "ou", "ow"], vowelConditional(M.DOT_ABOVE, ["o"]));
	add("ɔ", ["o", "a", "au", "aw", "al", "or", ], vowelConditional(M.DOT_ABOVE, ["o"])); // removed "oo", "oor", "our", "oa", "ou",

	// æ
	add("æ", ["a", "ai"], vowelConditional(M.SMALL_A, ["a"]));

	// ʌ, ə, ɚ
	add("ʌ", ["u", "o", "ou", "oo", "oe"], vowelConditional(M.BREVE, ["u"]));
	add("ə", ["a", "e", "i", "o", "u", "y", "ai", "io", "ou"], vowelConditional(M.BREVE, ["u"]));
	add("ɚ", ["er", "or", "ar", "ir", "yr", "our", "re", "ure"], vowelConditional(M.BREVE, ["u"]));

	// aʊ: no change; spelling usually already hints it.
	add("aʊ", ["ow", "ou", "ough", "au"], noVowelMark());

	// aɪ
	add("aɪ", ["i", "y", "igh", "ie", "uy", "ye", "ai", "ei", "is"], vowelAlways(M.CIRCUMFLEX));

	// ɛ
	add("ɛ", ["e", "ea", "ai", "a", "u", "ie", "eo", "ei"], vowelConditional(M.SMALL_E, ["e"]));

	// ɝ / ɜː
	add("ɝ", ["er", "ir", "ur", "or", "yr", "ear", "our", "ar",], vowelAlways(M.DOUBLE_GRAVE));
	add("ɜː", ["er", "ir", "ur", "or", "yr", "ear", "our"], vowelAlways(M.DOUBLE_GRAVE));

	// eɪ
	add("eɪ", ["a", "ai", "ay", "ea", "ei", "eigh", "ey", "au", "ao", "et", "é"], vowelAlways(M.ACUTE));

	// ɪ
	add("ɪ", ["i", "y", "u", "e", "o", "ui", "ei", "ie"], vowelConditional(M.SMALL_I, ["i"]));

	// i
	add("i", ["ee", "ea", "e", "ie", "ei", "ey", "y", "i", "eo", "oe", "ae", "ui"], vowelAlways(M.MACRON));

	// oʊ (US) / əʊ (UK) // "OH" Sound
	add("oʊ", ["o", "oa", "ow", "oe", "ough", "ew", "eau", "oh"], vowelAlways(M.RING));
	add("əʊ", ["o", "oa", "ow", "oe", "ough", "ew", "eau", "oh"], vowelAlways(M.RING));

	// ɔɪ: no change.
	add("ɔɪ", ["oi", "oy"], noVowelMark());

	/*
	fool /fuːl/ vs full /fʊl/
	pool /puːl/ vs pull /pʊl/
	Luke /luːk/ vs look /lʊk/
	*/
	// ʊ = “book/put/could/foot/pull/full/soot” style // More "RELAXED", SHORTer, relaxed tongue than /u/
	add("ʊ", ["oo", "u", "o", "ou"], vowelConditional(M.DIAERESIS, ["oo"]));
	// u / uː = “do/blue/flew/shoe/food/true” style // More "TENSED", LONGer, higher tongue /ʊ/
	add("u", ["oo", "u", "ue", "ew", "oe", "o", "ui", "ou"], vowelAlways(M.IPA_U_MARK));

	add("ju", ["u", "eau", "ew", "ue", "eu", "ieu"], (seg, tok, opts) =>
		// A.
		markFirstVowel(seg, M.SUSPENSION_MARK + stressMark(tok, opts))
		// B. (Silence Subsequent Vowels)
		// markFirstVowelAndSilenceNonStarters(seg, M.SUSPENSION_MARK + stressMark(tok, opts), opts,)
	);

	// ----------------
	// CONSONANTS
	// ----------------

	// Identity-ish consonants
	for (const c of ["b", "d", "g", "h", "l", "m", "n", "p", "r", "t", "v", "j"]) {
		add(c, [c], plain);
	}

	// ɹ  (the English approximant "r")
	add("ɹ", ["r", "rr", "wr", "rh"], plain);

	// θ not in your table, but useful for thin/think. Leave “th” unchanged.
	add("θ", ["th"], plain);

	// ð
	add("ð", ["th"], (seg) => addMarksAt(seg, 0, M.SMALL_D));

	// tʃ
	add("tʃ", ["ch", "tch"], plain);
	add("tʃ", ["t", "c"], (seg) => addMarksAt(seg, 0, M.SMALL_H), 1);
	add("tʃ", ["tu", "ti"], (seg) => addMarksAt(seg, 0, M.SMALL_H), 1);

	// ʃ
	add("ʃ", ["sh"], plain);
	add("ʃ", ["ch"], (seg) => addMarksAt(seg, 0, M.CEDILLA), 1);
	add("ʃ", ["s"], (seg) => addMarksAt(seg, 0, M.SMALL_H), 1);
	add("ʃ", ["c"], (seg) => addMarksAt(seg, 0, M.CEDILLA + M.SMALL_H), 1);
	add("ʃ", ["t"], (seg) => addMarksAt(seg, 0, M.CEDILLA + M.SMALL_H), 1);
	add("ʃ", ["ti", "ci", "si"], (seg) => addMarksAt(seg, 0, M.CEDILLA + M.SMALL_H), 1);

	// w
	add("w", ["w", "wh"], plain);
	add("w", ["u", "o"], (seg) => addMarksAt(seg, 0, M.SMALL_W), 1);

	// f
	add("f", ["f"], plain);
	add("f", ["ph", "gh"], (seg) => addMarksAt(seg, 0, M.SMALL_F), 0);

	// dʒ
	add("dʒ", ["j"], plain);
	add("dʒ", ["g", "dg", "di"], (seg) => addMarksAt(seg, 0, M.TILDE), 0);

	// k
	add("k", ["k", "ck"], plain);
	add("k", ["c", "q", "ch", "x"], (seg) => addMarksAt(seg, 0, M.SMALL_K), 0);

	// s
	add("s", ["s"], plain);
	add("s", ["sc"], (seg, _tok, opts) => seg[0] + (opts.markSilent ? seg[1] + M.SILENT : ""), 0);
	add("s", ["c"], (seg) => addMarksAt(seg, 0, M.CEDILLA), 0);
	add("s", ["z"], (seg) => addMarksAt(seg, 0, M.CEDILLA), 1);

	// z
	add("z", ["z"], plain);
	add("z", ["s"], (seg) => addMarksAt(seg, 0, M.SMALL_Z), 0);

	// ʒ
	add("ʒ", ["s", "z"], (seg) => addMarksAt(seg, 0, M.SMALL_Z), 0);

	// ŋ
	add("ŋ", ["ng", "n"], plain);

	return rules;
}

const RULES = buildRules();

function fallbackAnnotate(
	segment: string,
	token: SoundToken,
	opts: Required<Options>,
): string {
	// Last-resort fallback so unknown spellings still produce something.
	switch (token.p) {
		case "ɑ": return markFirstVowel(segment, M.SMALL_R + stressMark(token, opts));
		case "ɒ":
		case "ɔ": return markFirstVowel(segment, M.DOT_ABOVE + stressMark(token, opts));
		case "æ": return markFirstVowel(segment, M.SMALL_A + stressMark(token, opts));
		case "ʌ":
		case "ə":
		case "ɚ": return markFirstVowel(segment, M.BREVE + stressMark(token, opts));
		case "aɪ": return markFirstVowel(segment, M.CIRCUMFLEX + stressMark(token, opts));
		case "ɛ": return markFirstVowel(segment, M.SMALL_E + stressMark(token, opts));
		case "ɝ":
		case "ɜː": return markFirstVowel(segment, M.DOUBLE_GRAVE + stressMark(token, opts));
		case "eɪ": return markFirstVowel(segment, M.ACUTE + stressMark(token, opts));
		case "ɪ": return markFirstVowel(segment, M.SMALL_I + stressMark(token, opts));
		case "i": return markFirstVowel(segment, M.MACRON + stressMark(token, opts));
		case "oʊ": return markFirstVowel(segment, M.RING + stressMark(token, opts));
		case "əʊ": return markFirstVowel(segment, M.RING + stressMark(token, opts));
		case "ʊ": return markFirstVowel(segment, M.DIAERESIS + stressMark(token, opts));
		case "u": return markFirstVowel(segment, M.IPA_U_MARK + stressMark(token, opts));
		case "ju": return markFirstVowel(segment, M.SUSPENSION_MARK + stressMark(token, opts));
		default: return segment;
	}
}

export function wordNIpaToCLDiacritics(
	word: string,
	ipa: string,
	options: Options = {},
): string {
	if (!ipa) return word;
	// Brute IPA REFormats for ESPEAK
	ipa = ipa?.replaceAll('ɐ','ə'); // - 'ɐ' is technically lower than 'ə' - closer to 'uh/ah'
	ipa = ipa?.replaceAll(/ɜ(?![ː˞ɪʊiueə])/g, 'ə'); // replace bare /ɜ/ with /ə/, (not /ɜː/, /ɜ˞/, diphthongs, etc.) // ~ rough test - only evident in espeak so far in UK IPA: "wˈɔːtɜ"
	
	// ---------------------------------------
	if (word.trim().length == 0) return word; // return empty space as-is.

	const opts: Required<Options> = { ...DEFAULT_OPTIONS, ...options };
	const tokens = tokenizeIPA(ipa);
	const wordLower = lower(word);

	type Best = {
		cost: number;
		out: string;
	};

	const memo = new Map<string, Best | null>();

	function markSilentChar(ch: string): string {
		return opts.markSilent ? ch + M.SILENT : ch;
	}

	function solve(i: number, j: number): Best | null {
		const key = `${i},${j}`;
		if (memo.has(key)) return memo.get(key)!;

		if (i === word.length && j === tokens.length) {
			const res = { cost: 0, out: "" };
			memo.set(key, res);
			return res;
		}

		if (j === tokens.length) {
			let out = "";
			for (let k = i; k < word.length; k++) out += markSilentChar(word[k]!);
			const res = { cost: (word.length - i) * 8, out };
			memo.set(key, res);
			return res;
		}

		if (i === word.length) {
			memo.set(key, null);
			return null;
		}

		const token = tokens[j]!;
		let best: Best | null = null;

		function consider(candidate: Best | null) {
			if (!candidate) return;
			if (!best || candidate.cost < best.cost) best = candidate;
		}

		// Option 1: current written character is silent.
		{
				const ch = word[i]!;
				const isSeparator = ch === " " || ch === "-";
				const next = solve(i + 1, j);
				if (next) {
						consider({
								cost: isSeparator ? 0 : 8 + next.cost,
								out: (isSeparator ? ch : markSilentChar(ch)) + next.out,
						});
				}
		}

		// Option 2: apply explicit spelling rules for this IPA token.
		const rs = RULES[token.p] ?? [];
		for (const rule of rs) {
			for (const spelling of rule.spellings) {
				const spellingLower = lower(spelling);

				if (!startsWithAt(wordLower, spellingLower, i)) continue;

				const segment = word.slice(i, i + spelling.length);
				const next = solve(i + spelling.length, j + 1);
				if (!next) continue;

				consider({
					cost: (rule.cost ?? 0) + next.cost,
					out: rule.annotate(segment, token, opts) + next.out,
				});
			}
			// Option 2b: doubled consonant — consume letter twice for one IPA token.
			// e.g. "bb" in "rabbit", "tt" in "bitter", "gg" in "egg", "ll" in "yellow"
			for (const spelling of rule.spellings) {
					const spellingLower = lower(spelling);
					if (spellingLower.length !== 1) continue; // only applies to single-char spellings

					const doubled = spellingLower + spellingLower;
					if (!startsWithAt(wordLower, doubled, i)) continue;

					const segment = word.slice(i, i + 2); // both characters
					const next = solve(i + 2, j + 1);
					if (!next) continue;

					// Annotate only the first character, append the second plain
						const annotated = rule.annotate(word.slice(i, i + 1), token, opts) + word[i + 1]!;

					consider({
							cost: (rule.cost ?? 0) + next.cost, // same cost as a normal match
							out: annotated + next.out,
					});
			}
			// Option 2c: "x" as /ks/ — one written char consumes TWO IPA tokens.
			if (j + 1 < tokens.length && wordLower[i] === "x") {
				const t0 = tokens[j]!;
				const t1 = tokens[j + 1]!;
				if (t0.p === "k" && t1.p === "s") {
						const next = solve(i + 1, j + 2);
						if (next) {
								consider({
										cost: 0 + next.cost,
										out: "x" + next.out,
								});
						}
				}
				// x → /gz/ (e.g. "exam", "exact")
				if (t0.p === "g" && t1.p === "z") {
						const next = solve(i + 1, j + 2);
						if (next) {
								consider({
										cost: 0 + next.cost,
										out: "x" + next.out,
								});
						}
				}
			}

		}

		// Option 3: fallback: consume one written character for one IPA token.
		// This is intentionally expensive.
		{
			const segment = word.slice(i, i + 1);
			const next = solve(i + 1, j + 1);
			if (next) {
				consider({
					cost: 30 + next.cost,
					out: fallbackAnnotate(segment, token, opts) + next.out,
				});
			}
		}

		memo.set(key, best);
		return best;
	}

	return solve(0, 0)?.out ?? word;
}
