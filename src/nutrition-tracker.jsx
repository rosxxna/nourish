import { useState, useEffect, useRef, useCallback } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = "nourish_data";
const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } };
const save = (d) => localStorage.setItem(STORAGE_KEY, JSON.stringify(d));

function calcBMR({ gender, weight, height, age }) {
  const w = parseFloat(weight), h = parseFloat(height), a = parseFloat(age);
  if (!w || !h || !a) return 0;
  if (gender === "female") return 10 * w + 6.25 * h - 5 * a - 161;
  return 10 * w + 6.25 * h - 5 * a + 5;
}

const ACTIVITY = {
  sedentary: { label: "Sedentary", sub: "Little / no exercise", mult: 1.2 },
  light: { label: "Lightly Active", sub: "1–3 days/week", mult: 1.375 },
  moderate: { label: "Moderately Active", sub: "3–5 days/week", mult: 1.55 },
  very: { label: "Very Active", sub: "6–7 days/week", mult: 1.725 },
  extra: { label: "Extra Active", sub: "Physical job + gym", mult: 1.9 },
};

const GOAL_ADJ = { lose: -500, maintain: 0, gain: 300 };
const GOAL_LABELS = { lose: "Lose Weight", maintain: "Maintain", gain: "Gain Muscle" };
const GOAL_MACROS = {
  lose: { protein: 0.4, carbs: 0.35, fat: 0.25 },
  maintain: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  gain: { protein: 0.35, carbs: 0.45, fat: 0.2 },
};

function calcTargets(profile) {
  const bmr = calcBMR(profile);
  if (!bmr) return null;
  const tdee = bmr * (ACTIVITY[profile.activity]?.mult || 1.55);
  const calories = Math.round(tdee + (GOAL_ADJ[profile.goal] || 0));
  const m = GOAL_MACROS[profile.goal] || GOAL_MACROS.maintain;
  return {
    calories,
    protein: Math.round((calories * m.protein) / 4),
    carbs: Math.round((calories * m.carbs) / 4),
    fat: Math.round((calories * m.fat) / 9),
  };
}

