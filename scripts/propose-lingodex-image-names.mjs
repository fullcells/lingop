import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createJiti } from "jiti";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourcePath = "src/content/lingodex.ts";
const sourceRevision = "568dab8f27b41bd807ec8a642eaf9f5716e77571";
const outputDir = path.join(root, "docs/image-names");
const numbers = [1, 2, 3, 4, 5];

export async function loadLegacySource() {
  const source = execFileSync("git", ["show", `${sourceRevision}:${sourcePath}`], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  const data = await createJiti(import.meta.url).evalModule(source, {
    filename: path.join(root, sourcePath),
    forceTranspile: true,
  });
  return { source, ...data };
}
// Avoid locale-dependent ordering, randomness, NLP services, and generated dist data.
export const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function normalize(text) {
  return text.normalize("NFKC").toLowerCase().replace(/[‘’]/g, "'")
    .replace(/\bcan't\b/g, "can not").replace(/\bcannot\b/g, "can not")
    .replace(/\bwon't\b/g, "will not").replace(/n't\b/g, " not")
    .replace(/\b(it|he|she|there|that|what)'s\b/g, "$1 is")
    .replace(/\b(i)'m\b/g, "$1 am").replace(/'re\b/g, " are")
    .replace(/'ll\b/g, " will").replace(/'ve\b/g, " have")
    .replace(/\bexcercising\b/g, "exercising")
    .replace(/\bfourty\b/g, "forty")
    .replace(/\bballon\b/g, "balloon").replace(/\bdeparing\b/g, "departing")
    .replace(/\+/g, " plus ").replace(/=/g, " equals ").replace(/%/g, " percent ")
    .replace(/\bice[- ]?cream\b/g, "ice cream")
    .replace(/\bboard[- ]?game\b/g, "board game")
    .replace(/\bfirestation\b/g, "fire station")
    .replace(/\bcolored?\b/g, "")
    .replace(/'s\b/g, "").replace(/s'\b/g, "s")
    .replace(/[-_]/g, " ").replace(/[^\p{L}\p{N}\s.:]/gu, " ")
    .replace(/(?<!\d)[.:]|[.:](?!\d)/g, " ")
    .replace(/\s+/g, " ").trim();
}

// Keep relations, quantities, negation, adjectives, and adverbs. This is deliberately
// smaller than a search-engine stopword list: "not", "before", "too", etc. matter.
const filler = new Set("a an the is are am was were be been being do does did this that these those it its his her their my your our there please".split(" "));
const subjectPronouns = { he: "person", she: "person", they: "people", we: "people", i: "person", you: "person" };

export function compact(text, { dropSubject = false } = {}) {
  const words = normalize(text)
    .replace(/\bneed to buy\b/g, "need")
    .replace(/\bor else (?:we|they|he|she|i|you) will\b/g, "or")
    .replace(/\bforgot where (?:she|he) put (.+?) and now (?:she|he) can not find\b/g, "forgot $1 can not find")
    .split(" ");
  if (subjectPronouns[words[0]]) words[0] = dropSubject ? "" : subjectPronouns[words[0]];
  return words.filter(w => w && !filler.has(w)).join(" ");
}

function join(...parts) {
  // Remove overlapping phrase boundaries, not repeated nouns with different roles.
  const result = [];
  for (const part of parts.filter(Boolean)) {
    const words = part.split(" ");
    let overlap = Math.min(result.length, words.length);
    while (overlap && result.slice(-overlap).join(" ") !== words.slice(0, overlap).join(" ")) overlap--;
    result.push(...words.slice(overlap));
  }
  return result.join(" ");
}

function countName(answer, noun) {
  const a = compact(answer);
  const n = compact(noun);
  const singular = word => word.replace(/s$/, "");
  return singular(a.split(" ").at(-1)) === singular(n.split(" ").at(-1)) ? a : join(a, n);
}

function predicate(subject, action, answer, context = "") {
  const qSubject = compact(subject);
  const aSubject = normalize(answer).match(/^(he|she|they|we|i|you)\b/)?.[1];
  const resolvedSubject = /^(person|child|people)$/.test(qSubject) && aSubject
    ? qSubject === "child" && /^(he|she)$/.test(aSubject) ? aSubject === "he" ? "boy" : "girl" : subjectPronouns[aSubject]
    : qSubject;
  const a = compact(answer, { dropSubject: Boolean(qSubject) });
  const p = compact(action);
  // A complete answer often supplies the action already.
  const body = p && (a === p || a.startsWith(p + " ")) ? a : join(p, a);
  const labelSubject = body === resolvedSubject || body.startsWith(resolvedSubject + " ") ? "" : resolvedSubject;
  const contextWords = compact(context);
  return join(labelSubject, body, contextWords && !(" " + body + " ").includes(" " + contextWords + " ") ? contextWords : "");
}

// Explicit templates for educational questions whose wording is not a scene
// description. Each fixed word comes from the question; {a} is its correct answer.
// These are question-level rules, never image-specific or manually assigned names.
const questionTemplates = new Map(Object.entries({
  "what does this person do for work": "person {a}",
  "what language is this": "{a}",
  "what language can people here speak": "people speak {a}",
  "what is this a list of": "{a}",
  "what is this ticket for": "{a} ticket",
  "what is this a slice of": "slice of {a}",
  "what is the person using the internet for": "person {a} on internet",
  "what is the person using the map for": "person using map for {a}",
  "what do you use to tell the time": "{a}",
  "what can you use to find the meaning of words": "{a}",
  "what can help you remember past events": "{a} remember past events",
  "what can you use to send a message": "{a} send message",
  "what do you call a very young child": "{a}",
  "what is a nice way to greet someone": "{a}",
  "how do people usually introduce themselves": "people introduce by saying name",
  "where can you watch musicians perform music": "{a}",
  "where do people pray on sundays": "{a} sunday prayer",
  "where do people put their money": "{a} money",
  "where can you find an atm": "atm {a}",
  "where can you find information about weather": "{a}",
  "what would you wear on a cool day": "{a} cool day",
  "if you do not like noise which animal should you choose": "quiet {a}",
  "what happens if you do not exercise": "{a} not exercise",
  "what is an example of a fruit": "{a} fruit",
  "what is the result of the experiment": "{a} experiment",
  "what is the reason for doing this": "{a}",
  "what does it mean to believe in something": "believe {a}",
  "what is the difference between the two shapes": "shapes different {a}",
  "what should you do if someone is hurt": "{a} person hurt",
  "what should you do after eating at home": "{a} after eating",
  "what should you never do while driving": "never {a} while driving",
  "what should you do if you feel sick": "{a} sick",
  "what is there too much of": "too much {a}",
  "what time of day is it": "{a}",
  "what time might someone eat dinner": "dinner {a}",
  "what time does this place open until on friday": "open until {a} friday",
  "at what time does the school day typically begin": "school begins {a}",
  "at what age do most people start going to college": "college {a}",
  "at what age can people in the world usually start to vote": "vote {a}",
  "at what age can people usually start to drink alcohol in the united states": "drink alcohol united states {a}",
  "what meal do most people eat in the middle of the day": "{a}",
  "how many sentences are typically in a paragraph": "paragraph {a}",
  "how often should you brush your teeth": "brush teeth {a}",
  "what animal milk is often used to make cheese": "{a} milk cheese",
  "what do people say when they meet someone for the first time": "people saying {a}",
  "what do you do when someone gives you a gift": "{a} receiving gift",
  "please describe the animal": "animal {a}",
  "what vegetable is this": "{a}",
  "what section of the newspaper is this": "newspaper {a}",
  "what kind of trip is the family on": "family {a}",
  "how would you describe this event": "{a}",
  "what meal is being served at the table": "{a} on table",
  "what can a writer do": "writer {a}",
  "where can you usually see actors": "actors {a}",
  "what event are the people at": "people at {a}",
  "what is 50 percent of something": "{a}",
  "where do people typically go to wash their clothes": "{a}",
  "what is usually inside a salad": "{a} inside salad",
}));

/** Rule-based English question slot filling, with conservative keyword fallback. */
export function nameFromPair(question, answer) {
  const q = normalize(question);
  const a = normalize(answer).replace(/^(yes|no)\s+/, "");
  const ac = compact(a);
  const result = (name, rule) => ({ name: name.trim(), rule });
  let m;
  if (!q) return result(ac, "answer");
  if (questionTemplates.has(q)) return result(questionTemplates.get(q).replace("{a}", ac), "question-template");
  if ((m = q.match(/^what (?:is|are) (.+?) having for breakfast$/))) return result(predicate(m[1], "having", a, "for breakfast"), "breakfast");
  if ((m = q.match(/^what (?:is|are) (.+?) using (.+?) to do$/))) return result(predicate(m[1], "", a, "with " + m[2]), "body-action");
  if (q === "what is being cut" && /^cutting\b/.test(ac)) return result(ac, "cutting");
  if ((m = q.match(/^whose (.+?) is this$/))) return result(ac, "possession");
  if ((m = q.match(/^what (?:does|do) (.+?) (make|sell)$/))) return result(predicate(m[1], m[2], a), "business-action");
  if ((m = q.match(/^what (?:is|are) (.+?) charging$/))) return result(predicate(m[1], "charging", a), "charging");
  if ((m = q.match(/^what sounds can (.+?) hear$/))) return result(predicate(m[1], "hear", a), "sounds");
  if ((m = q.match(/^what funny thing is (.+?) looking at$/))) return result(predicate(m[1], "looking at", "funny " + a.replace(/^funny /, "")), "funny-object");
  if ((m = q.match(/^what (?:kind|type) of (.+?) is (.+?) playing$/))) return result(predicate(m[2], "playing", m[1] === "video game" ? a.replace(/\bgame$/, "video game") : a), "game-type");
  if ((m = q.match(/^what animal is (.+?) chasing$/))) return result(predicate(m[1], "chasing", a), "chasing");
  if ((m = q.match(/^what year did (.+)$/))) return result(join(compact(m[1]), ac), "year");
  if ((m = q.match(/^how many (.+?) (?:is|are) (.+?) wearing$/))) return result(predicate(m[2], "wearing", a), "count-worn");
  if ((m = q.match(/^in (.+?) when is (.+)$/))) return result(join(compact(m[1]), compact(m[2]), ac), "season");
  if ((m = q.match(/^what (?:is|are) (.+?) (?:about|for)$/))) return result(join(compact(m[1]), / about$/.test(q) ? "about" : "for", ac), "purpose-topic");
  if ((m = q.match(/^what (?:is|are) (.+?) (next to|in|on)$/))) return result(join(compact(m[1]), m[2], /^(in|on) /.test(ac) ? ac.replace(/^(in|on) /, "") : ac), "subject-location");
  if ((m = q.match(/^what flavo[u]?r of (.+?) (?:is|are) (.+?) (eating|drinking)$/))) {
    return result(join(compact(m[2]), m[3], ac, compact(m[1])), "flavor");
  }
  if ((m = q.match(/^what (?:kind of |type of )?(.+?) (?:is|are|did|does) (.+?) (wearing|eating|drinking|taking|asking|studying|practicing|holding|filling out|have|play)$/))) return result(predicate(m[2], m[3], a), "qualified-action");
  if ((m = q.match(/^what (?:is|are) (.+?) (age|hobby)$/))) return result(join(compact(m[1]), ac), "personal-attribute");
  if ((m = q.match(/^what word describes (.+)$/))) return result(join(compact(m[1]), ac), "description");
  if ((m = q.match(/^what (?:is|are) (.+?) (ready for|excited about|interested in)$/))) return result(predicate(m[1], m[2], a), "state");
  if ((m = q.match(/^what (?:is|are) (?:making|being) (.+)$/))) return result(join(ac, compact(m[1])), "passive-cause");
  if ((m = q.match(/^what (?:was|has) (.+)$/))) return result(join(ac, compact(m[1])), "past-state");
  if ((m = q.match(/^what (?:did|does) (.+?) (?:just do|do well|do every morning)$/))) return result(predicate(m[1], "", a, /well$/.test(q) ? "well" : /morning$/.test(q) ? "every morning" : "just"), "activity-time");
  if ((m = q.match(/^what (?:will happen|happened)(.*)$/))) return result(join(ac, compact(m[1])), "event-time");
  if ((m = q.match(/^who (?:is|are|did|does) (.+?) (saving|helping|talking to|meet at the meeting)$/))) return result(predicate(m[1], m[2], a), "who-object");
  if ((m = q.match(/^who (?:will|can) (.+)$/))) return result(join(ac, compact(m[1])), "who-action");
  if ((m = q.match(/^who (works .+)$/))) return result(join(ac, compact(m[1])), "who-work");
  if ((m = q.match(/^what (?:is|are) (.+?) (taking a photo of|standing on|sending|showing|adding|enjoying|having a conversation about|agreeing on)$/))) return result(predicate(m[1], m[2], a), "additional-action");
  if ((m = q.match(/^what (?:is|are) (the )?(article|book|movie|magazine) about$/))) return result(join(m[2], "about", ac), "media-topic");
  if ((m = q.match(/^what (?:is|are) the (?:topic of .+? discussion|section of the newspaper)$/))) return result(join(/newspaper$/.test(q) ? "newspaper" : "discussion", ac), "topic");
  if ((m = q.match(/^what (?:is|are) the (first|last) letter of (.+)$/))) return result(join(compact(m[2]), m[1], "letter", ac), "letter");
  if ((m = q.match(/^what (?:is|are) (good|bad|really big|really low|true|false)(?: here)?$/))) return result(join(ac, m[1]), "attribute");
  if ((m = q.match(/^what is the other animal besides (.+)$/))) return result(join(ac, "with", compact(m[1])), "other-animal");
  if ((m = q.match(/^what is another fruit in (.+?) besides (.+)$/))) return result(join(ac, "and", compact(m[2]), "in", compact(m[1])), "other-fruit");
  if ((m = q.match(/^where did (.+?) go on vacation$/))) return result(join(compact(m[1]), "vacation", ac), "vacation");
  if ((m = q.match(/^how much does (.+?) cost$/))) return result(join(compact(m[1]), "cost", ac), "price");
  if ((m = q.match(/^how did (.+?) get to work$/))) return result(join(compact(m[1]), "to work", ac), "commute");
  if ((m = q.match(/^when was (.+?) born$/))) return result(join(compact(m[1]), "born", ac), "birth");
  if ((m = q.match(/^in what year did (.+)$/))) return result(join(compact(m[1]), ac), "year");
  if ((m = q.match(/^in which place did (.+?) finish$/))) return result(join(compact(m[1]), "finish", ac), "finish-place");
  if ((m = q.match(/^how many (.+?) (?:is|are)(?: there)? (on .+|in .+)$/))) return result(join(countName(a, m[1]), compact(m[2])), "count-location");
  if ((m = q.match(/^how many (.+?) in (.+)$/))) return result(join(compact(m[2]), ac, compact(m[1])), "count-unit");
  // Rhetorical vocabulary questions: the answer names the depicted object/concept.
  if (/\bopposite of\b/.test(q) || /^(what (?:kind|type|sport|place|season|month|day|holiday|job|part)|which (?:country|holiday|month))\b/.test(q)
      && /\b(?:this|these|that|it|typically|usually|comes|before|after|year|work|love)\b/.test(q)) {
    if ((m = q.match(/^which country has (?:this|that) flag$/))) return result(join(ac, "flag"), "country-flag");
    return result(ac, "vocabulary-answer");
  }
  if (/^what (?:is|are) (?:this|that|here|over there)$/.test(q)) {
    return result(join(ac, /over there$/.test(q) ? "over there" : ""), "identity");
  }
  if ((m = q.match(/^what colou?rs? (?:are on|is on|is|are) (.+)$/))) {
    return result(join(compact(m[1]), ac.replace(/\bcolor\b/g, "").trim()), "color");
  }
  if ((m = q.match(/^what (?:is|are) the colou?rs? of (.+)$/))) return result(join(compact(m[1]), ac), "color");
  if ((m = q.match(/^what (?:is|are|was|were|will|did) (.+?) (?:doing|do)\b(.*)$/))) {
    return result(predicate(m[1], "", a, m[2]), "activity");
  }
  if ((m = q.match(/^what (?:activity|action) (?:is|are) (.+?) doing(.*)$/))) {
    return result(predicate(m[1], "", a, m[2]), "activity");
  }
  if ((m = q.match(/^what (?:is|are|was|were|did|does|do|can|will) (.+?) (asking|saying|eating|drinking|wearing|looking at|looking through|pointing at|listening to|watching|cooking|making|drawing|painting|teaching|studying|learning about|using|buying|selling|getting|giving|gifting|paying for|waiting for|hoping for|cleaning|washing|carrying|moving|throwing|kicking|jumping over|saving|helping|fixing|counting|checking|practicing|designing|planning|writing|reading|telling|discussing|sharing|joining|growing|driving|visiting|holding|want|have|like|not like|need|see|hear|own|find|receive|break|finish|bring|meet|post online|putting butter on|putting sugar in|spending money on)\b(.*)$/))) {
    if (/^ (?:about|for|to|of|in|on|less of)$/.test(m[3])) return result(predicate(m[1], m[2] + m[3], a), "subject-action");
    return result(predicate(m[1], m[2], a, m[3]), "subject-action");
  }
  if ((m = q.match(/^who (?:is|are|was|were|can|has|here knows) (.+)$/))) {
    return result(join(ac, compact(m[1])), "who");
  }
  if ((m = q.match(/^what (?:is|are) (in .+|on .+|under .+|underneath .+|above .+|below .+|behind .+|next to .+|outside .+|between .+|over .+|near .+)$/))) {
    return result(join(ac, compact(m[1])), "object-location");
  }
  if ((m = q.match(/^what (?:is|are) (red|yellow|blue|green|black|white|orange|brown|pink|purple|grey|gray|soft|hard|heavy|dead|alive|flying|flying away|high in the sky|really low here|not here|not|cold|hot)(?: here)?$/))) {
    return result(join(ac, compact(m[1])), "object-attribute");
  }
  if ((m = q.match(/^where (?:is|are|was|were) (.+)$/))) {
    return result(join(compact(m[1]), ac), "where");
  }
  if ((m = q.match(/^where (?:do|does) (.+?) (live|work)$/))) return result(join(compact(m[1]), m[2], ac), "where-action");
  if ((m = q.match(/^how many (.+?) (?:is|are|were) (?:there )?(?:here|there)$/))) {
    return result(countName(a, m[1]), "count");
  }
  if ((m = q.match(/^how many (.+?) (?:do|does) (.+?) have$/))) return result(join(compact(m[2]), countName(a, m[1])), "count-subject");
  if ((m = q.match(/^how many (.+?) (?:is|are)(?: there)? in (.+)$/))) return result(join(compact(m[2]), countName(a, m[1])), "count-unit");
  if ((m = q.match(/^how (?:old|many meters tall) (?:is|was|will) (.+)$/))) return result(join(compact(m[1]), ac), "age-height");
  if ((m = q.match(/^how (?:does|do|is|are) (.+?) (?:feel|feeling)$/))) return result(predicate(m[1], "", a), "feeling");
  if ((m = q.match(/^which (.+?) (?:is|are|has|can) (.+)$/))) {
    return result(join(ac, compact(m[2])), "which-attribute");
  }
  if ((m = q.match(/^(?:is|are) (.+?) (?:an? )?(\w+) or (?:an? )?(\w+)$/))) {
    // Answers here select the adjective, rather than both alternatives in the question.
    if (/^(he|she|it|the|this|that)\b/.test(a) && a.split(" ").length >= 3) return result(compact(a), "polar-full-answer");
    return result(join(compact(m[1]), ac), "choice");
  }
  if ((m = q.match(/^(?:is|are|can|does|do) (.+)$/))) {
    const bare = normalize(answer).replace(/^(he|she|they|you|people) /, "");
    if (/^(yes|no|can|can not|there is|there is not)$/.test(bare)) {
      let statement = compact(m[1]);
      const negative = /^(no|can not|there is not)$/.test(bare);
      if (/^(?:is|are) there /.test(q)) {
        statement = statement.replace(/^any /, "");
        return result(negative ? join("no", statement.replace(/^anyone /, "one ")) : statement, "existence");
      }
      // Preserve negative scope before the predicate (world not flat, boy not drink milk).
      if (negative) {
        const words = statement.split(" ");
        const verb = words.findIndex(w => /^(drink|go|eat|use|see|be|in|have|wearing|listening|playing|sitting|same|different|flat)$/.test(w));
        words.splice(verb > 0 ? verb : Math.max(1, words.length - 1), 0, "not");
        statement = words.join(" ");
      }
      return result(statement, "polar-short-answer");
    }
    return result(ac, "polar-full-answer");
  }
  if ((m = q.match(/^why (?:is|are|did) (.+)$/))) return result(join(compact(m[1]), ac), "reason");
  // Remove the question scaffolding, but do not guess an English parse or discard
  // negation. The audit exposes this rule so unsupported templates are reviewable.
  const context = compact(q).replace(/\b(what|which|who|whose|where|when|why|how|kind|type|color|colors|of|thing|things)\b/g, " ")
    .replace(/\s+/g, " ").trim();
  return result(join(ac, context), "keywords");
}

export function nameFromFilename(oldName) {
  let name = oldName;
  // Curriculum names mix stage codes, prompts, timestamps, and opaque editor
  // labels. Only adopt the standalone human-readable names directly.
  if (/^m\d[-_]/i.test(name)) return null;
  if (/DALL|download|unsplash|\bhd\b|\bstandard\b|^h-|\d{8,}|[0-9a-f]{8}-[0-9a-f]{4}/i.test(name)) return null;
  // Bullets are old duplicate-file suffixes, not semantic quantities.
  name = name.replace(/•\d+$/, "");
  if (!/^[\p{L}\p{N} ,_\-]+$/u.test(name)) return null;
  name = normalize(name);
  if (!name || name.split(" ").length > 10) return null;
  return name;
}

export function buildProposal(entries, variantCount) {
  const images = new Map();
  for (const entry of entries) {
    for (const n of numbers) if (entry[`i${n}`] && !images.has(entry[`i${n}`])) images.set(entry[`i${n}`], []);
    // Exactly the selector's reachable variants, not every answer/distractor.
    for (let v = 0; v < variantCount(entry); v++) {
      const n = v + 1;
      const image = entry[`i${n}`] || entry.i1;
      if (!image) continue;
      images.get(image).push({ devref: entry.devref, variant: n, stage: entry.ostage,
        image_field: entry[`i${n}`] ? `i${n}` : "i1", question_field: entry[`q${n}`] ? `q${n}` : "q1",
        question: entry[`q${n}`] || entry.q1, answer: entry[`a${n}`] });
    }
  }
  const rows = [...images].sort(([a], [b]) => compare(a, b)).map(([old_name, associations]) => {
    associations.sort((a, b) => compare(a.devref, b.devref) || a.variant - b.variant);
    const filename = nameFromFilename(old_name);
    const candidates = associations.map(a => ({ ...nameFromPair(a.question, a.answer), association: a }));
    // Prefer a supported template; then a useful phrase of <= 10 words over a
    // vague one-word label or a long sentence. Ties use explicit lexical ordering.
    const rank = c => (c.rule === "keywords" ? -20 : 0)
      - (/\b(what|which|who|where|why|how|you)\b/.test(c.name) ? 10 : 0)
      + (/^(subject-action|activity|who-object|qualified-action|additional-action|answer)$/.test(c.rule) ? 2 : 0)
      + Math.min(c.name.split(" ").length, 8)
      - Math.max(0, c.name.split(" ").length - 10) * 3;
    candidates.sort((a, b) => rank(b) - rank(a) || compare(a.name, b.name)
      || compare(a.association.devref, b.association.devref) || a.association.variant - b.association.variant);
    const chosen = candidates[0];
    if (!filename && !chosen?.name) throw new Error(`No semantic name for ${old_name}`);
    // A weekly chart answers many different activity questions. Name the shared
    // collection rather than arbitrarily naming only one panel/day.
    const weekdays = new Set(associations.flatMap(a => normalize(a.question).match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g) || []));
    const weeklySubject = associations.map(a => normalize(a.question).match(/\b(man|woman|boy|girl) (?:doing|do|is)\b/)?.[1]).filter(Boolean).sort(compare)[0];
    const collectionName = weekdays.size >= 4 && weeklySubject ? weeklySubject + " weekly activities" : null;
    return { old_name, base_name: filename || collectionName || chosen.name, method: filename ? "filename" : "question-answer",
      rule: filename ? "readable-filename" : collectionName ? "weekly-collection" : chosen.rule,
      selected_pair: filename || collectionName ? null : chosen.association, associations };
  });
  const counts = new Map();
  for (const row of rows) {
    const count = (counts.get(row.base_name) || 0) + 1;
    counts.set(row.base_name, count);
    row.new_name = row.base_name + (count === 1 ? "" : ` #${count}`);
  }
  if (new Set(rows.map(r => r.new_name)).size !== rows.length) throw new Error("New names are not unique");
  return rows;
}

export function toTsv(rows) {
  const cell = value => {
    const s = String(value);
    return /[\t\r\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map(row => row.map(cell).join("\t")).join("\n") + "\n";
}

async function main() {
  const { source, LingoDexData, lingoDexUniqueImages, numLingoDexEntryVariants } = await loadLegacySource();
  const rows = buildProposal(LingoDexData, numLingoDexEntryVariants);
  if (rows.length !== lingoDexUniqueImages.length || rows.some(r => !lingoDexUniqueImages.includes(r.old_name))) throw new Error("Image coverage mismatch");
  const summary = {
    algorithm_version: 1,
    source: sourcePath,
    source_sha256: createHash("sha256").update(source).digest("hex"),
    entries: LingoDexData.length, unique_images: rows.length,
    display_variants: LingoDexData.reduce((n, e) => n + numLingoDexEntryVariants(e), 0),
    variants_with_images: rows.reduce((n, r) => n + r.associations.length, 0),
    filename_names: rows.filter(r => r.method === "filename").length,
    question_answer_names: rows.filter(r => r.method === "question-answer").length,
    suffixed_names: rows.filter(r => r.base_name !== r.new_name).length,
    keyword_fallback_names: rows.filter(r => r.rule === "keywords").length,
    names_over_ten_words: rows.filter(r => r.base_name.split(" ").length > 10).length,
  };
  const files = {
    "old-to-new.tsv": toTsv([["old_name", "new_name"], ...rows.map(r => [r.old_name, r.new_name])]),
    "audit.jsonl": rows.map(r => JSON.stringify(r)).join("\n") + "\n",
    "summary.json": JSON.stringify(summary, null, 2) + "\n",
  };
  if (process.argv.includes("--check")) {
    for (const [file, content] of Object.entries(files)) {
      if (await fs.readFile(path.join(outputDir, file), "utf8") !== content) throw new Error(`Stale output: ${file}`);
    }
    console.log("Image naming proposal is reproducible and current.");
  } else {
    await fs.mkdir(outputDir, { recursive: true });
    for (const [file, content] of Object.entries(files)) await fs.writeFile(path.join(outputDir, file), content);
    console.log(JSON.stringify(summary, null, 2));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
