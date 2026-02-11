import { useEffect, useMemo, useState } from "react";
import { useSwipeable } from "react-swipeable";
import { DOLCH, FRY_100 } from "./wordlists";
import { JA } from "./translations";

/* ================== utilities ================== */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeWord(w) {
  return String(w ?? "").trim();
}

function pickMore(list, existingWords, n = 20) {
  const existing = new Set(existingWords.map(normalizeWord));
  const unique = Array.from(new Set(list.map(normalizeWord).filter(Boolean)));
  const candidates = unique.filter((w) => !existing.has(w));
  return shuffle(candidates).slice(0, Math.min(n, candidates.length));
}

function repeatWord(word, n = 20) {
  const w = normalizeWord(word);
  if (!w) return [];
  return Array.from({ length: n }, () => w);
}

function speak(text, lang = "en-US") {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch {
    // ignore
  }
}

/* ================== localStorage (history) ================== */

const STORAGE_KEY = "sightWordsSwipeHistory_v5";

function emptyHistory() {
  return {
    sessions: 0,
    lastStudiedAt: null,
    wordStats: {}, // { [word]: { known, unknown, last } }
  };
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyHistory();
    const parsed = JSON.parse(raw);
    return {
      sessions: Number(parsed.sessions ?? 0),
      lastStudiedAt: parsed.lastStudiedAt ?? null,
      wordStats: typeof parsed.wordStats === "object" && parsed.wordStats ? parsed.wordStats : {},
    };
  } catch {
    return emptyHistory();
  }
}

function saveHistory(h) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
}

function formatJPDateTime(iso) {
  if (!iso) return "なし";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(d);
  } catch {
    return "なし";
  }
}

/* ================== confetti (spark) ================== */

