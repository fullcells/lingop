// via gpt5.5

type PhoneKind = "vowel" | "consonant";
type Stress = "primary" | "secondary";

interface PhoneSpec {
	ipa: string;
	resp: string;
	kind: PhoneKind;
}

interface Phone {
	ipa: string;
	resp: string;
	kind: PhoneKind;
	stress?: Stress | undefined;
	breakBefore?: boolean;
}

interface Options {
	/**
	 * If true, unknown IPA chars are copied through instead of throwing.
	 * Default: true.
	 */
	keepUnknown?: boolean;
}

const PHONE_SPECS: PhoneSpec[] = [
	// Longer/r-colored vowels first.
	{ ipa: "aɪər", resp: "ire", kind: "vowel" },
	{ ipa: "aʊər", resp: "our", kind: "vowel" },
	{ ipa: "ɔɪər", resp: "oir", kind: "vowel" },
	{ ipa: "ɛər", resp: "air", kind: "vowel" },
	{ ipa: "ɑːr", resp: "ar", kind: "vowel" },
	{ ipa: "ɪər", resp: "eer", kind: "vowel" },
	{ ipa: "ʊər", resp: "oor", kind: "vowel" },
	{ ipa: "jʊər", resp: "ure", kind: "vowel" },
	{ ipa: "ɜːr", resp: "ur", kind: "vowel" },
	{ ipa: "ɜr", resp: "ur", kind: "vowel" },
	{ ipa: "ɔːr", resp: "or", kind: "vowel" },
	{ ipa: "ɒr", resp: "orr", kind: "vowel" },
	{ ipa: "ær", resp: "arr", kind: "vowel" },
	{ ipa: "ɛr", resp: "err", kind: "vowel" },
	{ ipa: "ɪr", resp: "irr", kind: "vowel" },
	{ ipa: "ʌr", resp: "urr", kind: "vowel" },
	{ ipa: "ʊr", resp: "uurr", kind: "vowel" },
	{ ipa: "ər", resp: "ər", kind: "vowel" },

	// Diphthongs/long vowels.
	{ ipa: "ɑː", resp: "ah", kind: "vowel" },
	{ ipa: "ɔː", resp: "aw", kind: "vowel" },
	{ ipa: "eɪ", resp: "ay", kind: "vowel" },
	{ ipa: "iː", resp: "ee", kind: "vowel" },
	{ ipa: "uː", resp: "oo", kind: "vowel" },
	{ ipa: "juː", resp: "ew", kind: "vowel" },
	{ ipa: "ju", resp: "ew", kind: "vowel" },
	{ ipa: "aɪ", resp: "y", kind: "vowel" },
	{ ipa: "aʊ", resp: "ow", kind: "vowel" },
	{ ipa: "ɔɪ", resp: "oy", kind: "vowel" },
	{ ipa: "oʊ", resp: "oh", kind: "vowel" },
	{ ipa: "əʊ", resp: "oh", kind: "vowel" }, // common BrE GOAT notation

	// Short vowels.
	{ ipa: "æ", resp: "a", kind: "vowel" },
	{ ipa: "ɛ", resp: "e", kind: "vowel" },
	{ ipa: "ɪ", resp: "i", kind: "vowel" },
	{ ipa: "ɒ", resp: "o", kind: "vowel" },
	{ ipa: "ʌ", resp: "u", kind: "vowel" },
	{ ipa: "ʊ", resp: "uu", kind: "vowel" },
	{ ipa: "i", resp: "ee", kind: "vowel" },
	{ ipa: "u", resp: "oo", kind: "vowel" },
	{ ipa: "ə", resp: "ə", kind: "vowel" },

	// Consonant clusters/affricates.
	{ ipa: "tʃ", resp: "ch", kind: "consonant" },
	{ ipa: "dʒ", resp: "j", kind: "consonant" },
	{ ipa: "hw", resp: "wh", kind: "consonant" },
	{ ipa: "ŋk", resp: "nk", kind: "consonant" },

	// Single consonants.
	{ ipa: "ð", resp: "dh", kind: "consonant" },
	{ ipa: "θ", resp: "th", kind: "consonant" },
	{ ipa: "ʃ", resp: "sh", kind: "consonant" },
	{ ipa: "ʒ", resp: "zh", kind: "consonant" },
	{ ipa: "ɡ", resp: "g", kind: "consonant" },
	{ ipa: "g", resp: "g", kind: "consonant" },
	{ ipa: "ɹ", resp: "r", kind: "consonant" },
	{ ipa: "r", resp: "r", kind: "consonant" },
	{ ipa: "x", resp: "kh", kind: "consonant" },
	{ ipa: "ŋ", resp: "ng", kind: "consonant" },
	{ ipa: "b", resp: "b", kind: "consonant" },
	{ ipa: "d", resp: "d", kind: "consonant" },
	{ ipa: "f", resp: "f", kind: "consonant" },
	{ ipa: "h", resp: "h", kind: "consonant" },
	{ ipa: "k", resp: "k", kind: "consonant" },
	{ ipa: "l", resp: "l", kind: "consonant" },
	{ ipa: "m", resp: "m", kind: "consonant" },
	{ ipa: "n", resp: "n", kind: "consonant" },
	{ ipa: "p", resp: "p", kind: "consonant" },
	{ ipa: "s", resp: "s", kind: "consonant" },
	{ ipa: "t", resp: "t", kind: "consonant" },
	{ ipa: "v", resp: "v", kind: "consonant" },
	{ ipa: "w", resp: "w", kind: "consonant" },
	{ ipa: "j", resp: "y", kind: "consonant" },
	{ ipa: "z", resp: "z", kind: "consonant" },
] satisfies PhoneSpec[];

