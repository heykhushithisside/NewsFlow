/* =========================================
   TruthLens – app.js (Vercel Proxy Version)
   Hybrid: DFA Engine + HuggingFace BERT AI
   Model: mrm8488/bert-tiny-finetuned-fake-news-detection
   ========================================= */
"use strict";

const ST = { hfKey: "", lastResult: null };

// ── Init ───────────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  ST.hfKey = localStorage.getItem("tl_hf_key") || "";
  if (ST.hfKey) {
    const keyInput = document.getElementById("hfKey");
    if (keyInput) keyInput.value = ST.hfKey;
    
    const setupBody = document.getElementById("setupBody");
    const setupChevron = document.getElementById("setupChevron");
    if (setupBody) setupBody.classList.add("hidden");
    if (setupChevron) setupChevron.classList.add("rotated");
  }
  updateCharCount();
});

function toggleSetup() {
  const setupBody = document.getElementById("setupBody");
  const setupChevron = document.getElementById("setupChevron");
  if (setupBody) setupBody.classList.toggle("hidden");
  if (setupChevron) setupChevron.classList.toggle("rotated");
}

function saveKey() {
  const keyInput = document.getElementById("hfKey");
  const el = document.getElementById("saveStatus");
  if (!keyInput || !el) return;

  const key = keyInput.value.trim();
  if (!key || !key.startsWith("hf_")) {
    el.textContent = "⚠ Token should start with hf_";
    el.className = "save-status err";
    return;
  }
  localStorage.setItem("tl_hf_key", key);
  ST.hfKey = key;
  el.textContent = "✓ Saved!";
  el.className = "save-status ok";
  setTimeout(() => {
    const setupBody = document.getElementById("setupBody");
    const setupChevron = document.getElementById("setupChevron");
    if (setupBody) setupBody.classList.add("hidden");
    if (setupChevron) setupChevron.classList.add("rotated");
  }, 900);
}

function updateCharCount() {
  const inputEl = document.getElementById("newsInput");
  const countEl = document.getElementById("charCount");
  if (!inputEl || !countEl) return;
  const n = inputEl.value.length;
  countEl.textContent = `${n.toLocaleString()} / 5,000`;
}

function clearAll() {
  const inputEl = document.getElementById("newsInput");
  if (inputEl) inputEl.value = "";
  updateCharCount();
  resetAll();
}