function SparkBurst({ show, seed }) {
  if (!show) return null;
  const colors = ["#ff7ab6", "#7fe7d6", "#bfe8ff", "#ffe066", "#ffffff"];

  return (
    <div className="sparkBurst" key={seed}>
      {Array.from({ length: 42 }).map((_, i) => {
        const left = 10 + Math.random() * 80;
        const bottom = 8 + Math.random() * 12;
        const dx = (Math.random() * 2 - 1) * 120;
        const dy = 420 + Math.random() * 420;
        const size = 7 + Math.random() * 10;
        const dur = 650 + Math.random() * 550;
        const delay = Math.random() * 120;
        const bg = colors[Math.floor(Math.random() * colors.length)];
        return (
          <span
            className="p"
            key={i}
            style={{
              left: `${left}%`,
              bottom: `${bottom}%`,
              width: `${size}px`,
              height: `${size}px`,
              background: bg,
              "--dx": `${dx}px`,
              "--dy": `${dy}px`,
              animationDuration: `${dur}ms`,
              animationDelay: `${delay}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

/* ================== ranking ================== */

function buildWeakRanking(wordStats, topN = 10) {
  const rows = [];

  for (const [word, s] of Object.entries(wordStats || {})) {
    const known = Number(s?.known ?? 0);
    const unknown = Number(s?.unknown ?? 0);
    const total = known + unknown;
    if (total <= 0) continue;

    const unknownRate = unknown / total;
    rows.push({
      word,
      known,
      unknown,
      total,
      unknownRate,
      last: s?.last ?? null,
      ja: JA[word] ?? "（訳未登録）",
    });
  }

  const withMin2 = rows.filter((r) => r.total >= 2);
  const base = withMin2.length >= topN ? withMin2 : rows;

  base.sort((a, b) => {
    if (b.unknownRate !== a.unknownRate) return b.unknownRate - a.unknownRate;
    if (b.total !== a.total) return b.total - a.total;
    const at = a.last ? new Date(a.last).getTime() : 0;
    const bt = b.last ? new Date(b.last).getTime() : 0;
    return bt - at;
  });

  return base.slice(0, topN);
}

/* ================== Cute UI shell ================== */

function CuteShell({ children }) {
  return (
    <div className="appShell">
      <style>{`
        :root{
          --ink:#121212;
          --muted:#4b4b4b;
          --pink:#ff7ab6;
          --pink2:#ffb6d8;
          --mint:#7fe7d6;
          --sky:#bfe8ff;
          --shadow: 0 18px 40px rgba(0,0,0,.12);
          --shadow2: 0 10px 22px rgba(0,0,0,.10);
          --border: 2px solid rgba(0,0,0,.14);
        }
        *{ box-sizing:border-box; }
        body{ margin:0; color:var(--ink); }

        .appShell{
          position:fixed; inset:0;
          overflow:auto;
          padding:18px;
          display:grid;
          place-items:center;
          background:
            radial-gradient(1200px 800px at 20% 10%, rgba(255,122,182,.20), transparent 60%),
            radial-gradient(1000px 700px at 80% 20%, rgba(127,231,214,.20), transparent 55%),
            radial-gradient(900px 650px at 50% 90%, rgba(191,232,255,.35), transparent 55%),
            linear-gradient(180deg, #f7fbff 0%, #fff5fb 55%, #f7fffd 100%);
          font-family: ui-rounded, system-ui, -apple-system, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif;
        }

        .panel{
          width:min(560px, 100%);
          background: rgba(255,255,255,.72);
          border: var(--border);
          border-radius: 26px;
          box-shadow: var(--shadow);
          backdrop-filter: blur(10px);
          padding: 18px;
          position:relative;
        }

        .titleRow{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .brand{ display:flex; align-items:center; gap:10px; }
        .logo{
          width:44px; height:44px;
          border-radius: 16px;
          background:
            radial-gradient(circle at 30% 30%, #fff 0 25%, transparent 26%),
            radial-gradient(circle at 70% 35%, #fff 0 18%, transparent 19%),
            linear-gradient(135deg, var(--pink) 0%, var(--pink2) 48%, var(--sky) 100%);
          box-shadow: var(--shadow2);
          border: 2px solid rgba(0,0,0,.10);
        }
        .brandTitle{
          font-weight: 1000;
          letter-spacing: .3px;
          font-size: 20px;
          margin:0;
          line-height:1.1;
        }
        .brandSub{
          margin:0;
          font-size: 12px;
          color: var(--muted);
        }

        .chip{
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding: 8px 12px;
          background: rgba(255,255,255,.9);
          border: 2px solid rgba(0,0,0,.10);
          border-radius: 999px;
          box-shadow: 0 8px 16px rgba(0,0,0,.08);
          font-size: 12px;
          color: var(--ink);
          user-select:none;
          white-space:nowrap;
        }
        .chip strong{ font-weight: 1000; }

        .grid{ display:grid; gap:10px; }
        .grid2{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .hintRow{
          display:flex;
          justify-content:center;
          gap:10px;
          flex-wrap:wrap;
          margin: 10px 0 2px;
        }

        .cuteBtn{
          width:100%;
          padding: 14px 14px;
          border-radius: 18px;
          border: 2px solid rgba(0,0,0,.14);
          background: #fff;
          color: var(--ink);
          font-size: 16px;
          font-weight: 900;
          cursor:pointer;
          box-shadow: 0 12px 22px rgba(0,0,0,.10);
          transition: transform .08s ease, box-shadow .15s ease;
        }
        .cuteBtn:active{ transform: translateY(1px) scale(.995); }
        .cuteBtn.primary{
          background: linear-gradient(135deg, rgba(255,122,182,.95) 0%, rgba(255,182,216,.95) 50%, rgba(191,232,255,.95) 100%);
        }

        .wordCard{
          height: 320px;
          border-radius: 26px;
          border: 2px solid rgba(0,0,0,.14);
          background:
            radial-gradient(380px 220px at 25% 20%, rgba(255,122,182,.12), transparent 55%),
            radial-gradient(320px 220px at 75% 30%, rgba(127,231,214,.12), transparent 55%),
            linear-gradient(180deg, #ffffff 0%, #fffdf6 100%);
          box-shadow: var(--shadow);
          display:grid;
          place-items:center;
          user-select:none;
          touch-action: pan-y;
          padding: 14px;
          position:relative;
          overflow:hidden;
        }
        .wordText{
          font-size: 78px;
          font-weight: 1000;
          color: var(--ink);
          line-height: 1.0;
          letter-spacing: .5px;
          text-shadow: 0 3px 0 rgba(255,122,182,.12);
          position:relative;
          z-index:1;
        }
        .jaText{
          margin-top: 10px;
          font-size: 18px;
          font-weight: 900;
          color: var(--ink);
          opacity:.95;
          position:relative;
          z-index:1;
        }
        .swipeHint{
          position:absolute;
          left:14px; right:14px; bottom:12px;
          display:flex;
          justify-content:space-between;
          font-size: 12px;
          font-weight: 1000;
          color: rgba(18,18,18,.55);
          z-index:1;
        }

        .toolbar{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          justify-content:center;
          margin-top: 12px;
        }
        .pill{
          padding: 10px 12px;
          border-radius: 999px;
          border: 2px solid rgba(0,0,0,.12);
          background: rgba(255,255,255,.92);
          color: var(--ink);
          font-size: 13px;
          font-weight: 1000;
          cursor:pointer;
          box-shadow: 0 10px 18px rgba(0,0,0,.08);
          transition: transform .08s ease;
        }
        .pill:active{ transform: translateY(1px); }
        .pill.on{
          background: linear-gradient(135deg, rgba(255,122,182,.35), rgba(127,231,214,.28));
        }

        .progressRow{
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
          margin: 8px 0 10px;
        }
        .miniStat{ display:flex; gap:8px; flex-wrap:wrap; justify-content:center; align-items:center; }
        .bar{
          height: 10px;
          border-radius: 999px;
          background: rgba(0,0,0,.08);
          overflow:hidden;
          border: 2px solid rgba(0,0,0,.08);
          flex:1;
          min-width: 220px;
        }
        .bar > div{
          height:100%;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(255,122,182,.95), rgba(127,231,214,.9));
          width: 0%;
        }

        .listBox{
          padding: 12px;
          border-radius: 18px;
          border: 2px solid rgba(0,0,0,.12);
          background: rgba(255,255,255,.9);
          text-align:left;
          line-height: 1.8;
          word-break: break-word;
          box-shadow: 0 12px 22px rgba(0,0,0,.08);
        }

        .rankRow{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding: 10px 10px;
          border-radius: 14px;
          border: 2px solid rgba(0,0,0,.08);
          background: rgba(255,255,255,.95);
          margin-top: 8px;
          cursor: pointer;
          transition: transform .08s ease;
        }
        .rankRow:active{ transform: translateY(1px); }

        .rankLeft{
          display:flex;
          gap:10px;
          align-items:center;
          min-width: 0;
        }
        .badge{
          width: 28px;
          height: 28px;
          border-radius: 10px;
          display:grid;
          place-items:center;
          font-weight: 1000;
          background: linear-gradient(135deg, rgba(255,122,182,.35), rgba(127,231,214,.25));
          border: 2px solid rgba(0,0,0,.08);
        }
        .w{
          font-weight: 1000;
          font-size: 16px;
          overflow:hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sub{
          font-size: 12px;
          color: var(--muted);
          margin-top: 2px;
          overflow:hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .rankRight{
          text-align:right;
          font-size: 12px;
          color: var(--muted);
          white-space: nowrap;
        }
        .pct{
          font-size: 14px;
          font-weight: 1000;
          color: var(--ink);
        }

        /* ✨ 正解キラキラ（下→上） */
        .sparkBurst{
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9999;
          overflow: hidden;
        }
        .sparkBurst .p{
          position:absolute;
          border-radius: 999px;
          opacity: .95;
          animation-name: rise;
          animation-timing-function: ease-out;
          animation-fill-mode: forwards;
          filter: drop-shadow(0 6px 10px rgba(0,0,0,.12));
        }
        @keyframes rise{
          0%{ transform: translate(var(--dx), 0px) scale(1) rotate(0deg); opacity: 1; }
          100%{ transform: translate(var(--dx), calc(-1 * var(--dy))) scale(.65) rotate(40deg); opacity: 0; }
        }
      `}</style>

      {children}
    </div>
  );
}

/* ================== Pages ================== */

function Home({ onStart, history, onResetHistory, onOpenRanking }) {
  const [selected, setSelected] = useState("dolch");

  return (
    <CuteShell>
      <div className="panel">
        <div className="titleRow">
          <div className="brand">
            <div className="logo" />
            <div>
              <p className="brandTitle">Sight Words Swipe</p>
              <p className="brandSub">💖 右スワイプ＝わかる ／ 💧 左スワイプ＝わからない</p>
            </div>
          </div>
          <div className="chip">
            🎀 <strong>かわいく学習</strong>
          </div>
        </div>

        <div className="hintRow">
          <span className="chip">✨ たのしく 20語ずつ</span>
          <span className="chip">🔊 英語読み上げ</span>
          <span className="chip">🧠 弱点ランキング</span>
        </div>

        <div className="listBox" style={{ marginTop: 12 }}>
          <strong>📊 学習履歴</strong>
          <div style={{ marginTop: 6 }}>
            <div>
              学習開始回数：<strong>{history.sessions}</strong>
            </div>
            <div>
              最後に勉強：<strong>{formatJPDateTime(history.lastStudiedAt)}</strong>
            </div>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="pill" onClick={onOpenRanking}>
              🧠 弱い単語ランキングを見る
            </button>
            <button className="pill" onClick={onResetHistory}>
              🧹 履歴リセット
            </button>
          </div>
        </div>

        <div className="grid" style={{ marginTop: 14 }}>
          <button className="cuteBtn" onClick={() => setSelected("dolch")}>
            🍓 Dolch をやる
          </button>

          <button className="cuteBtn" onClick={() => setSelected("fry")}>
            🌈 Fry (First 100) をやる
          </button>

          <button className="cuteBtn primary" onClick={() => onStart(selected)}>
            ▶ Start（20語）
          </button>
        </div>
      </div>
    </CuteShell>
  );
}

function RankingPage({ history, onBack, onReviewWord, onReviewTopSet }) {
  const weakTop10 = useMemo(() => buildWeakRanking(history.wordStats, 10), [history.wordStats]);
  const weakTop20 = useMemo(() => buildWeakRanking(history.wordStats, 20), [history.wordStats]);

  const canTop20 = weakTop20.length > 0;

  return (
    <CuteShell>
      <div className="panel">
        <div className="titleRow">
          <div className="brand">
            <div className="logo" />
            <div>
              <p className="brandTitle">🧠 弱い単語ランキング</p>
              <p className="brandSub">タップするとその単語を復習 / ボタンでTOP20復習セット</p>
            </div>
          </div>
          <button className="pill" onClick={onBack}>
            ◀ Home
          </button>
        </div>

        <div className="grid" style={{ marginBottom: 10 }}>
          <button
            className="cuteBtn primary"
            onClick={() => onReviewTopSet(weakTop20.map((r) => r.word))}
            disabled={!canTop20}
            style={{
              opacity: canTop20 ? 1 : 0.5,
              cursor: canTop20 ? "pointer" : "not-allowed",
            }}
          >
            🧠 TOP20 復習セット（順番ランダム）
          </button>
        </div>

        <div className="listBox">
          <div style={{ fontSize: 12, color: "#4b4b4b" }}>
            ※ Unknown率（わからない割合）が高い順（最低2回以上の単語を優先）
          </div>

          {weakTop10.length === 0 ? (
            <div style={{ marginTop: 10, color: "#4b4b4b" }}>
              まだデータがありません。Swipeで学習するとランキングが出ます。
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              {weakTop10.map((r, idx) => (
                <div className="rankRow" key={r.word} onClick={() => onReviewWord(r.word)}>
                  <div className="rankLeft" style={{ minWidth: 0 }}>
                    <div className="badge">{idx + 1}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="w">{r.word}</div>
                      <div className="sub">{r.ja}</div>
                    </div>
                  </div>
                  <div className="rankRight">
                    <div className="pct">{Math.round(r.unknownRate * 100)}%</div>
                    <div>
                      💧{r.unknown} / 💖{r.known}（{r.total}回）
                    </div>
                    <div style={{ marginTop: 4, fontWeight: 1000, color: "#121212" }}>
                      ▶ この単語を復習
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid" style={{ marginTop: 12 }}>
          <button className="cuteBtn" onClick={onBack}>
            ◀ Home にもどる
          </button>
        </div>
      </div>
    </CuteShell>
  );
}

/* ================== SwipeGame ================== */

function SwipeGame({
  titleLabel,
  words,
  onAddMore20,
  onNextSet20,
  onHome,
  onLogKnown,
  onLogUnknown,
  reviewWord,
  reviewSetWords, // ✅ TOP20セット復習の時に入る（配列）
}) {
  const [index, setIndex] = useState(0);
  const [known, setKnown] = useState([]);
  const [unknown, setUnknown] = useState([]);

  const [showJa, setShowJa] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);

  const [burstOn, setBurstOn] = useState(false);
  const [burstSeed, setBurstSeed] = useState(0);

  const current = words[index];
  const done = index >= words.length;

  const ja = useMemo(() => {
    const key = current ?? "";
    return JA[key] ?? "（訳未登録）";
  }, [current]);

  useEffect(() => {
    if (!autoSpeak) return;
    if (!current) return;
    speak(current, "en-US");
  }, [autoSpeak, current]);

  const doBurst = () => {
    setBurstSeed((s) => s + 1);
    setBurstOn(true);
    setTimeout(() => setBurstOn(false), 950);
  };

  const handleAnswer = (type) => {
    if (!current) return;

    if (type === "known") {
      setKnown((p) => [...p, current]);
      onLogKnown(current);
      doBurst();
    } else {
      setUnknown((p) => [...p, current]);
      onLogUnknown(current);
    }

    setIndex((i) => i + 1);
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleAnswer("unknown"),
    onSwipedRight: () => handleAnswer("known"),
    preventScrollOnSwipe: true,
    trackMouse: true,
  });

  const progressPct = words.length ? Math.min(100, Math.round(((index + 1) / words.length) * 100)) : 0;

  if (done) {
    const isReviewWord = !!reviewWord;
    const isReviewSet = Array.isArray(reviewSetWords) && reviewSetWords.length > 0;

    return (
      <CuteShell>
        <div className="panel">
          <div className="titleRow">
            <div className="brand">
              <div className="logo" />
              <div>
                <p className="brandTitle">がんばったね！🎉</p>
                <p className="brandSub">
                  {isReviewWord
                    ? `Review: ${reviewWord}`
                    : isReviewSet
                    ? `Review Set: TOP${reviewSetWords.length}`
                    : `List: ${String(titleLabel).toUpperCase()}`}
                </p>
              </div>
            </div>
            <div className="chip">🏆 Result</div>
          </div>

          <div className="hintRow">
            <span className="chip">
              💖 わかる：<strong>{known.length}</strong>
            </span>
            <span className="chip">
              💧 わからない：<strong>{unknown.length}</strong>
            </span>
          </div>

          <div className="grid" style={{ marginTop: 14 }}>
            <button className="cuteBtn primary" onClick={onNextSet20}>
              🌟 Another 20
            </button>

            <button className="cuteBtn" onClick={onHome}>
              🏠 Home にもどる
            </button>
          </div>
        </div>
      </CuteShell>
    );
  }

  const headerLabel = reviewWord
    ? `REVIEW: ${reviewWord}`
    : Array.isArray(reviewSetWords) && reviewSetWords.length > 0
    ? `REVIEW SET: TOP${reviewSetWords.length}`
    : String(titleLabel).toUpperCase();

  return (
    <CuteShell>
      <SparkBurst show={burstOn} seed={burstSeed} />

      <div className="panel">
        <div className="progressRow">
          <span className="chip">📚 {headerLabel}</span>
          <div className="miniStat">
            <span className="chip">💖 {known.length}</span>
            <span className="chip">💧 {unknown.length}</span>
          </div>
        </div>

        <div className="progressRow">
          <span className="chip">
            {index + 1} / {words.length}
          </span>
          <div className="bar" aria-label="progress">
            <div style={{ width: `${progressPct}%` }} />
          </div>
          <span className="chip">{progressPct}%</span>
        </div>

        <div {...swipeHandlers} className="wordCard">
          <div className="wordText">{current}</div>
          {showJa && <div className="jaText">{ja}</div>}
          <div className="swipeHint">
            <span>💧 左：わからない</span>
            <span>💖 右：わかる</span>
          </div>
        </div>

        <div className="grid2" style={{ marginTop: 12 }}>
          <button className="pill" onClick={onHome}>
            🏠 Home
          </button>
          <button className="pill" onClick={onAddMore20}>
            ➕ Another 20
          </button>
        </div>

        <div className="grid2" style={{ marginTop: 12 }}>
          <button className="cuteBtn" onClick={() => handleAnswer("unknown")}>
            💧 わからない
          </button>
          <button className="cuteBtn primary" onClick={() => handleAnswer("known")}>
            💖 わかる
          </button>
        </div>

        <div className="toolbar">
          <button className={`pill ${showJa ? "on" : ""}`} onClick={() => setShowJa((v) => !v)}>
            🈶 日本語訳 {showJa ? "ON" : "OFF"}
          </button>

          <button className="pill" onClick={() => current && speak(current, "en-US")}>
            🔊 英語
          </button>

          <button className={`pill ${autoSpeak ? "on" : ""}`} onClick={() => setAutoSpeak((v) => !v)}>
            🎧 自動読み上げ {autoSpeak ? "ON" : "OFF"}
          </button>
        </div>
      </div>
    </CuteShell>
  );
}

/* ================== App ================== */

export default function App() {
  // home / ranking / game
  const [mode, setMode] = useState("home");

  // "dolch" / "fry" / "reviewWord" / "reviewSet"
  const [playType, setPlayType] = useState("dolch");
  const [reviewWord, setReviewWord] = useState(null);
  const [reviewSetWords, setReviewSetWords] = useState([]);

  const [words, setWords] = useState([]);
  const [gameKey, setGameKey] = useState(0);

  const [history, setHistory] = useState(() => loadHistory());

  const baseList = useMemo(() => (playType === "dolch" ? DOLCH : FRY_100), [playType]);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const startNormal = (selected) => {
    setPlayType(selected);
    setReviewWord(null);
    setReviewSetWords([]);

    const list = selected === "dolch" ? DOLCH : FRY_100;
    const first20 = pickMore(list, [], 20);

    setWords(first20);
    setGameKey((k) => k + 1);
    setMode("game");

    setHistory((h) => ({
      ...h,
      sessions: h.sessions + 1,
      lastStudiedAt: new Date().toISOString(),
    }));
  };

  const startReviewWord = (word) => {
    const w = normalizeWord(word);
    if (!w) return;

    setPlayType("reviewWord");
    setReviewWord(w);
    setReviewSetWords([]);

    setWords(repeatWord(w, 20));
    setGameKey((k) => k + 1);
    setMode("game");

    setHistory((h) => ({
      ...h,
      sessions: h.sessions + 1,
      lastStudiedAt: new Date().toISOString(),
    }));
  };

  const startReviewTopSet = (wordList) => {
  const arr = (wordList || []).map(normalizeWord).filter(Boolean);
  if (arr.length === 0) return;

  setPlayType("reviewSet");
  setReviewWord(null);
  setReviewSetWords(arr);

  // ✅ 復習は毎回シャッフル
  setWords(shuffle(arr));
  setGameKey((k) => k + 1);
  setMode("game");

  setHistory((h) => ({
    ...h,
    sessions: h.sessions + 1,
    lastStudiedAt: new Date().toISOString(),
  }));
};


  const addMore20 = () => {
    if (playType === "reviewWord" && reviewWord) {
      setWords((prev) => [...prev, ...repeatWord(reviewWord, 20)]);
      return;
    }

    if (playType === "reviewSet" && reviewSetWords.length > 0) {
  // ✅ TOP20をさらに1周追加（毎回シャッフル）
  setWords((prev) => [...prev, ...shuffle(reviewSetWords)]);
  return;
}


    setWords((prev) => {
      const more = pickMore(baseList, prev, 20);
      return [...prev, ...more];
    });
  };

  const nextSet20 = () => {
    if (playType === "reviewWord" && reviewWord) {
      setWords(repeatWord(reviewWord, 20));
      setGameKey((k) => k + 1);
      setMode("game");
      setHistory((h) => ({
        ...h,
        sessions: h.sessions + 1,
        lastStudiedAt: new Date().toISOString(),
      }));
      return;
    }

    if (playType === "reviewSet" && reviewSetWords.length > 0) {
  // ✅ 次の周回（毎回シャッフル）
  setWords(shuffle(reviewSetWords));
  setGameKey((k) => k + 1);
  setMode("game");
  setHistory((h) => ({
    ...h,
    sessions: h.sessions + 1,
    lastStudiedAt: new Date().toISOString(),
  }));
  return;
}


    const next20 = pickMore(baseList, [], 20);
    setWords(next20);
    setGameKey((k) => k + 1);
    setMode("game");
    setHistory((h) => ({
      ...h,
      sessions: h.sessions + 1,
      lastStudiedAt: new Date().toISOString(),
    }));
  };

  // ✅ 単語ごとの履歴のみ更新
  const logWord = (word, type) => {
    const w = normalizeWord(word);
    if (!w) return;
    const now = new Date().toISOString();

    setHistory((h) => {
      const prev = h.wordStats?.[w] ?? { known: 0, unknown: 0, last: null };
      const next = {
        known: prev.known + (type === "known" ? 1 : 0),
        unknown: prev.unknown + (type === "unknown" ? 1 : 0),
        last: now,
      };
      return {
        ...h,
        lastStudiedAt: now,
        wordStats: { ...(h.wordStats || {}), [w]: next },
      };
    });
  };

  const resetHistory = () => {
    const empty = emptyHistory();
    setHistory(empty);
    saveHistory(empty);
  };

  if (mode === "ranking") {
    return (
      <RankingPage
        history={history}
        onBack={() => setMode("home")}
        onReviewWord={(w) => startReviewWord(w)}
        onReviewTopSet={(arr) => startReviewTopSet(arr)}
      />
    );
  }

  if (mode === "home") {
    return (
      <Home
        onStart={startNormal}
        history={history}
        onResetHistory={resetHistory}
        onOpenRanking={() => setMode("ranking")}
      />
    );
  }

  const titleLabel =
    playType === "fry" ? "FRY" : playType === "dolch" ? "DOLCH" : playType === "reviewWord" ? "REVIEW" : "REVIEW SET";

  return (
    <SwipeGame
      key={gameKey}
      titleLabel={titleLabel}
      words={words}
      reviewWord={playType === "reviewWord" ? reviewWord : null}
      reviewSetWords={playType === "reviewSet" ? reviewSetWords : []}
      onAddMore20={addMore20}
      onNextSet20={nextSet20}
      onHome={() => setMode("home")}
      onLogKnown={(w) => logWord(w, "known")}
      onLogUnknown={(w) => logWord(w, "unknown")}
    />
  );
}