// ── AI API call ───────────────────────────────────────────────────────────────
async function analyzeFood(prompt, imageBase64 = null) {
  const content = [];
  if (imageBase64) {
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } });
  }
  content.push({
    type: "text",
    text: `You are a nutrition expert. Analyze the following and return ONLY a JSON object (no markdown, no extra text) with this exact structure:
{
  "name": "Meal/Food name",
  "calories": number,
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams),
  "items": ["ingredient 1 with kcal", "ingredient 2 with kcal"],
  "cookingNote": "brief note about cooking method effect if relevant"
}

${imageBase64 ? "Analyze the food in this image." : `Analyze: ${prompt}`}

Account for cooking methods mentioned (frying adds ~80-120 kcal per tbsp oil, air fryer minimal oil, oven roasting minimal oil, non-stick pan minimal oil). Be accurate and realistic.`,
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content }],
    }),
  });
  const data = await response.json();
  const text = data.content?.map((i) => i.text || "").join("") || "";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ── Styles ────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --sage: #7A9E7E;
    --sage-light: #A8C5AC;
    --sage-pale: #E8F0E9;
    --blush: #E8B4A0;
    --blush-light: #F5D5C8;
    --cream: #FAF7F2;
    --warm-white: #FFFDF9;
    --brown: #8B6F5E;
    --text: #3D3530;
    --text-soft: #7A6E69;
    --text-muted: #A69E9A;
    --border: #E8E0D8;
    --shadow: rgba(61,53,48,0.08);
    --card: #FFFFFF;
    --fasting: #9B8EC4;
    --fasting-light: #E8E4F5;
  }

  body { font-family: 'DM Sans', sans-serif; background: var(--cream); color: var(--text); }

  .app { min-height: 100vh; max-width: 430px; margin: 0 auto; background: var(--cream); position: relative; overflow-x: hidden; }

  /* Nav */
  .bottom-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 430px; background: var(--warm-white); border-top: 1px solid var(--border); display: flex; z-index: 100; padding: 8px 0 20px; }
  .nav-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; background: none; border: none; cursor: pointer; padding: 6px 0; transition: all 0.2s; }
  .nav-icon { font-size: 22px; line-height: 1; transition: transform 0.2s; }
  .nav-label { font-size: 10px; font-weight: 500; color: var(--text-muted); transition: color 0.2s; letter-spacing: 0.3px; }
  .nav-btn.active .nav-label { color: var(--sage); }
  .nav-btn.active .nav-icon { transform: scale(1.15); }

  /* Scroll area */
  .screen { padding: 0 0 100px; min-height: 100vh; }

  /* Header */
  .page-header { padding: 52px 24px 20px; }
  .page-header h1 { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700; color: var(--text); line-height: 1.2; }
  .page-header p { font-size: 14px; color: var(--text-soft); margin-top: 4px; }
  .greeting-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--sage-pale); border-radius: 20px; padding: 4px 12px; font-size: 12px; color: var(--sage); font-weight: 500; margin-bottom: 8px; }

  /* Cards */
  .card { background: var(--card); border-radius: 20px; padding: 20px; margin: 0 16px 12px; box-shadow: 0 2px 12px var(--shadow); }
  .card-sm { background: var(--card); border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px var(--shadow); }

  /* Calorie ring */
  .ring-wrap { display: flex; flex-direction: column; align-items: center; padding: 8px 0; }
  .ring-svg { overflow: visible; }
  .ring-bg { fill: none; stroke: var(--sage-pale); stroke-width: 10; }
  .ring-fill { fill: none; stroke: var(--sage); stroke-width: 10; stroke-linecap: round; transition: stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1); transform-origin: center; transform: rotate(-90deg); }
  .ring-center { text-align: center; margin-top: -8px; }
  .ring-cal { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 700; color: var(--text); line-height: 1; }
  .ring-label { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

  /* Macro bars */
  .macro-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
  .macro-item { text-align: center; }
  .macro-bar-wrap { height: 4px; background: var(--border); border-radius: 2px; margin: 6px 0 4px; overflow: hidden; }
  .macro-bar { height: 100%; border-radius: 2px; transition: width 0.6s ease; }
  .macro-name { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .macro-val { font-size: 16px; font-weight: 600; color: var(--text); }
  .macro-goal { font-size: 11px; color: var(--text-muted); }

  /* Log entries */
  .meal-entry { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
  .meal-entry:last-child { border-bottom: none; }
  .meal-icon-wrap { width: 40px; height: 40px; border-radius: 12px; background: var(--sage-pale); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
  .meal-info { flex: 1; min-width: 0; }
  .meal-name { font-size: 14px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .meal-macros { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
  .meal-cal { font-size: 15px; font-weight: 600; color: var(--sage); }
  .delete-btn { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 16px; padding: 4px; opacity: 0.5; transition: opacity 0.2s; }
  .delete-btn:hover { opacity: 1; }

  /* Fasting */
  .fast-ring-wrap { display: flex; flex-direction: column; align-items: center; padding: 4px 0 12px; }
  .fast-ring-fill { fill: none; stroke: var(--fasting); stroke-width: 10; stroke-linecap: round; transition: stroke-dashoffset 1s cubic-bezier(.4,0,.2,1); transform-origin: center; transform: rotate(-90deg); }
  .fast-ring-bg { fill: none; stroke: var(--fasting-light); stroke-width: 10; }
  .fast-center { text-align: center; margin-top: -8px; }
  .fast-time { font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; color: var(--text); }
  .fast-status { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
  .fast-goal-label { font-size: 13px; color: var(--fasting); font-weight: 500; }

  .goal-pills { display: flex; gap: 8px; justify-content: center; margin: 12px 0; }
  .goal-pill { padding: 6px 16px; border-radius: 20px; border: 1.5px solid var(--fasting-light); background: none; font-size: 13px; font-weight: 500; color: var(--fasting); cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif; }
  .goal-pill.active { background: var(--fasting); color: white; border-color: var(--fasting); }

  .fast-btn { width: 100%; padding: 14px; border-radius: 14px; border: none; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-top: 4px; }
  .fast-btn-start { background: var(--fasting); color: white; }
  .fast-btn-start:hover { opacity: 0.9; }
  .fast-btn-stop { background: var(--fasting-light); color: var(--fasting); }

  .fast-history { display: flex; flex-direction: column; gap: 8px; }
  .fast-log-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--fasting-light); border-radius: 12px; }
  .fast-log-dur { font-weight: 600; color: var(--fasting); font-size: 15px; }
  .fast-log-date { font-size: 12px; color: var(--text-muted); }
  .fast-log-goal { font-size: 12px; color: white; background: var(--fasting); padding: 2px 8px; border-radius: 10px; }

  /* Add food */
  .method-tabs { display: flex; gap: 8px; padding: 0 16px; margin-bottom: 16px; overflow-x: auto; scrollbar-width: none; }
  .method-tab { flex-shrink: 0; padding: 8px 16px; border-radius: 20px; border: 1.5px solid var(--border); background: none; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; color: var(--text-soft); cursor: pointer; transition: all 0.2s; white-space: nowrap; }
  .method-tab.active { background: var(--sage); color: white; border-color: var(--sage); }

  .input-group { margin-bottom: 14px; }
  .input-label { font-size: 12px; font-weight: 500; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 6px; }
  .input-field { width: 100%; padding: 12px 14px; border: 1.5px solid var(--border); border-radius: 12px; font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--text); background: var(--warm-white); outline: none; transition: border-color 0.2s; }
  .input-field:focus { border-color: var(--sage); }
  textarea.input-field { resize: vertical; min-height: 80px; }

  .cooking-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .cooking-chip { padding: 6px 12px; border-radius: 20px; border: 1.5px solid var(--border); background: none; font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text-soft); cursor: pointer; transition: all 0.2s; }
  .cooking-chip.active { background: var(--blush-light); border-color: var(--blush); color: var(--brown); }

  .ai-btn { width: 100%; padding: 15px; border-radius: 14px; border: none; background: linear-gradient(135deg, var(--sage) 0%, var(--sage-light) 100%); color: white; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .ai-btn:hover { opacity: 0.9; }
  .ai-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  /* AI result */
  .result-card { background: linear-gradient(135deg, var(--sage-pale) 0%, var(--blush-light) 100%); border-radius: 16px; padding: 18px; margin-top: 14px; }
  .result-name { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 12px; }
  .result-macros { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
  .result-macro { text-align: center; background: white; border-radius: 12px; padding: 10px 6px; }
  .result-macro-val { font-size: 18px; font-weight: 700; color: var(--text); }
  .result-macro-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-top: 2px; }
  .result-note { font-size: 12px; color: var(--text-soft); font-style: italic; margin-bottom: 12px; }
  .result-items { font-size: 12px; color: var(--text-soft); }
  .result-item { padding: 3px 0; }
  .add-meal-btn { width: 100%; padding: 12px; border-radius: 12px; border: none; background: var(--sage); color: white; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 12px; }

  /* Profile */
  .section-title { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 14px; }
  .select-field { width: 100%; padding: 12px 14px; border: 1.5px solid var(--border); border-radius: 12px; font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--text); background: var(--warm-white); outline: none; appearance: none; cursor: pointer; }
  .select-field:focus { border-color: var(--sage); }

  .activity-grid { display: flex; flex-direction: column; gap: 8px; }
  .activity-opt { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1.5px solid var(--border); border-radius: 12px; cursor: pointer; transition: all 0.2s; background: var(--warm-white); }
  .activity-opt.active { border-color: var(--sage); background: var(--sage-pale); }
  .activity-opt-label { font-size: 14px; font-weight: 500; color: var(--text); }
  .activity-opt-sub { font-size: 12px; color: var(--text-muted); margin-top: 1px; }
  .activity-check { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
  .activity-opt.active .activity-check { background: var(--sage); border-color: var(--sage); }

  .goal-grid { display: flex; gap: 8px; }
  .goal-opt { flex: 1; padding: 14px 8px; border: 1.5px solid var(--border); border-radius: 14px; text-align: center; cursor: pointer; transition: all 0.2s; background: var(--warm-white); }
  .goal-opt.active { border-color: var(--blush); background: var(--blush-light); }
  .goal-opt-icon { font-size: 22px; display: block; margin-bottom: 4px; }
  .goal-opt-label { font-size: 13px; font-weight: 500; color: var(--text); }

  .save-btn { width: 100%; padding: 15px; border-radius: 14px; border: none; background: var(--sage); color: white; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
  .save-btn:hover { opacity: 0.9; }

  .targets-banner { background: linear-gradient(135deg, var(--sage) 0%, #5A8A60 100%); border-radius: 18px; padding: 20px; color: white; margin-bottom: 12px; }
  .targets-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
  .target-item { text-align: center; }
  .target-val { font-size: 20px; font-weight: 700; }
  .target-label { font-size: 10px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 2px; }

  /* Camera upload */
  .camera-zone { border: 2px dashed var(--sage-light); border-radius: 16px; padding: 32px 20px; text-align: center; cursor: pointer; transition: all 0.2s; background: var(--sage-pale); position: relative; }
  .camera-zone:hover { background: var(--sage-pale); border-color: var(--sage); }
  .camera-zone input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .camera-icon { font-size: 36px; display: block; margin-bottom: 8px; }
  .camera-text { font-size: 14px; color: var(--text-soft); }
  .camera-sub { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
  .preview-img { width: 100%; border-radius: 12px; margin-bottom: 12px; max-height: 200px; object-fit: cover; }

  /* Saved meals */
  .saved-meal { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--warm-white); border: 1.5px solid var(--border); border-radius: 14px; cursor: pointer; transition: all 0.2s; }
  .saved-meal:hover { border-color: var(--sage); background: var(--sage-pale); }
  .saved-meal-info { flex: 1; }
  .saved-meal-name { font-size: 14px; font-weight: 500; color: var(--text); }
  .saved-meal-macros { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
  .saved-meal-cal { font-size: 15px; font-weight: 600; color: var(--sage); }

  /* Spinner */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }

  /* Empty state */
  .empty { text-align: center; padding: 32px 20px; color: var(--text-muted); }
  .empty-icon { font-size: 40px; display: block; margin-bottom: 8px; }
  .empty-text { font-size: 14px; }

  /* Toast */
  @keyframes slideUp { from { transform: translateY(20px); opacity:0; } to { transform: translateY(0); opacity:1; } }
  .toast { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); background: var(--text); color: white; padding: 10px 20px; border-radius: 20px; font-size: 13px; font-weight: 500; z-index: 200; animation: slideUp 0.3s ease; white-space: nowrap; }

  .gender-row { display: flex; gap: 8px; }
  .gender-opt { flex: 1; padding: 12px; border: 1.5px solid var(--border); border-radius: 12px; text-align: center; cursor: pointer; transition: all 0.2s; background: var(--warm-white); font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; color: var(--text); }
  .gender-opt.active { border-color: var(--blush); background: var(--blush-light); }

  .section-divider { height: 1px; background: var(--border); margin: 16px 0; }

  .streak-row { display: flex; gap: 8px; margin-top: 12px; }
  .streak-day { flex: 1; text-align: center; }
  .streak-dot { width: 28px; height: 28px; border-radius: 50%; margin: 0 auto 4px; display: flex; align-items: center; justify-content: center; font-size: 12px; }
  .streak-dot.done { background: var(--fasting); color: white; }
  .streak-dot.missed { background: var(--border); color: var(--text-muted); }
  .streak-day-label { font-size: 10px; color: var(--text-muted); }

  .window-info { display: flex; justify-content: space-between; margin-top: 12px; padding: 10px 14px; background: var(--fasting-light); border-radius: 12px; }
  .window-item { text-align: center; }
  .window-val { font-size: 14px; font-weight: 600; color: var(--fasting); }
  .window-label { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
`;

// ── Components ────────────────────────────────────────────────────────────────
function CircleRing({ pct, color = "#7A9E7E", bg = "#E8F0E9", size = 160, stroke = 10 }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 1) * circ);
  return (
    <svg width={size} height={size} className="ring-svg">
      <circle className="ring-bg" cx={size/2} cy={size/2} r={r} style={{stroke: bg, strokeWidth: stroke}} />
      <circle cx={size/2} cy={size/2} r={r}
        style={{ fill:"none", stroke: color, strokeWidth: stroke, strokeLinecap:"round",
          strokeDasharray: circ, strokeDashoffset: offset,
          transition: "stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)",
          transformOrigin:"center", transform:"rotate(-90deg)" }} />
    </svg>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const stored = load();
  const [tab, setTab] = useState("home");
  const [profile, setProfile] = useState(stored.profile || { gender:"female", age:"", weight:"", height:"", activity:"moderate", goal:"maintain" });
  const [log, setLog] = useState(stored.log || []);
  const [fastLog, setFastLog] = useState(stored.fastLog || []);
  const [fasting, setFasting] = useState(stored.fasting || null); // {start, goal}
  const [toast, setToast] = useState(null);
  const [addMethod, setAddMethod] = useState("type");
  const [typeInput, setTypeInput] = useState("");
  const [cookingMethod, setCookingMethod] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [fastNow, setFastNow] = useState(Date.now());
  const [fastGoal, setFastGoal] = useState(stored.fastGoal || 16);
  const fileRef = useRef();

  const targets = calcTargets(profile);
  const today = new Date().toDateString();
  const todayLog = log.filter(e => new Date(e.ts).toDateString() === today);
  const consumed = todayLog.reduce((a, e) => ({ cal: a.cal + e.calories, p: a.p + e.protein, c: a.c + e.carbs, f: a.f + e.fat }), { cal:0, p:0, c:0, f:0 });

  useEffect(() => {
    const id = setInterval(() => setFastNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    save({ profile, log, fastLog, fasting, fastGoal });
  }, [profile, log, fastLog, fasting, fastGoal]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const handleAnalyze = async () => {
    if (!typeInput && !imageBase64) return;
    setAnalyzing(true); setResult(null);
    try {
      const prompt = typeInput + (cookingMethod ? ` (cooking method: ${cookingMethod})` : "");
      const r = await analyzeFood(prompt, imageBase64);
      setResult(r);
    } catch { showToast("Couldn't analyze — try again!"); }
    setAnalyzing(false);
  };

  const handleAddToLog = () => {
    if (!result) return;
    const entry = { ...result, ts: Date.now(), id: Math.random().toString(36).slice(2) };
    setLog(prev => [entry, ...prev]);
    setResult(null); setTypeInput(""); setImagePreview(null); setImageBase64(null); setCookingMethod("");
    showToast(`✓ ${result.name} added!`);
    setTab("home");
  };

  const handleImage = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const full = ev.target.result;
      setImagePreview(full);
      setImageBase64(full.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const fastElapsed = fasting ? (fastNow - fasting.start) : 0;
  const fastHours = fastElapsed / 3600000;
  const fastPct = fasting ? Math.min(fastHours / fasting.goal, 1) : 0;

  const formatFastTime = (ms) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const startFast = () => {
    setFasting({ start: Date.now(), goal: fastGoal });
    showToast(`🌙 ${fastGoal}h fast started!`);
  };

  const stopFast = () => {
    if (!fasting) return;
    const dur = (Date.now() - fasting.start) / 3600000;
    const completed = dur >= fasting.goal;
    setFastLog(prev => [{ date: new Date().toLocaleDateString(), dur: dur.toFixed(1), goal: fasting.goal, completed }, ...prev.slice(0,6)]);
    setFasting(null);
    showToast(completed ? `🎉 Fast completed! ${dur.toFixed(1)}h` : `Fast ended at ${dur.toFixed(1)}h`);
  };

  // Saved meals (derived from log, deduplicated by name)
  const savedMeals = Object.values(log.reduce((acc, e) => {
    if (!acc[e.name]) acc[e.name] = e; return acc;
  }, {})).slice(0, 8);

  const profileComplete = profile.age && profile.weight && profile.height;

  return (
    <div className="app">
      <style>{CSS}</style>
      {toast && <div className="toast">{toast}</div>}

      {/* ── HOME ── */}
      {tab === "home" && (
        <div className="screen">
          <div className="page-header">
            <div className="greeting-chip">🌿 Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"}</div>
            <h1>Today's<br/>Nutrition</h1>
            <p>{new Date().toLocaleDateString("en-US", {weekday:"long", month:"long", day:"numeric"})}</p>
          </div>

          {!profileComplete && (
            <div className="card" style={{background:"linear-gradient(135deg,#E8F0E9,#F5D5C8)", border:"none", cursor:"pointer"}} onClick={() => setTab("profile")}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:28}}>👤</span>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>Set up your profile</div>
                  <div style={{fontSize:12,color:"var(--text-soft)"}}>Get personalized calorie & macro targets</div>
                </div>
                <span style={{marginLeft:"auto",color:"var(--sage)",fontSize:18}}>→</span>
              </div>
            </div>
          )}

          {targets && (
            <div className="card">
              <div className="ring-wrap">
                <CircleRing pct={consumed.cal / targets.calories} size={160} stroke={10} />
                <div className="ring-center" style={{marginTop:-96}}>
                  <div className="ring-cal">{consumed.cal}</div>
                  <div className="ring-label">of {targets.calories} kcal</div>
                </div>
              </div>
              <div style={{height:96}} />
              <div className="macro-row">
                {[
                  {n:"Protein", v:consumed.p, g:targets.protein, c:"#7A9E7E"},
                  {n:"Carbs", v:consumed.c, g:targets.carbs, c:"#E8B4A0"},
                  {n:"Fat", v:consumed.f, g:targets.fat, c:"#9B8EC4"},
                ].map(m => (
                  <div className="macro-item" key={m.n}>
                    <div className="macro-val">{m.v}g</div>
                    <div className="macro-bar-wrap"><div className="macro-bar" style={{width:`${Math.min(m.v/m.g,1)*100}%`,background:m.c}} /></div>
                    <div className="macro-name">{m.n}</div>
                    <div className="macro-goal">/ {m.g}g</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's meals */}
          <div className="card">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:600}}>Today's Meals</div>
              <button onClick={() => setTab("add")} style={{background:"var(--sage)",color:"white",border:"none",borderRadius:10,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Add</button>
            </div>
            {todayLog.length === 0 ? (
              <div className="empty"><span className="empty-icon">🥗</span><span className="empty-text">No meals logged yet today</span></div>
            ) : todayLog.map(e => (
              <div className="meal-entry" key={e.id}>
                <div className="meal-icon-wrap">🍽️</div>
                <div className="meal-info">
                  <div className="meal-name">{e.name}</div>
                  <div className="meal-macros">P {e.protein}g · C {e.carbs}g · F {e.fat}g</div>
                </div>
                <div className="meal-cal">{e.calories}</div>
                <button className="delete-btn" onClick={() => setLog(prev => prev.filter(x => x.id !== e.id))}>✕</button>
              </div>
            ))}
          </div>

          {/* Fasting mini */}
          {fasting && (
            <div className="card" style={{background:"linear-gradient(135deg,var(--fasting-light),#F0EDF8)"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:28}}>🌙</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:600,color:"var(--fasting)"}}>Fasting — {formatFastTime(fastElapsed)}</div>
                  <div style={{fontSize:12,color:"var(--text-muted)",marginTop:2}}>Goal: {fasting.goal}h · {Math.round(fastPct*100)}% complete</div>
                  <div style={{height:4,background:"#D8D0F0",borderRadius:2,marginTop:8,overflow:"hidden"}}>
                    <div style={{height:"100%",background:"var(--fasting)",borderRadius:2,width:`${fastPct*100}%`,transition:"width 1s"}} />
                  </div>
                </div>
                <button onClick={() => setTab("fast")} style={{background:"var(--fasting)",color:"white",border:"none",borderRadius:10,padding:"6px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>View</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ADD FOOD ── */}
      {tab === "add" && (
        <div className="screen">
          <div className="page-header">
            <h1>Log Food</h1>
            <p>AI-powered nutrition analysis</p>
          </div>
          <div className="method-tabs">
            {[{id:"type",label:"✏️ Type"},{id:"camera",label:"📷 Camera"},{id:"saved",label:"⭐ Saved"}].map(m => (
              <button key={m.id} className={`method-tab ${addMethod===m.id?"active":""}`} onClick={() => { setAddMethod(m.id); setResult(null); }}>{m.label}</button>
            ))}
          </div>

          <div style={{padding:"0 16px"}}>
            {addMethod === "type" && (
              <>
                <div className="input-group">
                  <div className="input-label">Ingredients & amounts</div>
                  <textarea className="input-field" placeholder="e.g. 2 eggs, 1 cup rice, 100g chicken breast, 1 tbsp olive oil..." value={typeInput} onChange={e => setTypeInput(e.target.value)} />
                </div>
                <div className="input-group">
                  <div className="input-label">Cooking Method</div>
                  <div className="cooking-chips">
                    {["Frying with oil","Non-stick pan","Air fryer","Oven baked","Steamed","Raw / No cook","Store bought"].map(c => (
                      <button key={c} className={`cooking-chip ${cookingMethod===c?"active":""}`} onClick={() => setCookingMethod(prev => prev===c?"":c)}>{c}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {addMethod === "camera" && (
              <>
                <div className="camera-zone" onClick={() => fileRef.current?.click()}>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImage} />
                  {imagePreview ? <img src={imagePreview} alt="preview" className="preview-img" /> : <>
                    <span className="camera-icon">📷</span>
                    <div className="camera-text">Tap to take a photo or upload</div>
                    <div className="camera-sub">AI will identify the food & nutrition</div>
                  </>}
                </div>
                {imagePreview && (
                  <div className="input-group" style={{marginTop:12}}>
                    <div className="input-label">Add details (optional)</div>
                    <input className="input-field" placeholder="e.g. portion size, cooking method..." value={typeInput} onChange={e => setTypeInput(e.target.value)} />
                  </div>
                )}
              </>
            )}

            {addMethod === "saved" && (
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {savedMeals.length === 0 ? (
                  <div className="empty"><span className="empty-icon">⭐</span><span className="empty-text">No saved meals yet. Log meals to save them!</span></div>
                ) : savedMeals.map((m, i) => (
                  <div key={i} className="saved-meal" onClick={() => { setLog(prev => [{...m, ts:Date.now(), id:Math.random().toString(36).slice(2)}, ...prev]); showToast(`✓ ${m.name} added!`); setTab("home"); }}>
                    <div style={{fontSize:24}}>🍽️</div>
                    <div className="saved-meal-info">
                      <div className="saved-meal-name">{m.name}</div>
                      <div className="saved-meal-macros">P {m.protein}g · C {m.carbs}g · F {m.fat}g</div>
                    </div>
                    <div className="saved-meal-cal">{m.calories} kcal</div>
                  </div>
                ))}
              </div>
            )}

            {addMethod !== "saved" && (
              <button className="ai-btn" style={{marginTop:16}} onClick={handleAnalyze} disabled={analyzing || (!typeInput && !imageBase64)}>
                {analyzing ? <><div className="spinner"/><span>Analyzing...</span></> : <><span>🔍</span><span>Analyze with AI</span></>}
              </button>
            )}

            {result && (
              <div className="result-card">
                <div className="result-name">{result.name}</div>
                <div className="result-macros">
                  {[{l:"kcal",v:result.calories},{l:"Protein",v:`${result.protein}g`},{l:"Carbs",v:`${result.carbs}g`},{l:"Fat",v:`${result.fat}g`}].map(x => (
                    <div className="result-macro" key={x.l}>
                      <div className="result-macro-val">{x.v}</div>
                      <div className="result-macro-label">{x.l}</div>
                    </div>
                  ))}
                </div>
                {result.cookingNote && <div className="result-note">🍳 {result.cookingNote}</div>}
                {result.items?.length > 0 && (
                  <div className="result-items">
                    {result.items.map((it,i) => <div key={i} className="result-item">• {it}</div>)}
                  </div>
                )}
                <button className="add-meal-btn" onClick={handleAddToLog}>+ Add to Today's Log</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FASTING ── */}
      {tab === "fast" && (
        <div className="screen">
          <div className="page-header">
            <h1>Intermittent<br/>Fasting</h1>
            <p>Track your fasting window</p>
          </div>
          <div className="card">
            <div style={{textAlign:"center",marginBottom:8}}>
              <div style={{fontSize:13,color:"var(--text-muted)",marginBottom:8}}>Fasting Goal</div>
              <div className="goal-pills">
                {[12,14,16].map(h => (
                  <button key={h} className={`goal-pill ${fastGoal===h?"active":""}`} onClick={() => !fasting && setFastGoal(h)}>{h}:00</button>
                ))}
              </div>
            </div>
            <div className="fast-ring-wrap">
              <CircleRing pct={fastPct} color="#9B8EC4" bg="#E8E4F5" size={180} stroke={10} />
              <div style={{marginTop:-104,textAlign:"center"}}>
                {fasting ? <>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:30,fontWeight:700,color:"var(--text)"}}>{formatFastTime(fastElapsed)}</div>
                  <div style={{fontSize:12,color:"var(--text-muted)",marginTop:2}}>elapsed</div>
                  <div style={{fontSize:13,color:"var(--fasting)",fontWeight:500,marginTop:4}}>{Math.round(fastPct*100)}% of {fasting.goal}h</div>
                </> : <>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:30,fontWeight:700,color:"var(--text-muted)"}}>--:--</div>
                  <div style={{fontSize:12,color:"var(--text-muted)",marginTop:2}}>not fasting</div>
                </>}
              </div>
            </div>

            {fasting && (
              <div className="window-info">
                <div className="window-item"><div className="window-val">{new Date(fasting.start).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div><div className="window-label">Started</div></div>
                <div className="window-item"><div className="window-val">{new Date(fasting.start + fasting.goal*3600000).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div><div className="window-label">Goal time</div></div>
                <div className="window-item"><div className="window-val">{Math.max(0, fasting.goal - fastHours).toFixed(1)}h</div><div className="window-label">Remaining</div></div>
              </div>
            )}

            <button className={`fast-btn ${fasting ? "fast-btn-stop" : "fast-btn-start"}`} onClick={fasting ? stopFast : startFast} style={{marginTop:16}}>
              {fasting ? "⏹ End Fast" : `▶ Start ${fastGoal}h Fast`}
            </button>
          </div>

          {fastLog.length > 0 && (
            <div className="card">
              <div className="section-title">History</div>
              <div className="fast-history">
                {fastLog.map((f,i) => (
                  <div key={i} className="fast-log-item">
                    <div>
                      <div className="fast-log-dur">{f.dur}h fasted</div>
                      <div className="fast-log-date">{f.date}</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                      <span className="fast-log-goal">Goal: {f.goal}h</span>
                      <span style={{fontSize:11,color:f.completed?"var(--sage)":"var(--text-muted)",fontWeight:500}}>{f.completed?"✓ Completed":"Partial"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PROFILE ── */}
      {tab === "profile" && (
        <div className="screen">
          <div className="page-header">
            <h1>Your Profile</h1>
            <p>Personalize your nutrition targets</p>
          </div>

          {targets && profileComplete && (
            <div className="targets-banner" style={{margin:"0 16px 12px"}}>
              <div style={{fontSize:13,opacity:0.9,fontWeight:500}}>Your Daily Targets</div>
              <div className="targets-grid">
                <div className="target-item"><div className="target-val">{targets.calories}</div><div className="target-label">kcal</div></div>
                <div className="target-item"><div className="target-val">{targets.protein}g</div><div className="target-label">protein</div></div>
                <div className="target-item"><div className="target-val">{targets.carbs}g</div><div className="target-label">carbs</div></div>
                <div className="target-item"><div className="target-val">{targets.fat}g</div><div className="target-label">fat</div></div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="section-title">Basic Info</div>
            <div className="input-group">
              <div className="input-label">Gender</div>
              <div className="gender-row">
                {["female","male"].map(g => (
                  <button key={g} className={`gender-opt ${profile.gender===g?"active":""}`} onClick={() => setProfile(p => ({...p, gender:g}))}>{g === "female" ? "♀ Female" : "♂ Male"}</button>
                ))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              {[{k:"age",l:"Age",ph:"25",u:""},{k:"weight",l:"Weight",ph:"60",u:"kg"},{k:"height",l:"Height",ph:"165",u:"cm"}].map(f => (
                <div className="input-group" key={f.k}>
                  <div className="input-label">{f.l} {f.u && <span style={{color:"var(--text-muted)"}}>({f.u})</span>}</div>
                  <input className="input-field" type="number" placeholder={f.ph} value={profile[f.k]} onChange={e => setProfile(p => ({...p, [f.k]:e.target.value}))} />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-title">Activity Level</div>
            <div className="activity-grid">
              {Object.entries(ACTIVITY).map(([k,v]) => (
                <div key={k} className={`activity-opt ${profile.activity===k?"active":""}`} onClick={() => setProfile(p => ({...p, activity:k}))}>
                  <div>
                    <div className="activity-opt-label">{v.label}</div>
                    <div className="activity-opt-sub">{v.sub}</div>
                  </div>
                  <div className="activity-check">{profile.activity===k && <span style={{color:"white",fontSize:12}}>✓</span>}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-title">My Goal</div>
            <div className="goal-grid">
              {[{k:"lose",icon:"🔥",l:"Lose Weight"},{k:"maintain",icon:"⚖️",l:"Maintain"},{k:"gain",icon:"💪",l:"Gain Muscle"}].map(g => (
                <div key={g.k} className={`goal-opt ${profile.goal===g.k?"active":""}`} onClick={() => setProfile(p => ({...p, goal:g.k}))}>
                  <span className="goal-opt-icon">{g.icon}</span>
                  <div className="goal-opt-label">{g.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{padding:"0 16px 8px"}}>
            <button className="save-btn" onClick={() => { save({profile,log,fastLog,fasting,fastGoal}); showToast("✓ Profile saved!"); setTab("home"); }}>Save Profile</button>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV ── */}
      <nav className="bottom-nav">
        {[
          {id:"home",icon:"🏠",label:"Home"},
          {id:"add",icon:"➕",label:"Log Food"},
          {id:"fast",icon:"🌙",label:"Fasting"},
          {id:"profile",icon:"👤",label:"Profile"},
        ].map(n => (
          <button key={n.id} className={`nav-btn ${tab===n.id?"active":""}`} onClick={() => setTab(n.id)}>
            <span className="nav-icon">{n.icon}</span>
            <span className="nav-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