// ── Main Analysis ──────────────────────────────────────────────────────────
async function analyze() {
  const inputEl = document.getElementById("newsInput");
  if (!inputEl) return;

  const text = inputEl.value.trim();
  if (!text || text.length < 15) {
    showErr("Text too short", "Please enter at least 15 characters.");
    return;
  }

  const dfaEl = document.getElementById("useDFA");
  const hfEl = document.getElementById("useGemini");

  const useDFA = dfaEl ? dfaEl.checked : true;
  const useHF = hfEl ? hfEl.checked : true;

  if (!useDFA && !useHF) {
    showErr("Nothing selected", "Enable at least one analysis method.");
    return;
  }

  if (useHF && !ST.hfKey) {
    showErr(
      "HuggingFace Token Required",
      `Add your free HuggingFace token above.<br><br>
      <b>How to get it (takes 30 seconds):</b><br>
      1. Go to <a href="https://huggingface.co/join" target="_blank" style="color:var(--cyan)">huggingface.co/join</a> — sign up free<br>
      2. Go to <a href="https://huggingface.co/settings/tokens" target="_blank" style="color:var(--cyan)">Settings → Access Tokens</a><br>
      3. Click <b>New Token</b> → choose <b>Read</b> role → Create<br>
      4. Copy the <code style="color:var(--purple)">hf_...</code> token and paste it above`
    );
    return;
  }

  hideAll();
  showLoading();
  const analyzeBtn = document.getElementById("analyzeBtn");
  if (analyzeBtn) analyzeBtn.disabled = true;

  try {
    let dfaResult = null;
    let hfResult = null;

    // ── Step 1: DFA (instant, offline)
    setStep(1, "active");
    updateLoadLabel("DFA scanning patterns…");
    if (useDFA) {
      await sleep(300);
      if (typeof runDFA === "function") {
        dfaResult = runDFA(text);
      }
    }
    setStep(1, "done");

    // ── Step 2: HuggingFace BERT via Vercel Proxy
    setStep(2, "active");
    updateLoadLabel("HuggingFace BERT classifying…");
    if (useHF) {
      hfResult = await callHuggingFace(text);
    }
    setStep(2, "done");

    // ── Step 3: Hybrid verdict
    setStep(3, "active");
    updateLoadLabel("Computing hybrid verdict…");
    await sleep(350);
    const verdict = hybridVerdict(dfaResult, hfResult);
    ST.lastResult = { text, dfaResult, hfResult, verdict };
    setStep(3, "done");

    await sleep(250);
    hideLoading();
    renderResults(dfaResult, hfResult, verdict);
  } catch (e) {
    hideLoading();
    let msg = e.message || "Unknown error occurred.";
    if (msg.includes("loading")) {
      msg = `The HuggingFace model is warming up (cold start). <br><br>
             Please <b>wait 20–30 seconds</b> and click Analyze again — this only happens once per session.`;
    } else if (msg.includes("401") || msg.includes("Authorization")) {
      msg = `Invalid HuggingFace token. Make sure you copied the full <code>hf_...</code> token from 
             <a href="https://huggingface.co/settings/tokens" target="_blank" style="color:var(--cyan)">huggingface.co/settings/tokens</a>`;
    } else if (msg.includes("429") || msg.includes("quota")) {
      msg = "Rate limit hit. Wait a minute and try again (free tier limit).";
    } else if (msg.includes("503")) {
      msg = `Model is loading on HuggingFace servers. <b>Wait 20–30 seconds</b> and try again — this is normal for cold starts.`;
    }
    showErr("Analysis Failed", msg);
  }
  if (analyzeBtn) analyzeBtn.disabled = false;
}

function updateLoadLabel(txt) {
  const lbl = document.getElementById("loadLabel");
  if (lbl) lbl.textContent = txt;
}

// ── HuggingFace BERT Inference API via Vercel Proxy (Robust) ───────────────
async function callHuggingFace(text) {
  const input = text.length > 900 ? text.substring(0, 900) : text;
  
  const resp = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: input,
      hfKey: ST.hfKey
    }),
  });

  const responseText = await resp.text();
  let data;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch (err) {
    throw new Error(`Server returned non-JSON response (${resp.status}): ${responseText.substring(0, 120)}`);
  }

  if (!resp.ok) {
    const errText = typeof data.error === 'string' ? data.error : (responseText || "Unknown error");
    if (resp.status === 503 || errText.includes("loading")) {
      throw new Error("loading");
    }
    if (resp.status === 401) throw new Error("401 Authorization error");
    if (resp.status === 429) throw new Error("429 quota");
    throw new Error(`API error ${resp.status}: ${errText.substring(0, 120)}`);
  }

  let predictions = data;
  if (Array.isArray(data) && Array.isArray(data[0])) predictions = data[0];
  if (!Array.isArray(predictions) || predictions.length === 0) {
    throw new Error("Unexpected response format from HuggingFace model.");
  }

  const result = { raw: predictions, realScore: 0, fakeScore: 0, label: "UNCERTAIN" };
  for (const pred of predictions) {
    const lbl = (pred.label || "").toUpperCase();
    const sc = Math.round((pred.score || 0) * 100);
    if (lbl === "REAL" || lbl === "LABEL_0" || lbl === "TRUE") {
      result.realScore = sc;
    } else if (lbl === "FAKE" || lbl === "LABEL_1" || lbl === "FALSE") {
      result.fakeScore = sc;
    }
  }

  result.label = result.fakeScore > result.realScore ? "FAKE" : "REAL";
  return result;
}