PHONE_SPECS.sort((a, b) => b.ipa.length - a.ipa.length);

const CHECKED_VOWELS = new Set(["æ", "ɛ", "ɪ", "ɒ", "ʌ", "ʊ"]);

/**
 * A small set of plausible English syllable onsets.
 * Used only for heuristic syllabification.
 */
const VALID_ONSETS = new Set([
	// Single consonants are handled separately.

	"pl", "pr", "bl", "br",
	"tr", "dr",
	"kl", "kr", "gl", "gr",
	"fl", "fr", "thr",
	"sh", "ch", "j",
	"sl", "sm", "sn", "sp", "st", "sk", "sw",
	"tw", "dw", "kw", "gw",
	"fy", "vy", "py", "by", "my", "ny", "ky", "gy", "hy",

	"spl", "spr", "str", "skr", "skw",
	"shr",
]);

function cleanIpa(input: string): string {
	return input
		.normalize("NFC")
		.trim()
		// Strip enclosing slashes/brackets.
		.replace(/^[/\[\]]+|[/\[\]]+$/g, "")
		// Remove optional parentheses often used in dictionaries.
		.replace(/[()]/g, "")
		// Remove tie bar.
		.replace(/\u0361/g, "")
		// Convert syllabic consonants to schwa + consonant.
		.replace(/([nlm])\u0329/g, "ə$1")
		// Common AmE rhotic vowel symbols.
		.replace(/ɚ/g, "ər")
		.replace(/ɝ/g, "ɜːr");
}

function tokenizeWord(word: string, options: Options): Phone[] {
	const keepUnknown = options.keepUnknown ?? true;
	const phones: Phone[] = [];

	let i = 0;
	let pendingStress: Stress | undefined;
	let pendingBreak = false;

	while (i < word.length) {
		const ch = word[i]!;

		if (ch === "ˈ") {
			pendingStress = "primary";
			pendingBreak = phones.length > 0;
			i++;
			continue;
		}

		if (ch === "ˌ") {
			pendingStress = "secondary";
			pendingBreak = phones.length > 0;
			i++;
			continue;
		}

		// Explicit IPA syllable boundary.
		if (ch === ".") {
			pendingBreak = phones.length > 0;
			i++;
			continue;
		}

		// Ignore common diacritics/length marks if they were not consumed
		// as part of a known symbol.
		if (/[\u0300-\u036fːˑ̆ʰʷʲ]/u.test(ch)) {
			i++;
			continue;
		}

		const spec = PHONE_SPECS.find((s) => word.startsWith(s.ipa, i));

		if (!spec) {
			if (!keepUnknown) {
				throw new Error(`Unknown IPA symbol near "${word.slice(i)}"`);
			}

			phones.push({
				ipa: ch,
				resp: ch,
				kind: "consonant",
				stress: pendingStress,
				breakBefore: pendingBreak,
			});

			pendingStress = undefined;
			pendingBreak = false;
			i++;
			continue;
		}

		phones.push({
			ipa: spec.ipa,
			resp: spec.resp,
			kind: spec.kind,
			stress: pendingStress,
			breakBefore: pendingBreak,
		});

		pendingStress = undefined;
		pendingBreak = false;
		i += spec.ipa.length;
	}

	return phones;
}

function isValidOnset(cluster: Phone[]): boolean {
	if (cluster.length === 0) return true;
	if (!cluster.every((p) => p.kind === "consonant")) return false;

	const key = cluster.map((p) => p.resp).join("");

	// Most single consonants can begin an English syllable, but /ŋ/ generally cannot.
	if (cluster.length === 1) {
		return key !== "ng" && key !== "nk";
	}

	return VALID_ONSETS.has(key);
}

function hasBreakBetween(breaks: Set<number>, fromExclusive: number, toInclusive: number): boolean {
	for (const b of breaks) {
		if (b > fromExclusive && b <= toInclusive) return true;
	}
	return false;
}

