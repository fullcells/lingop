// Jyutping to IPA converter

const INITIALS: Record<string, string> = {
	'gw': 'kʷ',
	'kw': 'kʷʰ',
	'ng': 'ŋ',
	'b': 'p',
	'p': 'pʰ',
	'm': 'm',
	'f': 'f',
	'd': 't',
	't': 'tʰ',
	'n': 'n',
	'l': 'l',
	'g': 'k',
	'k': 'kʰ',
	'h': 'h',
	'w': 'w',
	'z': 'ts',
	'c': 'tsʰ',
	's': 's',
	'j': 'j',
};

const FINALS: Record<string, string> = {
	// aa finals
	'aai':  'aːi̯',
	'aau':  'aːu̯',
	'aam':  'aːm',
	'aan':  'aːn',
	'aang': 'aːŋ',
	'aap':  'aːp̚',
	'aat':  'aːt̚',
	'aak':  'aːk̚',
	'aa':   'aː',
	// a finals
	'ai':   'ɐi̯',
	'au':   'ɐu̯',
	'am':   'ɐm',
	'an':   'ɐn',
	'ang':  'ɐŋ',
	'ap':   'ɐp̚',
	'at':   'ɐt̚',
	'ak':   'ɐk̚',
	'a':    'ɐ',
	// e finals
	'ei':   'ei̯',
	'eu':   'ɛːu̯',
	'em':   'ɛːm',
	'eng':  'ɛːŋ',
	'ep':   'ɛːp̚',
	'et':   'ɛːt̚',
	'ek':   'ɛːk̚',
	'e':    'ɛː',
	// i finals
	'iu':   'iːu̯',
	'im':   'iːm',
	'in':   'iːn',
	'ing':  'ɪŋ',
	'ip':   'iːp̚',
	'it':   'iːt̚',
	'ik':   'ɪk',
	'i':    'iː',
	// o finals
	'oi':   'ɔːy̯',
	'ou':   'ou̯',
	'on':   'ɔːn',
	'ong':  'ɔːŋ',
	'ot':   'ɔːt̚',
	'ok':   'ɔːk̚',
	'o':    'ɔː',
	// u finals
	'ui':   'uːy̯',
	'un':   'uːn',
	'ung':  'ʊŋ',
	'ut':   'uːt̚',
	'uk':   'ʊk',
	'u':    'uː',
	// eo/eoi/eon/eot finals
	'eoi':  'ɵy̯',
	'eon':  'ɵn',
	'eot':  'ɵt̚',
	// oe finals
	'oeng': 'œːŋ',
	'oet':  'œːt̚',
	'oek':  'œːk̚',
	'oe':   'œː',
	// yu finals
	'yun':  'yːn',
	'yut':  'yːt̚',
	'yu':   'yː',
	// syllabic nasals
	'ng':   'ŋ̍',
	'm':    'm̩',
};

const IPA_TONES: Record<string, string> = {
	'1': '˥',
	'2': '˧˥',
	'3': '˧',
	'4': '˨˩',
	'5': '˩˧',
	'6': '˨',
};

const SLWONG_TONES: Record<string, string> = {
	'1': '\'',
	'2': '´',
	'3': '¯',
	'4': 'ˌ',
	'5': 'ˏ',
	'6': '_',
};

export type ToneStyle = 'ipa' | 'numbers' | 'slwong';

/**
 * Convert a single Jyutping syllable (e.g. "cam1") to IPA (e.g. "tsʰɐm˥")
 */
function syllableToIPA(syllable: string, toneStyle: ToneStyle): string {
	const lower = syllable.toLowerCase();

	let body = lower;
	let toneNum = '';
	if (/[1-6]$/.test(lower)) {
		toneNum = lower.slice(-1);
		body = lower.slice(0, -1);
	}

	const toneMarker = (prefix: boolean): string => {
		if (!toneNum) return '';
		switch (toneStyle) {
			case 'ipa':     return IPA_TONES[toneNum] ?? toneNum;
			case 'numbers': return toneNum;
			case 'slwong':  return prefix ? (SLWONG_TONES[toneNum] ?? toneNum) : '';
		}
	};

	// Syllabic nasals
	if (body === 'm' || body === 'ng') {
		const phoneme = FINALS[body] ?? body;
		return toneStyle === 'slwong'
			? toneMarker(true) + phoneme
			: phoneme + toneMarker(false);
	}

	// Match initial (longest first)
	let initial = '';
	let finalStr = body;

	const sortedInitials = Object.keys(INITIALS).sort((a, b) => b.length - a.length);
	for (const init of sortedInitials) {
		if (body.startsWith(init)) {
			const rest = body.slice(init.length);
			if (rest.length === 0 || FINALS[rest] !== undefined) {
				initial = init;
				finalStr = rest;
				break;
			}
		}
	}

	const initialIPA = initial ? (INITIALS[initial] ?? initial) : '';
	const finalIPA   = finalStr ? (FINALS[finalStr] ?? finalStr) : '';
	const phonemes   = initialIPA + finalIPA;

	return toneStyle === 'slwong'
		? toneMarker(true) + phonemes
		: phonemes + toneMarker(false);
}


/**
 * Convert a string of space-separated Jyutping syllables to IPA.
 * e.g. "cam1 zi2" → "tsʰɐm˥ tsiː˧˥"
 */
export function jyutpingToIPA(jyutping: string, toneStyle: ToneStyle = 'ipa'): string {
	return jyutping
		.trim()
		.split(/\s+/)
		.map(s => syllableToIPA(s, toneStyle))
		.join(' ');
}

// // --- Demo ---
// const tests = ['cam1', 'nei5', 'hou2', 'gong2', 'zung1', 'jat6', 'ng4', 'gwok3'];

// for (const t of tests) {
// 	console.log(`${t}`);
// 	console.log(`  ipa:     ${jyutpingToIPA(t, 'ipa')}`);
// 	console.log(`  numbers: ${jyutpingToIPA(t, 'numbers')}`);
// 	console.log(`  slwong:  ${jyutpingToIPA(t, 'slwong')}`);
// }
