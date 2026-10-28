/* =========================================
   TruthLens – dfa.js
   Deterministic Finite Automaton for
   fake-news linguistic pattern detection.
   The DFA processes tokens (words/phrases)
   through a multi-state transition table
   grouped into categories.
   Categories:
     1. CLICKBAIT  – sensational trigger words
     2. ABSOLUTE   – absolute claim markers
     3. EMOTIONAL  – emotional manipulation
     4. CONSPIRACY – conspiracy theory signals
     5. CREDIBLE   – credibility signals (positive)
   Each transition that "accepts" a pattern
   increments a penalty or bonus score.
   ========================================= */
"use strict";
// ── Pattern Dictionary ──────────────────────────────────────────────────────
// Each entry: { pattern, category, weight, label }
// weight > 0 = suspicious, weight < 0 = credibility boost
const DFA_PATTERNS = [
  // ── CLICKBAIT (weight 1–3)
  { p: /\byou won'?t believe\b/i,        cat: "CLICKBAIT", w: 3, lbl: "you won't believe" },
  { p: /\bshocking(ly)?\b/i,             cat: "CLICKBAIT", w: 2, lbl: "shocking" },
  { p: /\bbreaking:?\b/i,                cat: "CLICKBAIT", w: 1, lbl: "BREAKING" },
  { p: /\bmind.?blow(ing|n)\b/i,         cat: "CLICKBAIT", w: 2, lbl: "mind-blowing" },
  { p: /\bgovernment (is )?hiding\b/i,   cat: "CLICKBAIT", w: 3, lbl: "government hiding" },
  { p: /\bthey don'?t want you to know\b/i, cat:"CLICKBAIT",w:3,lbl:"they don't want you to know"},
  { p: /\bwake up\b/i,                   cat: "CLICKBAIT", w: 2, lbl: "wake up" },
  { p: /\bwhat (the )?media won'?t tell\b/i, cat:"CLICKBAIT",w:3,lbl:"what media won't tell"},
  { p: /\bgo viral\b/i,                  cat: "CLICKBAIT", w: 1, lbl: "go viral" },
  { p: /\bshare (this )?before (it'?s )?deleted\b/i,cat:"CLICKBAIT",w:3,lbl:"share before deleted"},
  { p: /\bexclusive(ly)?\b/i,            cat: "CLICKBAIT", w: 1, lbl: "exclusive" },
  { p: /\bhistoric(al)?\b/i,             cat: "CLICKBAIT", w: 1, lbl: "historic" },
  { p: /\bmiracle\b/i,                   cat: "CLICKBAIT", w: 2, lbl: "miracle" },
  { p: /\bsecret(ly)?\b/i,              cat: "CLICKBAIT", w: 2, lbl: "secret" },
  { p: /\bunbelievable\b/i,              cat: "CLICKBAIT", w: 2, lbl: "unbelievable" },
  { p: /!!+/,                            cat: "CLICKBAIT", w: 2, lbl: "!!!" },
  { p: /[A-Z]{5,}/,                      cat: "CLICKBAIT", w: 2, lbl: "EXCESSIVE CAPS" },
  { p: /\?\?+/,                          cat: "CLICKBAIT", w: 1, lbl: "???" },
  // ── ABSOLUTE CLAIMS (weight 2–3)
  { p: /\b(100%|one hundred percent)\b/i,cat:"ABSOLUTE",   w: 2, lbl: "100%" },
  { p: /\bscientists (prove|confirm|discover)\b/i,cat:"ABSOLUTE",w:2,lbl:"scientists prove"},
  { p: /\bproven (fact|truth)\b/i,       cat: "ABSOLUTE",  w: 2, lbl: "proven fact" },
  { p: /\bdefinitely\b/i,                cat: "ABSOLUTE",  w: 1, lbl: "definitely" },
  { p: /\bwithout (a )?doubt\b/i,        cat: "ABSOLUTE",  w: 2, lbl: "without doubt" },
  { p: /\bguaranteed\b/i,                cat: "ABSOLUTE",  w: 2, lbl: "guaranteed" },
  { p: /\balways\b/i,                    cat: "ABSOLUTE",  w: 1, lbl: "always" },
  { p: /\bnever\b/i,                     cat: "ABSOLUTE",  w: 1, lbl: "never" },
  { p: /\beveryone knows\b/i,            cat: "ABSOLUTE",  w: 2, lbl: "everyone knows" },
  { p: /\bno one (is )?talking about\b/i,cat:"ABSOLUTE",  w: 2, lbl: "no one talking about" },
  { p: /\bthe truth (is|about)\b/i,      cat: "ABSOLUTE",  w: 1, lbl: "the truth is" },
  { p: /\bfact:\b/i,                     cat: "ABSOLUTE",  w: 2, lbl: "FACT:" },
  { p: /\bproves?\b/i,                   cat: "ABSOLUTE",  w: 1, lbl: "proves" },
  // ── EMOTIONAL MANIPULATION (weight 1–3)
  { p: /\boutrage(ous)?\b/i,             cat: "EMOTIONAL", w: 2, lbl: "outrage" },
  { p: /\bscandal(ous)?\b/i,            cat: "EMOTIONAL", w: 2, lbl: "scandal" },
  { p: /\bdangerous(ly)?\b/i,           cat: "EMOTIONAL", w: 1, lbl: "dangerous" },
  { p: /\bterr(ify|ible|ifying)\b/i,    cat: "EMOTIONAL", w: 2, lbl: "terrifying" },
  { p: /\bsick(ening)?\b/i,             cat: "EMOTIONAL", w: 1, lbl: "sickening" },
  { p: /\bdisgust(ing)?\b/i,            cat: "EMOTIONAL", w: 1, lbl: "disgusting" },
  { p: /\bhorr(ible|ifying|or)\b/i,     cat: "EMOTIONAL", w: 2, lbl: "horrifying" },
  { p: /\bpatriot(ic)?\b/i,             cat: "EMOTIONAL", w: 1, lbl: "patriotic" },
  { p: /\bbetrayed?\b/i,                cat: "EMOTIONAL", w: 2, lbl: "betrayed" },
  { p: /\bcorrupt(ion)?\b/i,            cat: "EMOTIONAL", w: 1, lbl: "corruption" },
  { p: /\bcrisis\b/i,                   cat: "EMOTIONAL", w: 1, lbl: "crisis" },
  { p: /\bepidemic\b/i,                 cat: "EMOTIONAL", w: 1, lbl: "epidemic" },
  { p: /\bpanic\b/i,                    cat: "EMOTIONAL", w: 1, lbl: "panic" },
  // ── CONSPIRACY SIGNALS (weight 2–4)
  { p: /\bdeep state\b/i,               cat: "CONSPIRACY",w: 4, lbl: "deep state" },
  { p: /\bnew world order\b/i,          cat: "CONSPIRACY",w: 4, lbl: "new world order" },
  { p: /\billuminati\b/i,               cat: "CONSPIRACY",w: 4, lbl: "illuminati" },
  { p: /\bcabal\b/i,                    cat: "CONSPIRACY",w: 3, lbl: "cabal" },
  { p: /\bfalse flag\b/i,               cat: "CONSPIRACY",w: 4, lbl: "false flag" },
  { p: /\bshadow government\b/i,        cat: "CONSPIRACY",w: 4, lbl: "shadow government" },
  { p: /\b5g (causes?|spreads?)\b/i,    cat: "CONSPIRACY",w: 4, lbl: "5G causes/spreads" },
  { p: /\bchip(ped|ping)? (us|people|vaccine)\b/i,cat:"CONSPIRACY",w:4,lbl:"microchip vaccine"},
  { p: /\bmind control\b/i,             cat: "CONSPIRACY",w: 3, lbl: "mind control" },
  { p: /\bfake (moon|pandemic|election)\b/i,cat:"CONSPIRACY",w:3,lbl:"fake event"},
  { p: /\bthey'?re controlling\b/i,     cat: "CONSPIRACY",w: 3, lbl: "they're controlling" },
  { p: /\bplanned (pandemi|event|agenda)\b/i,cat:"CONSPIRACY",w:3,lbl:"planned agenda"},
  { p: /\btruth seeker\b/i,             cat: "CONSPIRACY",w: 2, lbl: "truth seeker" },
  { p: /\bwake up sheeple\b/i,          cat: "CONSPIRACY",w: 4, lbl: "wake up sheeple" },
  // ── CREDIBILITY SIGNALS (negative weight = good!)
  { p: /\baccording to\b/i,             cat: "CREDIBLE", w:-2, lbl: "according to" },
  { p: /\bcited (in|by)\b/i,            cat: "CREDIBLE", w:-2, lbl: "cited in" },
  { p: /\bpublished (in|by)\b/i,        cat: "CREDIBLE", w:-2, lbl: "published in" },
  { p: /\bpeer.?reviewed\b/i,           cat: "CREDIBLE", w:-3, lbl: "peer-reviewed" },
  { p: /\bstudy (shows?|finds?)\b/i,    cat: "CREDIBLE", w:-1, lbl: "study shows" },
  { p: /\bresearchers? (say|found)\b/i, cat: "CREDIBLE", w:-1, lbl: "researchers found" },
  { p: /\bofficial (data|report|statement)\b/i,cat:"CREDIBLE",w:-2,lbl:"official report"},
  { p: /\bsource:\b/i,                  cat: "CREDIBLE", w:-1, lbl: "source:" },
  { p: /\ballegedly\b/i,                cat: "CREDIBLE", w:-1, lbl: "allegedly" },
  { p: /\breported(ly)?\b/i,            cat: "CREDIBLE", w:-1, lbl: "reportedly" },
  { p: /\bdata shows?\b/i,              cat: "CREDIBLE", w:-1, lbl: "data shows" },
];
// ── DFA States ─────────────────────────────────────────────────────────────
// States: START → SCAN → categories → ACCEPT (final)
// Simplified: sequential scan with state tracking per category
const DFA_STATES = ["S0", "S1", "S2", "S3", "S4", "ACC"];
// S0 = start, S1=clickbait found, S2=absolute, S3=emotional,
// S4=conspiracy, ACC = final decision
// ── Main DFA Runner ────────────────────────────────────────────────────────
function runDFA(text) {
  const results = {
    matches: [],               // { pattern, cat, weight, label }
    categories: {
      CLICKBAIT:  { count: 0, weight: 0 },
      ABSOLUTE:   { count: 0, weight: 0 },
      EMOTIONAL:  { count: 0, weight: 0 },
      CONSPIRACY: { count: 0, weight: 0 },
      CREDIBLE:   { count: 0, weight: 0 },
    },
    totalPenalty: 0,
    fakeScore: 0,   // 0-100, higher = more fake
    states: [],     // DFA state transitions for visualizer
  };
  // ── DFA Transition Simulation ───────────────────────────────────────────
  // State machine: START → per-category states → ACCUMULATE → DECIDE
  let currentState = "S0";
  results.states.push({ state: currentState, label: "START" });
  // Pass 1: scan all patterns (DFA parallel acceptance)
  const seen = new Set(); // avoid double-counting same label
  for (const entry of DFA_PATTERNS) {
    const match = text.match(entry.p);
    if (match && !seen.has(entry.lbl)) {
      seen.add(entry.lbl);
      results.matches.push({ label: entry.lbl, cat: entry.cat, weight: entry.w });
      results.categories[entry.cat].count++;
      results.categories[entry.cat].weight += entry.w;
      results.totalPenalty += entry.w;
      // DFA state transitions based on category
      const catStateMap = { CLICKBAIT:"S1", ABSOLUTE:"S2", EMOTIONAL:"S3", CONSPIRACY:"S4" };
      if (catStateMap[entry.cat] && currentState !== "S4") {
        currentState = catStateMap[entry.cat];
      }
    }
  }
  // Move to accept state
  results.states.push({ state: currentState, label: getCatLabel(currentState) });
  results.states.push({ state: "ACC", label: "DECIDE" });
  // ── Score Computation ───────────────────────────────────────────────────
  // Max plausible penalty for normalization ≈ 35
  const MAX_PENALTY = 35;
  const rawFake = Math.max(0, results.totalPenalty);
  results.fakeScore = Math.min(100, Math.round((rawFake / MAX_PENALTY) * 100));
  // Credibility bonus reduces fake score
  const credBonus = Math.abs(results.categories.CREDIBLE.weight) * 3;
  results.fakeScore = Math.max(0, results.fakeScore - credBonus);
  // Credibility score is inverse
  results.credibilityScore = 100 - results.fakeScore;
  return results;
}
function getCatLabel(state) {
  const map = {
    S0: "START", S1: "CLICKBAIT", S2: "ABSOLUTE",
    S3: "EMOTIONAL", S4: "CONSPIRACY", ACC: "DECIDE"
  };
  return map[state] || state;
}