// ── Hybrid Verdict ─────────────────────────────────────────────────────────
function hybridVerdict(dfa, hf) {
  let credScore = 50;
  const parts = [];
  if (dfa) {
    credScore = dfa.credibilityScore;
    if (dfa.categories?.CONSPIRACY?.count > 0) credScore -= 18;
    if (dfa.categories?.CLICKBAIT?.count >= 3) credScore -= 10;
    if (dfa.categories?.CREDIBLE?.count >= 2) credScore += 8;
    credScore = clamp(credScore, 0, 100);
    parts.push(`DFA: <strong>${dfa.credibilityScore}% credibility</strong>, ${dfa.matches?.length || 0} pattern(s) matched`);
  }
  if (hf) {
    const hfCred = hf.realScore;
    if (dfa) {
      credScore = Math.round(credScore * 0.5 + hfCred * 0.5);
    } else {
      credScore = hfCred;
    }
    credScore = clamp(credScore, 0, 100);
    parts.push(`BERT: <strong>${hf.realScore}% real / ${hf.fakeScore}% fake</strong>`);
  }
  let label, color, icon;
  if      (credScore >= 72) { label = "LIKELY REAL"; color = "real";     icon = "✅"; }
  else if (credScore >= 52) { label = "UNCERTAIN";   color = "uncertain"; icon = "⚠️"; }
  else if (credScore >= 30) { label = "LIKELY FAKE"; color = "fake";     icon = "🚨"; }
  else                      { label = "FAKE NEWS";   color = "fake";     icon = "❌"; }
  
  const summary = `Hybrid credibility score: <strong>${credScore}%</strong>. ${parts.join(" · ")}.`;
  return { score: credScore, label, color, icon, summary };
}

// ── Render ─────────────────────────────────────────────────────────────────
function renderResults(dfa, hf, verdict) {
  const resultsSec = document.getElementById("resultsSection");
  if (resultsSec) {
    resultsSec.style.cssText = "display:flex; flex-direction:column; gap:18px;";
  }

  const banner = document.getElementById("verdictBanner");
  if (banner) banner.className = `verdict-banner ${verdict.color}`;
  
  const emojiEl = document.getElementById("verdictEmoji");
  if (emojiEl) emojiEl.textContent = verdict.icon;
  
  const textEl = document.getElementById("verdictText");
  if (textEl) textEl.textContent = verdict.label;

  const arc = document.getElementById("scoreArc");
  const lbl = document.getElementById("scoreLabel");
  const circ = 238.76;
  if (arc) {
    arc.style.stroke = verdict.color === "real" ? "#10b981" : verdict.color === "fake" ? "#ef4444" : "#f59e0b";
  }
  setTimeout(() => {
    if (arc) arc.style.strokeDashoffset = circ - (verdict.score / 100) * circ;
    if (lbl) animNum(lbl, 0, verdict.score, 1100, "%");
  }, 80);

  const dfaStatChip = document.getElementById("dfaStatChip");
  if (dfa) {
    if (dfaStatChip) dfaStatChip.textContent = `${dfa.matches?.length || 0} patterns · ${dfa.fakeScore}% risk`;
    renderDFAVisualizer(dfa);
    renderCatGrid(dfa);
    renderMatches(dfa);
  } else {
    if (dfaStatChip) dfaStatChip.textContent = "not run";
    const dfaTrack = document.getElementById("dfaTrack");
    if (dfaTrack) dfaTrack.innerHTML = `<span style="color:var(--dim);font-size:12px;padding:4px">DFA disabled</span>`;
    const catGrid = document.getElementById("catGrid");
    if (catGrid) catGrid.innerHTML = "";
    const matchesList = document.getElementById("matchesList");
    if (matchesList) matchesList.innerHTML = `<span style="color:var(--dim);font-size:12px">–</span>`;
  }

  const aiStatChip = document.getElementById("aiStatChip");
  const aiAnalysis = document.getElementById("aiAnalysis");
  if (hf) {
    const statColor = hf.label === "REAL" ? "var(--green)" : "var(--red)";
    if (aiStatChip) {
      aiStatChip.textContent = `${hf.label} (${Math.max(hf.realScore, hf.fakeScore)}% conf.)`;
      aiStatChip.style.color = statColor;
    }
    setTimeout(() => {
      setBar("b-cred", "v-cred", hf.realScore);
      setBar("b-sens", "v-sens", hf.fakeScore);
      setBar("b-bias", "v-bias", dfa ? dfa.credibilityScore : 50);
    }, 150);

    const verdictLine = hf.label === "REAL"
      ? `<span style="color:var(--green);font-weight:700">✓ BERT classified this as REAL news</span> with <strong>${hf.realScore}% confidence</strong>.`
      : `<span style="color:var(--red);font-weight:700">✗ BERT classified this as FAKE news</span> with <strong>${hf.fakeScore}% confidence</strong>.`;
    
    if (aiAnalysis) {
      aiAnalysis.innerHTML = `
        <p style="margin-bottom:10px">${verdictLine}</p>
        <p style="color:var(--muted);font-size:12px">
          The BERT model (<code style="color:var(--cyan);font-family:var(--mono)">mrm8488/bert-tiny-finetuned-fake-news-detection</code>)
          was fine-tuned on a labelled fake-news dataset. It analyses linguistic and semantic patterns
          in the text to determine authenticity.
        </p>
        <div style="margin-top:12px;display:flex;gap:10px">
          <span style="background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.3);color:var(--green);
            font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px">
            REAL ${hf.realScore}%
          </span>
          <span style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:var(--red);
            font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px">
            FAKE ${hf.fakeScore}%
          </span>
        </div>`;
    }
  } else {
    if (aiStatChip) aiStatChip.textContent = "not run";
    if (aiAnalysis) {
      aiAnalysis.innerHTML = `<p style="color:var(--dim)">HuggingFace AI not enabled — enter your free token and re-analyze.</p>`;
    }
  }

  const summaryBody = document.getElementById("summaryBody");
  const summaryCard = document.getElementById("summaryCard");
  if (summaryBody) summaryBody.innerHTML = verdict.summary;
  if (summaryCard) summaryCard.style.display = "block";
}

