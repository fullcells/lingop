import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compare, normalize, toTsv } from "./propose-lingodex-image-names.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const outputDir = path.join(root, "docs/image-names");

/** Conservative metadata cleanup. Keep semantic adjectives and relational words. */
export function simplifyName(name) {
  let s = normalize(name)
    .replace(/\b(?:a|an|the|diverse|very|really|incredibly)\b/g, " ")
    .replace(/\b(?:cartoon|anime|photorealistic) style\b/g, " ")
    .replace(/\bgroup of\b/g, " ").replace(/\band also\b/g, "and")
    .replace(/\binside\b/g, "in")
    .replace(/\bcount (?:number of|the number of)\b/g, "count")
    .replace(/\bthinking and choosing which (.+?) to (?:open|get)\b/g, "choosing $1")
    .replace(/\bchoosing which (.+?) to (?:buy|get)\b/g, "choosing $1")
    .replace(/\bchoosing flavor ice cream\b/g, "choosing ice cream flavor")
    .replace(/\bimage showing it will\b/g, "")
    .replace(/\bdoing exercise\b/g, "exercising")
    .replace(/\bon (left|right)\b/g, "$1")
    .replace(/\bat end of street\b/g, "at street end")
    .replace(/\breading book (.+?) book almost finished\b/g, "almost finished reading book $1")
    .replace(/\bperson doing because (?:she|he) wants to\b/g, "person wants to")
    .replace(/\bperson want to go for walk but started to rain\b/g, "person wants walk but rain")
    .replace(/\bonce i start reading i can not put book down\b/g, "person reading book cannot stop")
    .replace(/\beveryone loves park else why would so many people\b/g, "busy park people")
    .replace(/\bno way he can finish work in one day\b/g, "person overwhelmed work one day")
    .replace(/\bperson added slices of banana to bowl of milk\b/g, "person adding banana slices to milk bowl")
    .replace(/\bperson studied at school then she became teacher\b/g, "student became teacher")
    .replace(/\bpeople got luggage then they went to airport\b/g, "people luggage going to airport")
    .replace(/\bperson brushed teeth before he went to sleep\b/g, "person brushing teeth before sleep")
    .replace(/\bperson using credit card for renting hotel room\b/g, "person renting hotel room credit card")
    .replace(/\bperson loves painting so he bought new brushes\b/g, "person painting buying paintbrushes")
    .replace(/\bperson wants to learn something new\b/g, "person wants to learn")
    .replace(/\bperson doing because he needs to buy gift\b/g, "person needs to buy gift")
    .replace(/\bhere long time ago\b/g, "long ago")
    .replace(/\btennis match(.+)tennis racket\b/g, "tennis match$1racket")
    .replace(/\bsoccer field during soccer match\b/g, "soccer field")
    .replace(/\bmovies on left and right worse than middle movie\b/g, "left right movies worse than middle")
    .replace(/\bmovies left and right worse than middle movie\b/g, "left right movies worse than middle")
    .replace(/\s+/g, " ").trim();
  // Convert only ordinary cardinal sequences, not ordinal names or identifiers.
  const units = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
    seventy: 70, eighty: 80, ninety: 90 };
  const numberPattern = new RegExp(`\\b(?:${Object.keys(units).join("|")})(?: (?:${Object.keys(units).join("|")}|hundred|thousand|and))*\\b`, "g");
  s = s.replace(numberPattern, phrase => {
    const words = phrase.split(" ");
    // Do not turn independent quantities ("one and two") into an accidental sum.
    if (words.includes("and") && !words.includes("hundred") && !words.includes("thousand")) return phrase;
    let total = 0, section = 0;
    for (const word of words) {
      if (word === "hundred") section = (section || 1) * 100;
      else if (word === "thousand") { total += (section || 1) * 1000; section = 0; }
      else if (word !== "and") section += units[word];
    }
    return String(total + section);
  });
  const words = s.split(" ");
  if (words.length > 4 && /ing$/.test(words.at(-1)) && words.slice(0, -1).includes(words.at(-1))) words.pop();
  return words.join(" ");
}

/** Recover descriptive text from filename metadata, without treating IDs as prose. */
export function sourceDescription(oldName) {
  let s = oldName;
  if (s.includes("DALL")) s = s.replace(/^.*?DALL[\s\S]*?\d{4}-\d{2}-\d{2} \d{2}\.\d{2}\.\d{2} - /, "");
  else if (/^m\d/.test(s)) {
    // Prompt-export names have a natural-language article after the stage prefix.
    const start = s.search(/(?:-|_)(?:a|an|the)_/i);
    if (start < 0 || !/\d{9,}_(?:hd|standard)/.test(s)) return null;
    s = s.slice(start + 1);
  } else if (!/[. ]|_.*\d{9,}/.test(s) || /^h-/.test(s)) return null;
  s = s.replace(/_\d{9,}_(?:hd|standard).*$/i, "").replace(/_/g, " ");
  s = s.replace(/\b(?:cartoon|anime|photorealistic|comic book) style\b.*$/i, "")
    .replace(/\b(?:no words|no text|the scene captures|the image should|the illustration should)\b.*$/i, "");
  // English prompt prose must actually remain after stripping the wrapper.
  return /[a-z]{3}/i.test(s) && !/^m\d/.test(s) ? s : null;
}

