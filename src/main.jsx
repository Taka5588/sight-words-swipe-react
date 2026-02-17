import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// ✅ Reactが起動する前/最中に落ちても、画面にエラーを出す
function showFatal(title, err) {
  const root = document.getElementById("root");
  const msg = String(err?.message ?? err ?? "unknown error");
  const stack = String(err?.stack ?? "");

  root.innerHTML = `
    <div style="padding:16px;font-family:system-ui;color:#111;background:#fff;min-height:100vh;">
      <h2 style="margin:0 0 8px;">⚠️ ${title}</h2>
      <p style="margin:0 0 12px;">下の内容をそのまま私に貼ってください。</p>
      <pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px;">${escapeHtml(
        msg + "\n\n" + stack
      )}</pre>
      <p style="margin-top:12px;color:#444;">URL: ${location.href}</p>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

window.addEventListener("error", (e) => {
  showFatal("Script error / runtime error", e.error || e.message);
});

window.addEventListener("unhandledrejection", (e) => {
  showFatal("Unhandled Promise rejection", e.reason);
});

try {
  ReactDOM.createRoot(document.getElementById("root")).render(
  <App />
);

} catch (err) {
  showFatal("React render crashed", err);
}
