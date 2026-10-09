import { useEffect, useState } from "react";

interface RunSummary { id: string; name: string; model: string; createdAt: string; passCount: number; failCount: number; caseCount: number; totalCostUsd: number; totalLatencyMs: number; }
interface AssertionR { type: string; pass: boolean; detail: string; }
interface CaseR { id: string; output: string; pass: boolean; assertions: AssertionR[]; latencyMs: number; costUsd: number; model: string; renderedPrompt: string; }
interface RunDetail extends RunSummary { cases: CaseR[]; }

const DEFAULT_YAML = `name: "quick-check"
model: "mock"
tests:
  - id: "json-shape"
    prompt: "Return JSON for Site-A with keys site, passed, issues."
    expect:
      - { type: "json_valid" }
      - { type: "json_schema", required: ["site", "passed", "issues"] }
`;

export default function App() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [sel, setSel] = useState<RunDetail | null>(null);
  const [yaml, setYaml] = useState(DEFAULT_YAML);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);

  const load = async () => {
    try {
      const h = await fetch("/api/health");
      if (!h.ok) throw new Error();
      setOk(true); setErr("");
      const list: RunSummary[] = await (await fetch("/api/runs")).json();
      setRuns(Array.isArray(list) ? list : []);
      if (list.length) {
        const d: RunDetail = await (await fetch(`/api/runs/${list[0].id}`)).json();
        setSel((p) => p ?? d);
      }
    } catch {
      setOk(false);
      setErr("bench offline — run `npm start` (:4000), keep it up, then reload :5173.");
    }
  };
  useEffect(() => { void load(); }, []);

  const run = async () => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yaml }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "run failed");
      setSel(body);
      const list: RunSummary[] = await (await fetch("/api/runs")).json();
      setRuns(list);
    } catch (e: any) { setErr(String(e?.message ?? e)); }
    finally { setBusy(false); }
  };

  const pick = async (id: string) => {
    const d: RunDetail = await (await fetch(`/api/runs/${id}`)).json();
    setSel(d);
  };

  const totalPass = runs.reduce((s, r) => s + r.passCount, 0);
  const totalCases = runs.reduce((s, r) => s + r.caseCount, 0);

  return (
    <>
      <div className="bar">
        <span className="brand">prompt-regress</span>
        <span className="env">{sel?.model ?? "mock"} · {ok ? "linked" : ok === false ? "offline" : "…"}</span>
        <span className="spacer" />
        <span className="meter">pass <b>{totalPass}/{totalCases}</b></span>
        <span className="meter">runs <b>{runs.length}</b></span>
        <button className="ghostbtn" onClick={() => void load()}>refresh</button>
        <button className="runbtn" onClick={() => void run()} disabled={busy || ok === false}>
          {busy ? "RUNNING…" : "▸ RUN"}
        </button>
      </div>

      <div className="bench">
        <aside className="rail">
          <div className="railhead"><span>tape · {runs.length}</span><span>pass / cost / ms</span></div>
          <div style={{ overflow: "auto" }}>
            {runs.length === 0 && <p style={{ padding: 12, color: "var(--mut)", fontSize: 12 }}>No runs yet — edit the spec and hit ▸ RUN.</p>}
            {runs.map((r) => (
              <div key={r.id} onClick={() => void pick(r.id)} className={`runrow ${sel?.id === r.id ? "on" : ""} ${r.failCount ? "f" : "p"}`}>
                <div className="t">
                  <span><span className={`dot ${r.failCount ? "f" : "p"}`} />{r.name}</span>
                  <span>{r.passCount}/{r.caseCount}</span>
                </div>
                <div className="s">{new Date(r.createdAt).toLocaleTimeString()} · ${r.totalCostUsd.toFixed(5)} · {r.totalLatencyMs}ms</div>
              </div>
            ))}
          </div>
          <div className="railhead" style={{ marginTop: "auto", borderTop: "1px solid var(--line)" }}><span>spec</span></div>
          <div style={{ padding: 10 }}>
            <textarea className="spec" value={yaml} onChange={(e) => setYaml(e.target.value)} spellCheck={false} />
          </div>
        </aside>

        <main className="main">
          {err && <div className="note">{err}</div>}
          {!sel && <div className="note">Empty bench. Run the spec on the left to record the first tape.</div>}
          {sel && (
            <>
              <div className="mainhead" style={{ border: "none", padding: "0 0 10px" }}>
                <span>{sel.name} · {sel.id.slice(0, 8)} · {new Date(sel.createdAt).toLocaleString()}</span>
                <span className="kv"><span>{sel.passCount}/{sel.caseCount} pass</span><span>${sel.totalCostUsd.toFixed(5)}</span><span>{sel.totalLatencyMs}ms</span></span>
              </div>
              {sel.cases.map((c) => (
                <section key={c.id} className={`case ${c.pass ? "p" : "f"}`}>
                  <div className="casehead">
                    <span className="cid">{c.id}</span>
                    <span className={`tag ${c.pass ? "p" : "f"}`}>{c.pass ? "PASS" : "FAIL"}</span>
                    <span className="stamp">{c.latencyMs}ms · ${c.costUsd.toFixed(5)} · {c.model}</span>
                  </div>
                  <pre className="term">{c.output || "(empty)"}</pre>
                  <ul className="asserts">
                    {c.assertions.map((a, i) => (
                      <li key={i} className={a.pass ? "ok" : "bad"}>{a.pass ? "✓" : "✗"} {a.type} — {a.detail}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          )}
        </main>
      </div>
    </>
  );
}
