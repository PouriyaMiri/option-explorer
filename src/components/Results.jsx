// src/components/Results.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { useNavigate } from 'react-router-dom';

const STATIC_ARTIFACT_BASE = 'http://194.249.2.210:3001/logs/page2/';

const formatValue = (v) => {
  if (v == null) return '';
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  if (typeof v === 'string') {
    const unquoted = v.trim().replace(/^"+|"+$/g, '');
    if (unquoted.startsWith('[') && unquoted.endsWith(']')) {
      try {
        const parsed = JSON.parse(unquoted);
        if (Array.isArray(parsed)) return `[${parsed.join(', ')}]`;
      } catch {}
    }
    return unquoted;
  }
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
};

const DEFAULT_ORDER = [
  'model', 'domain', 'algorithm',
  'layers', 'nodes', 'activation_function',
  'kernel_size', 'pool_size', 'batch_size', 'epochs',
  'processing_unit', 'RAM',
  'accuracy', 'precision', 'recall', 'f1_score', 'loss', 'training_time',
  'utility_value',
];

export default function Results() {
  const navigate = useNavigate();

  const [artifactCsv, setArtifactCsv] = useState('');
  const [stateMsg, setStateMsg] = useState('Loading…');
  const [err, setErr] = useState('');

  const [allRows, setAllRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [topk, setTopk] = useState(50);

  const [selectedIdx, setSelectedIdx] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);

  const pollRef = useRef(null);
  const firstRowsLoadedRef = useRef(false);
  const experimentStartRef = useRef(null);

  // Top/bottom scroll synchronization refs
  const topScrollRef = useRef(null);
  const bottomScrollRef = useRef(null);
  const tableRef = useRef(null);
  const [contentWidth, setContentWidth] = useState(0);

  const [showInstructions, setShowInstructions] = useState(false);

  const canRun = useMemo(() => !loading, [loading]);
  const canFinish = selectedRow != null;

  const buildHeaders = (list) => {
    if (!list || !list.length) return [];
    const keySet = new Set();
    list.forEach((r) => Object.keys(r || {}).forEach((k) => keySet.add(k)));
    const extras = Array.from(keySet).filter((k) => !DEFAULT_ORDER.includes(k)).sort();
    return [...DEFAULT_ORDER.filter((k) => keySet.has(k)), ...extras];
  };

  const fetchStatus = async () => {
    const res = await fetch('http://194.249.2.210:3001/page2/status');
    if (!res.ok) throw new Error(`Status HTTP ${res.status}`);
    const s = await res.json();
    if (s?.csv) setArtifactCsv(s.csv);
    return s; // { state, csv, rows, ts }
  };

  const fetchCsvFromStatic = async (csvName) => {
    const url = `${STATIC_ARTIFACT_BASE}${encodeURIComponent(csvName)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CSV HTTP ${res.status} at ${url}`);
    const text = await res.text();

    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: (h) => (h ?? '').toString(),
      transform: (v) => (v == null ? '' : String(v)),
    });

    const rows = Array.isArray(parsed?.data) ? parsed.data : [];
    return rows.map((r) => {
      const out = {};
      Object.keys(r).forEach((k) => {
        const key = (k || '').toString().trim();
        let val = r[k];
        if (typeof val === 'string') val = val.trim();
        out[key] = val;
      });
      return out;
    });
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = () => {
    if (pollRef.current) return; // already polling
    pollRef.current = setInterval(() => {
      tick({ fromPoll: true }).catch(() => {});
    }, 1200);
  };

  const tick = async ({ fromPoll = false } = {}) => {
    try {
      if (!fromPoll) setLoading(true);
      setErr('');

      const status = await fetchStatus();

      if (!status?.csv) {
        setAllRows([]);
        setHeaders([]);
        setStateMsg(
          status?.state === 'running' || status?.state === 'queued'
            ? 'Computing…'
            : 'Waiting for results…'
        );
        startPolling();
        return;
      }

      // We have a CSV name → try to fetch it
      let rows = [];
      try {
        rows = await fetchCsvFromStatic(status.csv);
      } catch {
        setStateMsg('Preparing results…');
        startPolling();
        return;
      }

      setAllRows(rows);
      setHeaders(buildHeaders(rows));
      setStateMsg(rows.length ? '' : 'No rows in this run.');

      // Start experiment timer ONCE when rows first load
      if (rows.length && !firstRowsLoadedRef.current) {
        firstRowsLoadedRef.current = true;
        experimentStartRef.current = new Date();
        fetch('http://194.249.2.210:3001/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'page2_results_loaded',
            page: 'page2',
            artifact: status.csv,
            t_start_client: experimentStartRef.current.toISOString(),
          }),
        }).catch(() => {});
        stopPolling();
      } else if (!rows.length) {
        startPolling();
      }

      // Reset selection on each fresh load
      setSelectedIdx(null);
      setSelectedRow(null);
    } catch (e) {
      setErr(e.message || 'Unexpected error');
      setStateMsg('');
      startPolling();
    } finally {
      if (!fromPoll) setLoading(false);
    }
  };

  useEffect(() => {
    // initial kick — will keep polling automatically until rows appear
    tick();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute scrollable content width whenever table changes or window resizes
  useEffect(() => {
    const measure = () => {
      const w =
        (tableRef.current && tableRef.current.scrollWidth) ||
        (bottomScrollRef.current && bottomScrollRef.current.scrollWidth) ||
        0;
      setContentWidth(w);
      // keep scroll positions in sync on resize
      if (topScrollRef.current && bottomScrollRef.current) {
        topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [headers, allRows]);

  const rows = useMemo(() => {
    if (!allRows || !allRows.length) return [];
    if (!topk || topk <= 0) return allRows;
    return allRows.slice(0, topk);
  }, [allRows, topk]);

  const rerun = () => { tick(); };

  const downloadCSV = () => {
    if (!rows.length) return;
    const cols = headers;
    const esc = (v) => {
      const s = formatValue(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `ranked_list_${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onSelectRow = (row, idx) => {
    setSelectedIdx(idx);
    setSelectedRow(row);
  };

  const onFinish = async () => {
    if (!selectedRow) return;

    const t_end = new Date();
    const t_start_iso = experimentStartRef.current ? experimentStartRef.current.toISOString() : null;
    const t_end_iso = t_end.toISOString();
    const duration_ms_client = experimentStartRef.current ? (t_end - experimentStartRef.current) : null;

    const payload = {
      page: 'page2',
      selectedRow,
      artifact: artifactCsv,
      topkShown: topk,
      timestamp_client: t_end_iso,
      experiment_t_start: t_start_iso,
      experiment_t_end: t_end_iso,
      experiment_duration_ms_client: duration_ms_client,
    };

    try {
      const res = await fetch('http://194.249.2.210:3001/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to log selection');
      }
      navigate('/thanks2', { state: { selectedRow, artifactCsv } });
    } catch (e) {
      alert(e.message || 'Failed to save your selection.');
    }
  };

  // Scroll sync handlers
  const onTopScroll = () => {
    if (!topScrollRef.current || !bottomScrollRef.current) return;
    bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
  };
  const onBottomScroll = () => {
    if (!topScrollRef.current || !bottomScrollRef.current) return;
    topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
  };

  return (
    <div style={{ minHeight: '100vh', background: 'white', color: '#1C39BB' }}>
      <header style={{ padding: '24px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, flex: '0 0 auto' }}>Ranked Results</h1>
          <button
            type="button"
            onClick={() => setShowInstructions(true)}
            style={{
              background: '#1C39BB',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
              flex: '0 0 auto'
            }}
            title="Recheck the instructions"
          >
            View Instructions
          </button>
        </div>

      </header>

      {/* Instructions Modal (same tone as Page 1) */}
      {showInstructions && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="results-instructions-title"
          onClick={() => setShowInstructions(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              color: '#1C39BB',
              borderRadius: 12,
              boxShadow: '0 10px 24px rgba(0,0,0,0.25)',
              maxWidth: 800,
              width: '100%',
              padding: 20,
            }}
          >
            <h2 id="results-instructions-title" style={{ marginTop: 0, marginBottom: 8 }}>
              Instructions
            </h2>
            <p style={{ marginTop: 0 }}>
              Imagine you are a <strong>computer vision researcher</strong> at the start of a facial video analysis project. You have access to a large database of published papers with different models, datasets, and metrics. Your goal is to choose a solid starting point that meets baseline performance. <br />
              Your Supervisor requested a model that has at least <strong>80% accuracy</strong>, at least <strong>90% precision</strong> and your hardware is a <strong>GPU</strong> to give you more computational resource, you need to select a model that meets all the requirements with balanced metrics. <br />Accuracy is how often predictions are correct. <br />Precision is how many of the predicted positives are actually correct.<br /> <br /> <strong>When you decide, click a row and then “Next”.</strong>
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                style={{
                  background: '#1C39BB',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 14px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={{ padding: 20 }}>
        <div
          style={{
            width: '100%',
            maxWidth: 1100,
            background: '#F7FAFF',
            border: '1px solid #D0DAFF',
            borderRadius: 14,
            boxShadow: '0 6px 16px rgba(28,57,187,0.10)',
            padding: 16,
            margin: '0 auto',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontWeight: 700 }}>Top-K</label>
              <input
                type="number"
                min="0"
                value={topk}
                onChange={(e) => setTopk(Number(e.target.value) || 0)}
                style={{
                  width: 100,
                  border: '1px solid #1C39BB',
                  background: 'white',
                  color: '#1C39BB',
                  borderRadius: 8,
                  padding: '8px 10px',
                }}
              />
            </div>

            <button
              onClick={rerun}
              disabled={!canRun}
              style={{
                background: canRun ? '#1C39BB' : '#9DB0FF',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '10px 14px',
                cursor: canRun ? 'pointer' : 'not-allowed',
              }}
              onMouseOver={(e) => { if (canRun) e.currentTarget.style.background = '#CC3333'; }}
              onMouseOut={(e) => { if (canRun) e.currentTarget.style.background = '#1C39BB'; }}
              title="Force refresh (normally auto-updates)"
            >
              Refresh
            </button>

            <button
              onClick={downloadCSV}
              disabled={!rows.length}
              style={{
                background: rows.length ? '#1C39BB' : '#9DB0FF',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '10px 14px',
                cursor: rows.length ? 'pointer' : 'not-allowed',
              }}
              onMouseOver={(e) => { if (rows.length) e.currentTarget.style.background = '#CC3333'; }}
              onMouseOut={(e) => { if (rows.length) e.currentTarget.style.background = '#1C39BB'; }}
            >
              Download CSV
            </button>

            <button
              onClick={onFinish}
              disabled={!canFinish}
              style={{
                background: canFinish ? '#1C39BB' : '#9DB0FF',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '10px 14px',
                cursor: canFinish ? 'pointer' : 'not-allowed',
                marginLeft: 'auto'
              }}
              onMouseOver={(e) => { if (canFinish) e.currentTarget.style.background = '#CC3333'; }}
              onMouseOut={(e) => { if (canFinish) e.currentTarget.style.background = '#1C39BB'; }}
              title={canFinish ? 'Finish and proceed' : 'Select a row to enable'}
            >
              Next
            </button>

            {loading && <span style={{ color: '#4C63C9' }}>Working…</span>}
            {err && <span style={{ color: '#CC3333' }}>{err}</span>}
            {!loading && stateMsg && <span style={{ color: '#4C63C9' }}>{stateMsg}</span>}
          </div>

          {/* --- TOP horizontal scrollbar (synced) --- */}
          <div
            ref={topScrollRef}
            style={{
              overflowX: 'auto',
              border: '1px solid #BFD0FF',
              borderRadius: 8,
              background: 'white',
              marginBottom: 8,
              height: 18,
            }}
            onScroll={onTopScroll}
          >
            {/* dummy content that matches table scroll width */}
            <div style={{ width: Math.max(contentWidth, 800), height: 1 }} />
          </div>

          {/* --- Table with bottom scrollbar --- */}
          <div
            ref={bottomScrollRef}
            style={{ overflowX: 'auto', border: '1px solid #BFD0FF', borderRadius: 10, background: 'white' }}
            onScroll={onBottomScroll}
          >
            {!rows.length && !loading ? (
              <div style={{ padding: 16, color: '#4C63C9' }}>
                {stateMsg || 'No results yet.'}
              </div>
            ) : (
              <table
                ref={tableRef}
                style={{ borderCollapse: 'collapse', width: 'max-content', color: '#1C39BB', minWidth: '100%' }}
              >
                <thead style={{ background: '#E7EEFF' }}>
                  <tr>
                    <th style={{ width: 42 }}></th>
                    {headers.map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderBottom: '1px solid #BFD0FF',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const isSelected = i === selectedIdx;
                    return (
                      <tr
                        key={i}
                        onClick={() => { setSelectedIdx(i); setSelectedRow(r); }}
                        style={{
                          background: isSelected ? '#FFEAEA' : (i % 2 ? '#FFFFFF' : '#F8FAFF'),
                          transition: 'background 0.12s ease',
                          cursor: 'pointer'
                        }}
                        title="Click to select this row"
                      >
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #EEF2FF' }}>
                          <input type="radio" checked={isSelected} readOnly />
                        </td>
                        {headers.map((h) => (
                          <td
                            key={h}
                            style={{
                              padding: '10px 12px',
                              borderBottom: '1px solid #EEF2FF',
                              whiteSpace: 'nowrap',
                              maxWidth: 360,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={formatValue(r[h])}
                          >
                            {formatValue(r[h])}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
