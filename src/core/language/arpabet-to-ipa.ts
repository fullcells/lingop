// via gpt5.5

type Stress = 0 | 1 | 2;

export interface ArpabetToIpaOptions {
	/**
	 * AA varies by accent. The table gives "ɑ~ɒ"; defaulting to "ɑ" keeps
	 * the output as a normal IPA transcription rather than a variant note.
	 */
	aa?: string;

	/**
	 * If true, converts AH0 to ə. Default false to follow the supplied table:
	 * AH -> ʌ regardless of stress.
	 */
	reduceAh0ToSchwa?: boolean;

	/**
	 * If true, converts ER0 to ɚ. Default false to follow the supplied table:
	 * ER -> ɝ regardless of stress.
	 */
	unstressedErToRColoredSchwa?: boolean;

	/**
	 * What to do with unknown ARPABET tokens.
	 */
	unknown?: "throw" | "keep";
}

/**
 * Converts one CMU-style ARPABET pronunciation to IPA.
 *
 * Important stress rule:
 * ARPABET writes stress on the vowel, e.g. AH0 B AW1 T.
 * IPA stress marks go before the stressed syllable, not before the vowel.
 * So this function places ˈ/ˌ before the syllable onset using a maximal-onset
 * heuristic:
 *
 *   AH0 B AW1 T -> ʌˈbaʊt, not ʌbˈaʊt
 *   K AH0 M P Y UW1 T ER0 -> kʌmˈpjutɝ, not kʌmpjˈutɝ
 */
export function arpabetToIPA(
	input: string | string[],
	options: ArpabetToIpaOptions = {}
): string {
	// OVERRIDES
	if (typeof input === 'string' && input == "S AA1 R IY0") return "ˈsɒɹi"; // Default is: "ˈsɒɹi" - because ARPABET doesn't differentiate /ɑ/~/ɒ/ 
	
	// Continue:
	const unknown = options.unknown ?? "throw";

	const vowels: Record<string, string> = {
		AA: options.aa ?? "ɑ",
		AE: "æ",
		AH: "ʌ",
		AO: "ɔ",
		AW: "aʊ",
		AY: "aɪ",
		EH: "ɛ",
		ER: "ɝ",
		EY: "eɪ",
		IH: "ɪ",
		IY: "i",
		OW: "oʊ",
		OY: "ɔɪ",
		UH: "ʊ",
		UW: "u",
	};

	const consonants: Record<string, string> = {
		B: "b",
		CH: "tʃ",
		D: "d",
		DH: "ð",
		EL: "l̩",
		EM: "m̩",
		EN: "n̩",
		F: "f",
		G: "ɡ",
		HH: "h",
		JH: "dʒ",
		K: "k",
		L: "l",
		M: "m",
		N: "n",
		NG: "ŋ",
		P: "p",
		R: "ɹ",
		S: "s",
		SH: "ʃ",
		T: "t",
		TH: "θ",
		V: "v",
		W: "w",
		WH: "ʍ",
		Y: "j",
		Z: "z",
		ZH: "ʒ",
	};

	interface Phone {
		raw: string;
		base: string;
		stress?: Stress | undefined;
		ipa: string;
		isVowel: boolean;
		isNucleus: boolean;
		isConsonant: boolean;
	}

	const tokens = Array.isArray(input)
		? input
		: input.trim().split(/\s+/).filter(Boolean);

	const syllabicConsonants = new Set(["EL", "EM", "EN"]);

	const phones: Phone[] = tokens.map((rawToken) => {
		const token = rawToken.toUpperCase();
		const match = token.match(/^([A-Z]+)([012])?$/);

		if (!match) {
			if (unknown === "keep") {
				return {
					raw: rawToken,
					base: token,
					ipa: rawToken,
					isVowel: false,
					isNucleus: false,
					isConsonant: false,
				};
			}
			throw new Error(`Invalid ARPABET token: ${rawToken}`);
		}

		const base = match[1]!;
		const stress =
			match[2] === undefined ? undefined : (Number(match[2]) as Stress);

		const isVowel = Object.prototype.hasOwnProperty.call(vowels, base);
		const isConsonant = Object.prototype.hasOwnProperty.call(consonants, base);

		if (!isVowel && !isConsonant) {
			if (unknown === "keep") {
				return {
					raw: rawToken,
					base,
					stress,
					ipa: rawToken,
					isVowel: false,
					isNucleus: false,
					isConsonant: false,
				};
			}
			throw new Error(`Unknown ARPABET token: ${rawToken}`);
		}

		if (stress !== undefined && !isVowel) {
			throw new Error(`Stress digit found on non-vowel token: ${rawToken}`);
		}

		let ipa: string;
		if (isVowel) {
			if (base === "AH" && stress === 0 && options.reduceAh0ToSchwa) {
				ipa = "ə";
			} else if (
				base === "ER" &&
				stress === 0 &&
				options.unstressedErToRColoredSchwa
			) {
				ipa = "ɚ";
			} else {
				ipa = vowels[base]!;
			}
		} else {
			ipa = consonants[base]!;
		}

		return {
			raw: rawToken,
			base,
			stress,
			ipa,
			isVowel,
			isNucleus: isVowel || syllabicConsonants.has(base),
			isConsonant,
		};
	});

	const stressMarksBefore = Array.from({ length: phones.length + 1 }, () => "");

	for (let i = 0; i < phones.length; i++) {
		const phone = phones[i]!;

		if (phone.stress === 1 || phone.stress === 2) {
			const mark = phone.stress === 1 ? "ˈ" : "ˌ";
			const syllableStart = findStressedSyllableStart(phones, i);
			stressMarksBefore[syllableStart] =
				(stressMarksBefore[syllableStart] ?? "") + mark;
		}
	}

	let out = "";
	for (let i = 0; i < phones.length; i++) {
		out += (stressMarksBefore[i] ?? "") + phones[i]!.ipa;
	}
	out += stressMarksBefore[phones.length];

	return out;
}