// ── DFA Rendering ──────────────────────────────────────────────────────────
function renderDFAVisualizer(dfa) {
  const track = document.getElementById("dfaTrack");
  if (!track || !dfa) return;
  
  const activeStates = new Set(["S0", "ACC"]);
  if (dfa.categories?.CLICKBAIT?.count) activeStates.add("S1");
  if (dfa.categories?.ABSOLUTE?.count) activeStates.add("S2");
  if (dfa.categories?.EMOTIONAL?.count) activeStates.add("S3");
  if (dfa.categories?.CONSPIRACY?.count) activeStates.add("S4");
  
  const nodes = [
    { id:"S0",  label:"S0", hint:"Start"     },
    { id:"S1",  label:"S1", hint:"Clickbait" },
    { id:"S2",  label:"S2", hint:"Absolute"  },
    { id:"S3",  label:"S3", hint:"Emotional" },
    { id:"S4",  label:"S4", hint:"Conspiracy"},
    { id:"ACC", label:"✓",  hint:"Decide"    },
  ];
  
  const nodeClass = (id) => {
    if (!activeStates.has(id)) return "dfa-node state-idle";
    if (id === "S0")  return "dfa-node state-start";
    if (id === "ACC") return "dfa-node state-ok";
    if (id === "S4")  return "dfa-node state-flag";
    return "dfa-node state-warn";
  };
  
  track.innerHTML = nodes.map((n, i) => {
    const arrow = i < nodes.length - 1
      ? `<div class="dfa-arrow${(activeStates.has(n.id) && activeStates.has(nodes[i+1].id)) ? " active-arrow" : ""}"></div>`
      : "";
    return `<div class="dfa-state" title="${n.hint}"><div class="${nodeClass(n.id)}">${n.label}</div></div>${arrow}`;
  }).join("");
  
  setTimeout(() => {
    const last = track.querySelector(".dfa-node:not(.state-idle)");
    if (last) last.classList.add("state-active");
  }, 600);
}

