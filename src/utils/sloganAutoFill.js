const HINDI_ONLY_RE = /[\u0900-\u097F]/;
const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;

const PHRASE_RULES = [
  { pattern: /जय\s*श्री\s*राम/g, replacement: 'Victory to Lord Ram', confidence: 1 },
  { pattern: /जय\s*श्रीराम/g, replacement: 'Victory to Lord Ram', confidence: 1 },
  { pattern: /जय\s*सिया\s*राम/g, replacement: 'Victory to Sita Ram', confidence: 1 },
  { pattern: /जय\s*हनुमान/g, replacement: 'Victory to Hanuman', confidence: 1 },
  { pattern: /राम\s*नाम\s*सत्य\s*है/g, replacement: "Ram's name is truth", confidence: 1 },
  { pattern: /राम\s*नाम\s*की\s*महिमा/g, replacement: "The glory of Ram's name", confidence: 1 },
  { pattern: /भक्ति\s*में\s*शक्ति/g, replacement: 'There is power in devotion', confidence: 1 },
  { pattern: /सत्य\s*ही\s*ईश्वर\s*है/g, replacement: 'Truth itself is God', confidence: 1 },
  { pattern: /सत्संग\s*ही\s*सच्चा\s*सुख\s*है/g, replacement: 'True satsang is true happiness', confidence: 1 },
  { pattern: /राम\s*भक्ति/g, replacement: 'Devotion to Ram', confidence: 0.95 },
  { pattern: /हनुमान\s*भक्ति/g, replacement: 'Devotion to Hanuman', confidence: 0.95 },
  { pattern: /सीता\s*राम/g, replacement: 'Sita Ram', confidence: 0.95 },
];

const WORD_MAP = new Map([
  ['जय', 'victory'],
  ['श्री', 'lord'],
  ['राम', 'Ram'],
  ['सीता', 'Sita'],
  ['हनुमान', 'Hanuman'],
  ['भक्ति', 'devotion'],
  ['भक्त', 'devotee'],
  ['भजन', 'devotional chant'],
  ['नाम', 'name'],
  ['सत्य', 'truth'],
  ['सच्चा', 'true'],
  ['सदा', 'always'],
  ['धर्म', 'righteousness'],
  ['प्रेम', 'love'],
  ['कृपा', 'grace'],
  ['शरण', 'refuge'],
  ['प्रभु', 'Lord'],
  ['ईश्वर', 'God'],
  ['मन', 'mind'],
  ['शांति', 'peace'],
  ['आशीर्वाद', 'blessings'],
  ['मंगल', 'auspicious'],
  ['जीवन', 'life'],
  ['सफल', 'successful'],
  ['सुख', 'happiness'],
  ['दुख', 'sorrow'],
  ['मुक्ति', 'liberation'],
  ['आनंद', 'joy'],
  ['है', 'is'],
  ['में', 'in'],
  ['का', 'of'],
  ['की', 'of'],
  ['के', 'of'],
  ['और', 'and'],
  ['से', 'from'],
  ['पर', 'on'],
  ['लिए', 'for'],
  ['हम', 'we'],
  ['सब', 'all'],
  ['यह', 'this'],
  ['वही', 'that'],
  ['बनें', 'become'],
  ['रहे', 'remain'],
  ['करें', 'do'],
  ['जप', 'chant'],
  ['जपें', 'chant'],
  ['आरती', 'aarti'],
  ['सत्संग', 'satsang'],
  ['संत', 'saint'],
  ['गुरु', 'guru'],
  ['श्रीराम', 'Ram'],
]);

const INDEPENDENT_VOWELS = {
  'अ': 'a',
  'आ': 'aa',
  'इ': 'i',
  'ई': 'ee',
  'उ': 'u',
  'ऊ': 'oo',
  'ऋ': 'ri',
  'ॠ': 'rri',
  'ऌ': 'li',
  'ॡ': 'lli',
  'ए': 'e',
  'ऐ': 'ai',
  'ओ': 'o',
  'औ': 'au',
  'ऑ': 'o',
};

const MATRAS = {
  'ा': 'a',
  'ि': 'i',
  'ी': 'ee',
  'ु': 'u',
  'ू': 'oo',
  'ृ': 'ri',
  'ॄ': 'rri',
  'ॢ': 'li',
  'ॣ': 'lli',
  'े': 'e',
  'ै': 'ai',
  'ो': 'o',
  'ौ': 'au',
  'ॅ': 'e',
  'ॉ': 'o',
};

const CONSONANTS = {
  'क': 'k',
  'ख': 'kh',
  'ग': 'g',
  'घ': 'gh',
  'ङ': 'ng',
  'च': 'ch',
  'छ': 'chh',
  'ज': 'j',
  'झ': 'jh',
  'ञ': 'ny',
  'ट': 't',
  'ठ': 'th',
  'ड': 'd',
  'ढ': 'dh',
  'ण': 'n',
  'त': 't',
  'थ': 'th',
  'द': 'd',
  'ध': 'dh',
  'न': 'n',
  'प': 'p',
  'फ': 'ph',
  'ब': 'b',
  'भ': 'bh',
  'म': 'm',
  'य': 'y',
  'र': 'r',
  'ल': 'l',
  'व': 'v',
  'श': 'sh',
  'ष': 'sh',
  'स': 's',
  'ह': 'h',
  'ळ': 'l',
  'क्ष': 'ksh',
  'त्र': 'tr',
  'ज्ञ': 'gy',
  'ड़': 'r',
  'ढ़': 'rh',
  'फ़': 'f',
  'ज़': 'z',
  'ऩ': 'n',
  'ऱ': 'r',
  'य़': 'y',
};