const actorWords = `man woman boy girl child children baby person people family couple student students teacher teachers farmer farmers firefighter firefighters policeman police officer doctor nurse librarian scientist plumber artist painter chef waiter photographer singer musician musicians worker workers delegates officials superhero superheroes cyclist astronaut fisherman grandpa grandma father mother mom dad brother sister friends men women clown pilot driver gardener receptionist athlete mailman tourist consumer instructor`;
const objectWords = `cat dog bird rabbit mouse lion giraffe elephant sheep cow pig chicken fish ant spider horse butterfly snake turtle bear puppy caterpillar
  car cars bus train plane airplane bicycle bike truck ferry boat taxi motorcycle rocket rockets
  door window house hospital school library park museum embassy pharmacy supermarket bank hotel cinema airport restaurant bakery bookstore laundromat
  church stadium factory office classroom bedroom bathroom kitchen garden forest mountain mountains beach ocean lake river island desert street road bridge
  book books piano guitar television tv computer phone camera radio wristwatch watch microphone paintbrush paintbrushes
  ball basketball football baseball tennis racket trophy helmet shoes shoe hat jacket shirt dress pants coat uniform swimsuit cape costume
  apple carrot banana orange pear strawberry strawberries watermelon lemon potato mushroom broccoli tomato grapes vegetable vegetables fruit crops land tree flowers flower grass leaves plant nest
  milk water tea coffee juice beer wine lemonade food meat bread rice cake chocolate chocolates pizza cheese butter sugar noodles dumplings sandwich burger soup salad candy cookies eggs peanuts popcorn ice cream
  box basket bag backpack luggage suitcase wallet key umbrella balloon letter newspaper magazine dictionary page photograph picture painting poster posters map calendar flag flags money credit card ticket receipt bill
  bed table chair shelf stairs ladder fence gate roof pool bathtub shower sink toilet bowl plate cup glass bottle jar fridge oven desk mirror
  fire firetruck ambulance first aid kit thermometer stethoscope flashlight snow snowman rain rainbow cloud clouds sun moon stars sky concert wedding birthday homework toys toy pencil pen paper menu`;
const multiwordActors = ["police officer", "construction worker", "taxi driver", "bus driver", "truck driver", "soccer player", "tennis player", "basketball player"];
const multiwordObjects = [...multiwordActors, "first aid kit", "credit card", "ice cream", "school uniform", "school clothes", "soccer ball", "tennis ball", "tennis racket", "soccer field", "soccer match", "train platform", "swimming pool", "bus ticket", "paper plane", "toy boat", "toy car", "milk bottle", "birthday card", "birthday cake", "birthday party", "bus stop", "train station", "shopping center", "fire station", "police station", "office building", "paintbrush", "paintbrushes"];
const actorSet = new Set([...actorWords.split(/\s+/), ...multiwordActors]);
const objectSet = new Set(objectWords.trim().split(/\s+/));
const attributes = new Set(`red yellow blue green orange purple pink black white brown grey gray golden gold silver dry wet dirty clean burning broken lost empty full big small tall short old young dead sleeping snowy hungry thirsty cold hot injured scared happy sad angry colorful striped wooden glass paper cardboard strawberry chocolate vanilla`.split(" "));
const backgroundObjects = new Set("cloud clouds sky road street land room window floor wall table chair desk shelf grass sun mountain mountains trees tree park house kitchen garden water bowl plate cup glass".split(" "));
const genericActors = new Set(["person", "people", "child", "children", "man", "woman", "boy", "girl"]);
const key = s => s.replace(/\bairplane\b/g, "plane").replace(/\bbicycle\b/g, "bike").replace(/\btelevision\b/g, "tv")
  .replace(/\bmen\b/g, "man").replace(/\bwomen\b/g, "woman").replace(/\bchildren\b/g, "child").replace(/\b([a-z]{3,})s\b/g, "$1");
const contains = (s, phrase) => (" " + key(s) + " ").includes(" " + key(phrase) + " ");