function renderCatGrid(dfa) {
  const grid = document.getElementById("catGrid");
  if (!grid || !dfa) return;
  
  const cats = [
    { key:"CLICKBAIT",  label:"Clickbait",  cls:"c-orange" },
    { key:"ABSOLUTE",   label:"Absolute",   cls:"c-orange" },
    { key:"EMOTIONAL",  label:"Emotional",  cls:"c-red"    },
    { key:"CONSPIRACY", label:"Conspiracy", cls:"c-red"    },
    { key:"CREDIBLE",   label:"Credible",   cls:"c-green"  },
  ];
  
  grid.innerHTML = cats.map(c => {
    const n = dfa.categories?.[c.key]?.count || 0;
    return `<div class="cat-item">
      <div class="cat-name">${c.label}</div>
      <div class="cat-count ${n > 0 ? c.cls : ''}">${n}</div>
    </div>`;
  }).join("");
}

function renderMatches(dfa) {
  const matchesList = document.getElementById("matchesList");
  if (!matchesList || !dfa) return;
  
  if (!dfa.matches || !dfa.matches.length) {
    matchesList.innerHTML = `<span style="color:var(--green);font-size:12px;font-weight:600">✓ No suspicious patterns detected</span>`;
    return;
  }
  const clr = { CLICKBAIT:"mtag-orange", ABSOLUTE:"mtag-blue", EMOTIONAL:"mtag-orange", CONSPIRACY:"mtag-red", CREDIBLE:"mtag-blue" };
  matchesList.innerHTML = dfa.matches.map(m => `<span class="match-tag ${clr[m.cat]||'mtag-blue'}" title="${m.cat}">${esc(m.label)}</span>`).join("");
}

// ── Utilities ──────────────────────────────────────────────────────────────
function setBar(barId, valId, pct) {
  const bar = document.getElementById(barId);
  const val = document.getElementById(valId);
  if (bar) bar.style.width = pct + "%";
  if (val) val.textContent = pct + "%";
}

function animNum(el, from, to, ms, sfx = "") {
  const t0 = performance.now();
  const f = (now) => {
    const p = Math.min((now - t0) / ms, 1);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))) + sfx;
    if (p < 1) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(v))); }

function esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── UI Helpers ─────────────────────────────────────────────────────────────
function hideAll() {
  ["resultsSection","errorSection","loadingSection"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  ["ls1","ls2","ls3"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.className = "lstep";
  });
}

function showLoading() { 
  const el = document.getElementById("loadingSection");
  if (el) el.style.display = "block"; 
}

function hideLoading()  { 
  const el = document.getElementById("loadingSection");
  if (el) el.style.display = "none"; 
}

function setStep(n, s)  { 
  const el = document.getElementById(`ls${n}`);
  if (el) el.className = `lstep ${s}`; 
}

function showErr(title, body) {
  const errTitle = document.getElementById("errTitle");
  const errBody = document.getElementById("errBody");
  const errorSection = document.getElementById("errorSection");
  
  if (errTitle) errTitle.textContent = title;
  if (errBody) errBody.innerHTML = body;
  if (errorSection) errorSection.style.display = "block";
}

function resetAll() {
  hideAll();
  const btn = document.getElementById("analyzeBtn");
  if (btn) btn.disabled = false;
}

function copyResult() {
  const r = ST.lastResult;
  if (!r) return;
  let t = `TruthLens Report\n================\n`;
  t += `Verdict: ${r.verdict.label} (${r.verdict.score}% credibility)\n\n`;
  if (r.dfaResult) {
    t += `DFA Engine:\n  Fake risk: ${r.dfaResult.fakeScore}%\n`;
    t += `  Patterns: ${r.dfaResult.matches.map(m=>m.label).join(", ") || "none"}\n\n`;
  }
  if (r.hfResult) {
    t += `HuggingFace BERT:\n  Real: ${r.hfResult.realScore}% | Fake: ${r.hfResult.fakeScore}%\n`;
    t += `  Classification: ${r.hfResult.label}\n`;
  }
  navigator.clipboard.writeText(t).then(() => {
    const btn = document.querySelector(".btn-copy");
    if (!btn) return;
    const o = btn.textContent;
    btn.textContent = "✓ Copied!";
    setTimeout(() => btn.textContent = o, 1800);
  });
}