const PUNCTUATION_MAP = {
  '।': '.',
  '॥': '.',
  '—': '-',
  '–': '-',
};

const VIRAMA = '्';
const ANUSVARA = 'ं';
const VISARGA = 'ः';
const NUKTA = '़';

const normalizeHindiText = (text) => String(text || '')
  .normalize('NFC')
  .replace(ZERO_WIDTH_RE, '')
  .replace(/\s+/g, ' ')
  .trim();

const isHindiText = (text) => HINDI_ONLY_RE.test(String(text || ''));

const capitalizeSentence = (text) => {
  const trimmed = String(text || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const applyPhraseRules = (input) => {
  let output = input;
  let matched = null;
  let bestConfidence = 0;

  for (const rule of PHRASE_RULES) {
    if (rule.pattern.test(output)) {
      output = output.replace(rule.pattern, rule.replacement);
      if (rule.confidence > bestConfidence) {
        bestConfidence = rule.confidence;
        matched = rule.replacement;
      }
      rule.pattern.lastIndex = 0;
    }
  }

  return { output, matched, confidence: bestConfidence };
};

const transliterateToken = (token) => {
  const chars = Array.from(String(token || '').normalize('NFC'));
  let result = '';

  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];

    if (PUNCTUATION_MAP[char]) {
      result += PUNCTUATION_MAP[char];
      continue;
    }

    if (char === ANUSVARA) {
      result += 'n';
      continue;
    }

    if (char === VISARGA) {
      result += 'h';
      continue;
    }

    if (char === NUKTA || char === VIRAMA) {
      continue;
    }

    if (INDEPENDENT_VOWELS[char]) {
      result += INDEPENDENT_VOWELS[char];
      continue;
    }

    if (CONSONANTS[char]) {
      const next = chars[i + 1];
      const afterNext = chars[i + 2];

      if (next === VIRAMA) {
        result += CONSONANTS[char];
        i += 1;
        continue;
      }

      if (MATRAS[next]) {
        result += CONSONANTS[char] + MATRAS[next];
        i += 1;
        continue;
      }

      if (next === ANUSVARA || next === VISARGA) {
        result += CONSONANTS[char] + 'a';
        continue;
      }

      if (afterNext === VIRAMA && CONSONANTS[next]) {
        result += CONSONANTS[char];
        continue;
      }

      result += CONSONANTS[char] + 'a';
      continue;
    }

    result += char;
  }

  return result
    .replace(/a{2,}/g, 'a')
    .replace(/\s+/g, ' ')
    .trim();
};

const transliterateHindiToEnglish = (text) => {
  const normalized = normalizeHindiText(text);
  if (!normalized) return '';

  const tokens = normalized.split(/(\s+|[.,!?;:])/);
  const output = tokens.map((token) => {
    if (!token || /^\s+$/.test(token)) return token;
    if (/^[.,!?;:]$/.test(token)) return token;

    const lower = token.toLowerCase();
    if (WORD_MAP.has(token)) return WORD_MAP.get(token);
    if (WORD_MAP.has(lower)) return WORD_MAP.get(lower);
    return transliterateToken(token);
  }).join('');

  return capitalizeSentence(
    output
      .replace(/\s+([.,!?;:])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
  );
};

const autoFillEnglishSlogan = (hindiText, options = {}) => {
  const normalized = normalizeHindiText(hindiText);
  if (!normalized) {
    return {
      input: '',
      normalizedInput: '',
      english: '',
      matchedPhrase: null,
      source: 'empty',
      confidence: 0,
    };
  }

  const phraseResult = applyPhraseRules(normalized);
  const translatedWords = phraseResult.output
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      const mapped = WORD_MAP.get(word) || WORD_MAP.get(word.toLowerCase());
      if (mapped) return mapped;
      if (isHindiText(word)) return transliterateToken(word);
      return word;
    })
    .join(' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  const transliterated = transliterateHindiToEnglish(normalized);
  const preferred = options.preferMeaning === false
    ? transliterated
    : capitalizeSentence(translatedWords || transliterated);

  const english = preferred || transliterated;
  const source = phraseResult.matched
    ? 'phrase'
    : (translatedWords !== transliterated ? 'hybrid' : 'transliteration');

  return {
    input: String(hindiText || ''),
    normalizedInput: normalized,
    english,
    matchedPhrase: phraseResult.matched,
    source,
    confidence: phraseResult.confidence || (source === 'transliteration' ? 0.35 : 0.7),
  };
};

export {
  autoFillEnglishSlogan,
  transliterateHindiToEnglish,
  normalizeHindiText,
  isHindiText,
};

export default {
  autoFillEnglishSlogan,
  transliterateHindiToEnglish,
  normalizeHindiText,
  isHindiText,
};