export function sceneFacts(description) {
  const firstSentence = description.split(/[.!?](?:\s|$)/)[0];
  const text = normalize(firstSentence).replace(/\b(?:a|an|the|diverse|very|really|incredibly|detailed|vibrant|cheerful|majestic|cozy|bright)\b/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(" ");
  const facts = [];
  for (let i = 0; i < words.length; i++) {
    const multi = multiwordObjects.find(p => words.slice(i, i + p.split(" ").length).join(" ") === p);
    const noun = multi || words[i];
    if (!multi && !actorSet.has(noun) && !objectSet.has(noun)) continue;
    let start = i;
    while (start > 0 && attributes.has(words[start - 1]) && i - start < 2) start--;
    const phrase = words.slice(start, i).concat(noun).join(" ");
    const end = i + noun.split(" ").length;
    const alternative = words[end] === "or" || words[i - 1] === "or";
    // "Painting a landscape" is an action; do not append it as an extra object.
    if (noun !== "painting" && !alternative) facts.push({ noun, phrase, actor: actorSet.has(noun), position: i, qualified: start < i, background: backgroundObjects.has(noun) });
    if (multi) i += multi.split(" ").length - 1;
  }
  return facts;
}

// A compact source sentence with multiple vehicle events describes the whole
// diagram more directly than choosing one of its color/speed questions.
function vehicleScene(description) {
  const events = [];
  for (const sentence of description.split(/[.!?](?:\s|$)/)) {
    const s = simplifyName(sentence);
    const m = s.match(/^(?:white |red |blue |black )?(car|plane|airplane|bus|train|bicycle|bike|truck) (?:is )?(passing|flying|driving|moving)(?: (?:a )?(cyclist|car|bus|bicycle|bike|truck))?/);
    if (m) events.push([m[1], m[2], m[3]].filter(Boolean).join(" "));
  }
  return events.length >= 2 ? events.join(" ") : null;
}

export function reviseName(row) {
  let name = simplifyName(row.base_name);
  const changes = [];
  if (name !== row.base_name) changes.push("simplified wording");
  const description = sourceDescription(row.old_name);
  if (!description) return { base_name: name, changes, source_description: null, source_additions: [] };
  const vehicle = vehicleScene(description);
  if (vehicle && /\b(vehicle|faster|fastest|slower|slowest|windows)\b/.test(name)) {
    return { base_name: vehicle, changes: [...changes, "retained multiple vehicle events"], source_description: description, source_additions: vehicle.split(" ").filter(w => !contains(name, w)) };
  }
  const facts = sceneFacts(description);
  const primaryActor = facts.find(f => f.actor && f.position <= 12);
  const actorReference = name.match(/\b(person|people|child|children)\b/) || name.match(/^(man|woman|boy|girl)\b/);
  if (primaryActor && actorReference) {
    const currentActor = actorReference[1];
    const moreSpecific = !genericActors.has(primaryActor.noun) || /^(person|people|child|children)$/.test(currentActor);
    const collectiveActor = /^(people|children|students|teachers|farmers|firefighters|musicians|workers|delegates|officials|friends|men|women|family|couple)$/.test(primaryActor.noun);
    const currentCollective = /^(people|children)$/.test(currentActor);
    if (moreSpecific && primaryActor.noun !== currentActor && currentCollective === collectiveActor) {
      let subject = primaryActor.phrase.replace(/^(?:hot|cold) /, "");
      if (/^(man|woman|boy|girl)$/.test(currentActor) && !genericActors.has(primaryActor.noun)) subject = currentActor + " " + subject;
      name = name.slice(0, actorReference.index) + subject + name.slice(actorReference.index + currentActor.length);
      changes.push("restored subject from description");
    }
  }
  name = name.replace(/^(.+?) works as \1$/, "$1");
  // Upgrade a generic head noun instead of appending a duplicate compound:
  // "ball black and white" -> "soccer ball black and white", not two balls.
  for (const fact of facts.filter(f => f.noun.includes(" ") && !f.actor)) {
    const head = fact.noun.split(" ").at(-1);
    if (!contains(name, fact.noun) && contains(name, head)) {
      const at = name.split(" ").findIndex(w => key(w) === key(head));
      const previous = name.split(" ")[at - 1];
      const typedAlready = multiwordObjects.some(p => p.endsWith(" " + head) && p.split(" ").at(-2) === previous);
      if (!typedAlready) {
        const nameWords = name.split(" ");
        nameWords.splice(at, 1, fact.noun);
        name = nameWords.join(" ");
        changes.push("restored object specificity");
      }
    }
  }
  // Restore a missing adjective on a noun already named, such as "green door".
  for (const fact of facts.filter(f => f.qualified && !f.actor)) {
    if (contains(name, fact.noun) && !contains(name, fact.phrase)) {
      const modifiers = fact.phrase.slice(0, -fact.noun.length).trim().split(" ");
      // Avoid inventing conflicting attributes (e.g. a red vs a green house in
      // the same image). Only insert where the current noun is unqualified.
      const nameWords = name.split(" ");
      const at = nameWords.findIndex(w => key(w) === key(fact.noun));
      if (at >= 0 && !attributes.has(nameWords[at - 1]) && !attributes.has(nameWords[at + 1]) && !modifiers.some(w => contains(name, w))) {
        nameWords.splice(at, 0, ...modifiers);
        name = nameWords.join(" ");
        changes.push("restored object attribute");
      }
    }
  }
  const additions = [];
  const candidates = facts.filter(f => !f.actor && !contains(name, f.noun) && (!f.background || f.qualified))
    .sort((a, b) => (Number(b.qualified) * 2 - Number(b.background)) - (Number(a.qualified) * 2 - Number(a.background)) || a.position - b.position || compare(a.phrase, b.phrase));
  const canAddContext = name.split(" ").length <= 6;
  for (const fact of candidates) {
    if (!canAddContext || additions.length === 1 || name.split(" ").length + fact.phrase.split(" ").length > 10) continue;
    if (contains(name, fact.noun)) continue;
    name += " " + fact.phrase;
    additions.push(fact.phrase);
  }
  if (additions.length) changes.push("retained distinctive objects");
  return { base_name: name, changes, source_description: description, source_additions: additions };
}

export function buildPreview(rows) {
  const counts = new Map();
  return [...rows].sort((a, b) => compare(a.old_name, b.old_name)).map((row, index) => {
    const revised = reviseName(row);
    const count = (counts.get(revised.base_name) || 0) + 1;
    counts.set(revised.base_name, count);
    return { original_tsv_line: index + 2, old_name: row.old_name, current_name: row.new_name,
      proposed_name: revised.base_name + (count > 1 ? ` #${count}` : ""),
      current_words: row.base_name.split(" ").length, proposed_words: revised.base_name.split(" ").length,
      ...revised };
  });
}

async function main() {
  const rows = (await fs.readFile(path.join(outputDir, "audit.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
  const preview = buildPreview(rows);
  if (new Set(preview.map(r => r.proposed_name)).size !== rows.length) throw new Error("Duplicate proposed names");
  const header = ["original_tsv_line", "old_name", "current_name", "proposed_name", "current_words", "proposed_words", "changes", "source_additions"];
  const table = list => toTsv([header, ...list.map(r => header.map(k => Array.isArray(r[k]) ? r[k].join("; ") : r[k]))]);
  const longest = [...preview].sort((a, b) => b.current_words - a.current_words || b.current_name.length - a.current_name.length || a.original_tsv_line - b.original_tsv_line).slice(0, 50);
  const sum = key => preview.reduce((total, r) => total + r[key], 0);
  const summary = { algorithm_version: 2, context_policy: "main subjects and distinctive context", number_format: "digits", total: rows.length,
    changed_names: preview.filter(r => r.current_name !== r.proposed_name).length,
    shorter_names: preview.filter(r => r.proposed_words < r.current_words).length,
    longer_names: preview.filter(r => r.proposed_words > r.current_words).length,
    restored_subjects: preview.filter(r => r.changes.includes("restored subject from description")).length,
    restored_object_attributes: preview.filter(r => r.changes.includes("restored object attribute")).length,
    with_source_additions: preview.filter(r => r.source_additions.length).length,
    current_average_words: Number((sum("current_words") / rows.length).toFixed(2)),
    proposed_average_words: Number((sum("proposed_words") / rows.length).toFixed(2)),
    current_max_words: Math.max(...preview.map(r => r.current_words)),
    proposed_max_words: Math.max(...preview.map(r => r.proposed_words)),
    longest_50_current_average_words: Number((longest.reduce((s, r) => s + r.current_words, 0) / 50).toFixed(2)),
    longest_50_proposed_average_words: Number((longest.reduce((s, r) => s + r.proposed_words, 0) / 50).toFixed(2)),
    suffixed_names: preview.filter(r => r.proposed_name !== r.base_name).length };
  const files = { "simplification-preview.tsv": table(preview), "longest-preview.tsv": table(longest),
    "old-to-new.v2.tsv": toTsv([["old_name", "new_name"], ...preview.map(r => [r.old_name, r.proposed_name])]),
    "preview-summary.json": JSON.stringify(summary, null, 2) + "\n" };
  for (const [file, content] of Object.entries(files)) {
    if (process.argv.includes("--check")) {
      if (await fs.readFile(path.join(outputDir, file), "utf8") !== content) throw new Error(`Stale output: ${file}`);
    } else await fs.writeFile(path.join(outputDir, file), content);
  }
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
