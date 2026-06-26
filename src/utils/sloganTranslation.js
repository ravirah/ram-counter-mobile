export const normalizeSloganText = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

const EXACT_PHRASES = new Map([
  ['श्री राम नाम बैंक से शांति और आनंद मिलता है', 'Chanting Shri Ram Nam Bank brings peace and joy'],
  ['रोज राम की भक्ति करो जीवन सफल बनाओ', 'Worship Ram daily and make life successful'],
  ['राम नाम सबसे बड़ी शक्ति है', 'The name of Ram is the greatest strength'],
  ['निरंतर भक्ति ही सच्ची पूजा है', 'Constant devotion is true worship'],
  ['राम नाम सत्य है सब सत्य है', 'The name of Ram is truth, all is truth'],
  ['मन की पवित्रता से सुख मिलता है', 'Happiness comes from purity of mind'],
  ['राम भक्ति से मोक्ष मिलता है', 'Salvation comes through devotion to Ram'],
  ['रोज राम नाम जपो आत्मा को शांति दो', 'Chant Ram daily and calm your soul'],
  ['जय श्री राम', 'Victory to Lord Ram'],
  ['श्री राम', 'Lord Ram'],
  ['राम राम', 'Ram Ram'],
]);

const PHRASE_REPLACEMENTS = [
  [/जय श्री राम/g, 'Victory to Lord Ram'],
  [/श्री राम/g, 'Lord Ram'],
  [/राम नाम सत्य है/g, 'The name of Ram is truth'],
  [/राम नाम/g, 'the name of Ram'],
  [/राम भक्ति/g, 'devotion to Ram'],
  [/राम की भक्ति/g, 'devotion to Ram'],
  [/सच्ची पूजा/g, 'true worship'],
  [/मन की पवित्रता/g, 'purity of mind'],
  [/आत्मा को शांति दो/g, 'calm your soul'],
  [/जीवन सफल बनाओ/g, 'make life successful'],
  [/सबसे बड़ी शक्ति/g, 'the greatest strength'],
  [/शांति और आनंद/g, 'peace and joy'],
  [/मोक्ष/g, 'salvation'],
  [/मुक्ति/g, 'liberation'],
  [/भक्ति/g, 'devotion'],
  [/पूजा/g, 'worship'],
  [/शक्ति/g, 'strength'],
  [/शांति/g, 'peace'],
  [/आनंद/g, 'joy'],
  [/सुख/g, 'happiness'],
  [/सत्य/g, 'truth'],
  [/पवित्रता/g, 'purity'],
  [/आत्मा/g, 'soul'],
  [/मन/g, 'mind'],
  [/जीवन/g, 'life'],
  [/रोज/g, 'daily'],
  [/नाम जपो/g, 'chant the name'],
  [/जपो/g, 'chant'],
  [/करो/g, 'practice'],
  [/मिलता है/g, 'is found'],
  [/है/g, 'is'],
  [/से/g, 'through'],
];

const WORD_MAP = new Map([
  ['राम', 'Ram'],
  ['श्री', 'Shri'],
  ['जय', 'Victory'],
  ['नाम', 'name'],
  ['भक्ति', 'devotion'],
  ['पूजा', 'worship'],
  ['शक्ति', 'strength'],
  ['शांति', 'peace'],
  ['आनंद', 'joy'],
  ['सुख', 'happiness'],
  ['जीवन', 'life'],
  ['सफल', 'successful'],
  ['सत्य', 'truth'],
  ['मोक्ष', 'salvation'],
  ['मुक्ति', 'liberation'],
  ['मन', 'mind'],
  ['पवित्रता', 'purity'],
  ['आत्मा', 'soul'],
  ['रोज', 'daily'],
  ['जपो', 'chant'],
  ['करो', 'practice'],
  ['से', 'through'],
  ['मिलता', 'comes'],
  ['है', 'is'],
  ['और', 'and'],
  ['सब', 'all'],
  ['बड़ी', 'great'],
  ['सबसे', 'greatest'],
]);

const VOWEL_SIGNS = {
  'ा': 'a',
  'ि': 'i',
  'ी': 'ee',
  'ु': 'u',
  'ू': 'oo',
  'े': 'e',
  'ै': 'ai',
  'ो': 'o',
  'ौ': 'au',
  'ृ': 'ri',
  'ं': 'n',
  'ँ': 'n',
  'ः': 'h',
};

const INDEPENDENT_VOWELS = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
};

const CONSONANTS = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'ळ': 'l', 'क्ष': 'ksh', 'ज्ञ': 'gy',
};

const DEVANAGARI_WORD = /[\u0900-\u097F]+/g;
const PUNCT_OR_SPACE = /^\s+|[.,!?;:'"()\-]+$/;

const capitalizeSentence = (value) => value
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);

export const transliterateHindiWord = (word = '') => {
  let result = '';
  const chars = Array.from(word);

  for (let i = 0; i < chars.length; i += 1) {
    const current = chars[i];
    const next = chars[i + 1];

    if (INDEPENDENT_VOWELS[current]) {
      result += INDEPENDENT_VOWELS[current];
      continue;
    }

    const pair = `${current}${next || ''}`;
    if (CONSONANTS[pair]) {
      result += CONSONANTS[pair];
      i += 1;
      continue;
    }

    if (CONSONANTS[current]) {
      const base = CONSONANTS[current];
      if (next === '्') {
        result += base;
        i += 1;
        continue;
      }
      if (next && VOWEL_SIGNS[next]) {
        result += base + VOWEL_SIGNS[next];
        i += 1;
        continue;
      }
      result += `${base}a`;
      continue;
    }

    if (VOWEL_SIGNS[current]) {
      result += VOWEL_SIGNS[current];
      continue;
    }

    result += current;
  }

  return result
    .replace(/aa/g, 'a')
    .replace(/ii/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/\bshri\b/gi, 'Shri');
};

export const buildEnglishSlogan = (hindiText = '') => {
  const normalized = normalizeSloganText(hindiText);
  if (!normalized) return '';

  if (EXACT_PHRASES.has(normalized)) {
    return EXACT_PHRASES.get(normalized);
  }

  let translated = normalized;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    translated = translated.replace(pattern, replacement);
  }

  translated = translated.replace(DEVANAGARI_WORD, (word) => WORD_MAP.get(word) || transliterateHindiWord(word));
  translated = translated.replace(/\s+([,.;!?])/g, '$1');

  if (!/[A-Za-z]/.test(translated)) {
    translated = transliterateHindiWord(normalized);
  }

  return capitalizeSentence(translated);
};

export default buildEnglishSlogan;

export const suggestEnglishSlogan = (hindiText = '') => buildEnglishSlogan(hindiText);

export const shouldReplaceWithAutoEnglish = (currentEnglish = '', lastAutoEnglish = '') => {
  const current = normalizeSloganText(currentEnglish);
  const autoFilled = normalizeSloganText(lastAutoEnglish);
  return !current || current === autoFilled;
};