/**
 * Finds where the IPA stress mark should be inserted for the syllable whose
 * nucleus is at vowelIndex.
 */
function findStressedSyllableStart(
	phones: Array<{
		base: string;
		isNucleus: boolean;
		isConsonant: boolean;
	}>,
	vowelIndex: number
): number {
	let previousNucleus = -1;

	for (let i = vowelIndex - 1; i >= 0; i--) {
		if (phones[i]!.isNucleus) {
			previousNucleus = i;
			break;
		}
	}

	// First syllable: stress goes before the initial onset.
	if (previousNucleus === -1) return 0;

	const cluster = phones.slice(previousNucleus + 1, vowelIndex);

	if (cluster.length === 0) return vowelIndex;

	const onsetLen = longestValidEnglishOnsetLength(cluster.map((p) => p.base));

	return vowelIndex - onsetLen;
}

/**
 * Longest valid suffix of an intervocalic consonant cluster, using a practical
 * English maximal-onset heuristic.
 *
 * Example:
 *   M P Y before UW1 -> onset P Y -> stress before P
 *   N S T before IH1 -> onset S T -> stress before S
 *   B S T R before AE1 -> onset S T R -> stress before S
 */
function longestValidEnglishOnsetLength(cluster: string[]): number {
	const max = Math.min(3, cluster.length);

	for (let len = max; len >= 1; len--) {
		const suffix = cluster.slice(cluster.length - len);
		if (isValidEnglishOnset(suffix)) return len;
	}

	return 0;
}

function isValidEnglishOnset(onset: string[]): boolean {
	const key = onset.join(" ");

	// English does not normally allow initial /ŋ/, and EL/EM/EN are syllabic.
	const singleOnsets = new Set([
		"B",
		"CH",
		"D",
		"DH",
		"F",
		"G",
		"HH",
		"JH",
		"K",
		"L",
		"M",
		"N",
		"P",
		"R",
		"S",
		"SH",
		"T",
		"TH",
		"V",
		"W",
		"WH",
		"Y",
		"Z",
		"ZH",
	]);

	const twoOnsets = new Set([
		// stop/fricative + liquid/glide
		"B L",
		"B R",
		"D R",
		"D W",
		"F L",
		"F R",
		"G L",
		"G R",
		"G W",
		"K L",
		"K R",
		"K W",
		"P L",
		"P R",
		"T R",
		"T W",
		"TH R",
		"TH W",
		"SH R",

		// yod clusters, useful for CMU forms like K AH0 M P Y UW1 T ER0
		"B Y",
		"F Y",
		"G Y",
		"HH Y",
		"K Y",
		"M Y",
		"P Y",
		"T Y",
		"V Y",

		// s-clusters
		"S K",
		"S L",
		"S M",
		"S N",
		"S P",
		"S T",
		"S W",
	]);

	const threeOnsets = new Set([
		"S K L",
		"S K R",
		"S K W",
		"S K Y",
		"S P L",
		"S P R",
		"S P Y",
		"S T R",
		"S T Y",
	]);

	if (onset.length === 1) return singleOnsets.has(key);
	if (onset.length === 2) return twoOnsets.has(key);
	if (onset.length === 3) return threeOnsets.has(key);
	return false;
}