function syllabify(phones: Phone[]): Phone[][] {
	const breaks = new Set<number>();

	// Explicit breaks from IPA stress markers and dots.
	for (let i = 0; i < phones.length; i++) {
		if (phones[i]!.breakBefore && i > 0) breaks.add(i);
	}

	const vowels = phones
		.map((p, i) => ({ p, i }))
		.filter(({ p }) => p.kind === "vowel")
		.map(({ i }) => i);

	// Heuristic breaks between vowel nuclei.
	for (let vi = 0; vi < vowels.length - 1; vi++) {
		const v1 = vowels[vi]!;
		const v2 = vowels[vi + 1]!;

		if (hasBreakBetween(breaks, v1, v2)) continue;

		const clusterStart = v1 + 1;
		const clusterEnd = v2 - 1;
		const clusterLen = clusterEnd - clusterStart + 1;

		let breakAt: number;

		if (clusterLen <= 0) {
			// Hiatus: V.V
			breakAt = v2;
		} else if (clusterLen === 1) {
			const consonant = phones[clusterStart]!;
			const prevVowel = phones[v1]!;

			// Checked vowels usually keep the following consonant as coda:
			// panic -> PAN-ik, not PA-nik.
			//
			// But before a stressed vowel, aspirated /p t k/ often belong to the next syllable:
			// tattoo -> ta-TOO.
			const nextIsStressed = Boolean(phones[v2]!.stress);
			const isPtk = ["p", "t", "k"].includes(consonant.resp);

			if (CHECKED_VOWELS.has(prevVowel.ipa) && !(nextIsStressed && isPtk)) {
				breakAt = clusterStart + 1;
			} else {
				breakAt = clusterStart;
			}
		} else {
			// Maximal-onset-ish rule:
			// between vowels, assign the largest valid suffix as the next onset.
			// n+s -> n-s, s+t+r -> str.
			breakAt = clusterEnd + 1;

			for (let s = clusterStart; s <= clusterEnd; s++) {
				const suffix = phones.slice(s, clusterEnd + 1);
				if (isValidOnset(suffix)) {
					breakAt = s;
					break;
				}
			}
		}

		if (breakAt > 0 && breakAt < phones.length) {
			breaks.add(breakAt);
		}
	}

	const sortedBreaks = [...breaks].sort((a, b) => a - b);
	const syllables: Phone[][] = [];

	let start = 0;
	for (const b of sortedBreaks) {
		if (b > start) syllables.push(phones.slice(start, b));
		start = b;
	}
	if (start < phones.length) syllables.push(phones.slice(start));

	return syllables;
}

function formatSyllable(syllable: Phone[]): string {
	const stressed = syllable.some((p) => p.stress);
	let needsFinalSilentE = false;

	const parts = syllable.map((p, i) => {
		const prev = syllable[i - 1];
		const next = syllable[i + 1];

		// /aɪ/ is "eye" when syllable-initial or after /j/, otherwise "y".
		if (p.ipa === "aɪ") {
			const useEye = i === 0 || prev?.ipa === "j";
			if (!useEye && prev?.kind === "consonant" && next?.kind === "consonant") {
				needsFinalSilentE = true; // tight -> TYTE
			}
			return useEye ? "eye" : "y";
		}

		// /ju(ː)/ is "ew" after a consonant in the same syllable, otherwise "yoo".
		if (p.ipa === "juː" || p.ipa === "ju") {
			return i > 0 && prev?.kind === "consonant" ? "ew" : "yoo";
		}

		// /jʊər/ is "ure" after a consonant in the same syllable, otherwise "yoor".
		if (p.ipa === "jʊər") {
			return i > 0 && prev?.kind === "consonant" ? "ure" : "yoor";
		}

		// /tʃ/ after a vowel in the same syllable is "tch".
		if (p.ipa === "tʃ" && prev?.kind === "vowel") {
			return "tch";
		}

		// Syllable-final checked vowels use clarifying spellings.
		if (i === syllable.length - 1) {
			if (p.ipa === "ɛ") return "eh";
			if (p.ipa === "ɪ") return "ih";
			if (p.ipa === "ʌ") return "uh";
		}

		return p.resp;
	});

	let out = parts.join("");

	if (needsFinalSilentE && !out.endsWith("e")) {
		out += "e";
	}

	return stressed ? out.toUpperCase() : out;
}

function convertWord(word: string, options: Options): string {
	const phones = tokenizeWord(word, options);
	const syllables = syllabify(phones);
	return syllables.map(formatSyllable).join("-");
}

export function ipaToEnWikiRespelling(input: string, options: Options = {}): string {
	const cleaned = cleanIpa(input);

	// Preserve spaces between words.
	return cleaned
		.split(/(\s+)/)
		.map((part) => {
			if (/^\s+$/.test(part)) return " ";
			if (!part) return "";
			return convertWord(part, options);
		})
		.join("")
		.trim();
}
