// src/components/Page2Thanks.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Papa from 'papaparse';

const STATIC_ARTIFACT_BASE = 'http://194.249.2.210:3001/logs/page2/';

const Star = ({ filled }) => (
  <span
    style={{
      fontSize: '1.25rem',
      marginRight: '4px',
      color: filled ? '#CC3333' : '#D1D5DB',
      userSelect: 'none',
    }}
  >
    {filled ? '★' : '☆'}
  </span>
);

const StarRating = ({ value, onChange, label, disabled = false }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
    {label ? <span style={{ minWidth: 220 }}>{label}</span> : null}
    <div>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onClick={() => !disabled && onChange(star)}
          style={{ cursor: disabled ? 'default' : 'pointer' }}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          <Star filled={star <= value} />
        </span>
      ))}
    </div>
  </div>
);

const box = {
  maxWidth: '980px',
  margin: '2rem auto',
  backgroundColor: '#F0F4FF',
  border: '2px solid #1C39BB',
  borderRadius: '12px',
  boxShadow: '0 6px 12px rgba(0,0,0,0.15)',
  padding: '1.5rem',
  color: '#1C39BB',
};

const labelStyle = { fontWeight: 700, marginBottom: '0.25rem' };
const textareaStyle = {
  width: '100%',
  border: '1px solid #1C39BB',
  borderRadius: '8px',
  padding: '10px',
  resize: 'vertical',
  color: '#1C39BB',
  backgroundColor: 'white',
};
const buttonStyle = (enabled) => ({
  padding: '10px 20px',
  borderRadius: '8px',
  fontSize: '16px',
  cursor: enabled ? 'pointer' : 'not-allowed',
  color: 'white',
  backgroundColor: enabled ? '#1C39BB' : '#94A3B8',
  border: 'none',
});
const br = (s) => (s == null ? '' : String(s));
const formatKV = (obj) => Object.entries(obj || {}).map(([k, v]) => `${k}: ${v}`).join('  |  ');

// Compare helper (soft match)
const sameRow = (a, b) => {
  if (!a || !b) return false;
  const keys = ['model', 'algorithm', 'accuracy', 'utility_value', 'domain'];
  let matches = 0, checked = 0;
  keys.forEach((k) => {
    if (k in a && k in b) {
      checked += 1;
      if (String(a[k]) === String(b[k])) matches += 1;
    }
  });
  if (checked >= 2) return matches >= 2;
  return JSON.stringify(a) === JSON.stringify(b);
};

// Column order used for comparison table (like Final.jsx)
const ORDER = [
  'field', 'domain', 'intent', 'sub-model',
  'algorithm', 'model', 'processing_unit', 'RAM',
  'layers', 'nodes', 'activation_function',
  'kernel_size', 'pool_size', 'batch_size', 'epochs',
  'accuracy', 'precision', 'recall', 'f1_score', 'loss', 'training_time',
];
const labelize = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
const cell = (v) => (v === undefined || v === null ? '' : String(v));

export default function Page2Thanks() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const selectedRow = state?.selectedRow || null;
  const artifactCsv = state?.artifactCsv || '';

  // Existing questions
  const [difficulty, setDifficulty] = useState(0);
  const [satisfaction, setSatisfaction] = useState(0);

  // Semantic questions:
  const [semUnderstand, setSemUnderstand] = useState(0); // 1..5
  const [semTrust, setSemTrust] = useState('');          // 'Yes' | 'No'
  const [semControl, setSemControl] = useState(0);       // 1..5

  const [firstRow, setFirstRow] = useState(null);
  const [firstLoadErr, setFirstLoadErr] = useState('');
  const [whyBetter, setWhyBetter] = useState('');
  const [firstRowRating, setFirstRowRating] = useState(0);

  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  // Load first-row from the artifact CSV
  useEffect(() => {
    const run = async () => {
      if (!artifactCsv) return;
      try {
        setFirstLoadErr('');
        const url = `${STATIC_ARTIFACT_BASE}${encodeURIComponent(artifactCsv)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`CSV HTTP ${res.status}`);
        const text = await res.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        const rows = Array.isArray(parsed?.data) ? parsed.data : [];
        setFirstRow(rows[0] || null);
      } catch (e) {
        setFirstLoadErr(e.message || 'Failed to load first row.');
        setFirstRow(null);
      }
    };
    run();
  }, [artifactCsv]);

  const selectedIsFirst = useMemo(() => {
    if (!selectedRow || !firstRow) return false;
    return sameRow(selectedRow, firstRow);
  }, [selectedRow, firstRow]);

  // Keys for comparison table (ORDER first, then any extras)
  const allKeys = useMemo(() => {
    const s = new Set(ORDER);
    if (selectedRow) Object.keys(selectedRow).forEach((k) => s.add(k));
    if (firstRow) Object.keys(firstRow).forEach((k) => s.add(k));
    const extras = Array.from(s).filter((k) => !ORDER.includes(k)).sort();
    return [...ORDER, ...extras];
  }, [selectedRow, firstRow]);

  const summary = useMemo(() => {
    if (!selectedRow) return 'No selection payload found.';
    const show = { ...selectedRow };
    Object.keys(show).forEach((k) => {
      const s = br(show[k]);
      if (s.length > 120) show[k] = `${s.slice(0, 117)}…`;
    });
    return formatKV(show);
  }, [selectedRow]);

  // Validation (adjusted for Yes/No semTrust)
  const canSubmit = useMemo(() => {
    if (difficulty < 1 || satisfaction < 1) return false;
    if (semUnderstand < 1 || !['Yes', 'No'].includes(semTrust) || semControl < 1) return false;

    if (!selectedIsFirst) {
      if (!whyBetter.trim()) return false;
      if (firstRowRating < 1) return false;
    }
    return true;
  }, [difficulty, satisfaction, semUnderstand, semTrust, semControl, selectedIsFirst, whyBetter, firstRowRating]);

  const handleSubmit = async () => {
    const payload = {
      type: 'page2_thanks',
      page: 'page2',
      artifact: artifactCsv || null,

      selected_row_signature: selectedRow ? {
        model: selectedRow.model ?? null,
        algorithm: selectedRow.algorithm ?? null,
        accuracy: selectedRow.accuracy ?? null,
        utility_value: selectedRow.utility_value ?? null,
      } : null,
      first_row_signature: firstRow ? {
        model: firstRow.model ?? null,
        algorithm: firstRow.algorithm ?? null,
        accuracy: firstRow.accuracy ?? null,
        utility_value: firstRow.utility_value ?? null,
      } : null,

      // core
      difficulty,
      satisfaction,

      // semantic evals
      sem_understandability: semUnderstand,     // 1..5
      sem_trust_discovery: semTrust,            // 'Yes' | 'No'
      sem_control_fit: semControl,              // 1..5

      // conditional comparison
      selected_is_first: selectedIsFirst,
      compare_why_selected_better: selectedIsFirst ? '' : whyBetter.trim(),
      compare_first_row_rating: selectedIsFirst ? null : firstRowRating,

      // optional free text
      open_feedback: feedback.trim(),
    };

    try {
      setSaving(true);
      const res = await fetch('http://194.249.2.210:3001/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to write user log');
      }

      alert('Thanks for your contribution to this research.');
      navigate('/final');
    } catch (e) {
      alert(e.message || 'Failed to save feedback.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'white', color: '#1C39BB' }}>
      <header style={{ padding: '32px 20px 0' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>Thanks for your selection</h1>
      </header>

      <main style={{ padding: 24 }}>
        <div style={box}>
          {/* Selected row summary */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Your selected row (summary)</div>
            <div
              style={{
                background: 'white',
                border: '1px solid #BFD0FF',
                borderRadius: 8,
                padding: 12,
                color: '#1C39BB',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {summary}
            </div>
          </div>

          {/* If selected row is NOT first → show a comparison table like Final.jsx */}
          {!selectedIsFirst && firstRow && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ ...labelStyle, marginBottom: 6 }}>
                Comparison with the top-ranked row
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid #BFD0FF', borderRadius: 10, background: 'white' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', color: '#1C39BB', minWidth: 800 }}>
                  <thead style={{ background: '#E7EEFF' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #BFD0FF', width: 240 }}>Field</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #BFD0FF' }}>Your Selected Row</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #BFD0FF' }}>First Row (Top Result)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allKeys.map((k, idx) => (
                      <tr key={k} style={{ background: idx % 2 ? '#FFFFFF' : '#F8FAFF' }}>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #EEF2FF', fontWeight: 700 }}>
                          {labelize(k)}
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #EEF2FF', whiteSpace: 'nowrap' }}>
                          {cell(selectedRow?.[k])}
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #EEF2FF', whiteSpace: 'nowrap' }}>
                          {cell(firstRow?.[k])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Q1: Difficulty */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={labelStyle}>1) Please rate the difficulty of finding the optimal model:</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <StarRating value={difficulty} onChange={setDifficulty} />
              <span style={{ fontSize: '0.85rem' }}>(1 = Very Easy, 5 = Very Difficult)</span>
            </div>
          </div>

          {/* Q2: System satisfaction */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={labelStyle}>2) How satisfied are you with the system?</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <StarRating value={satisfaction} onChange={setSatisfaction} />
              <span style={{ fontSize: '0.85rem' }}>(1 = Very Dissatisfied, 5 = Very Satisfied)</span>
            </div>
          </div>

          {/* Semantic Qs */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={labelStyle}>3) How Transparent was the process and the results?</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <StarRating value={semUnderstand} onChange={setSemUnderstand} />
              <span style={{ fontSize: '0.85rem' }}>(1 = Opaque, 5 = Fully Transparent)</span>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={labelStyle}>4) Did it help you discover options from other disciplines you wouldn’t have otherwise?</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="semTrust"
                  value="Yes"
                  checked={semTrust === 'Yes'}
                  onChange={() => setSemTrust('Yes')}
                />
                Yes
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="semTrust"
                  value="No"
                  checked={semTrust === 'No'}
                  onChange={() => setSemTrust('No')}
                />
                No
              </label>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={labelStyle}>5) How well did the constraints reflect in the final list?</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <StarRating value={semControl} onChange={setSemControl} />
              <span style={{ fontSize: '0.85rem' }}>(1 = Very Low, 5 = Very High)</span>
            </div>
          </div>

          {/* Conditional comparison questions */}
          {!selectedIsFirst && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={labelStyle}>6) Your selected row was not the top result. Please compare:</div>

              {firstLoadErr ? (
                <div style={{ color: '#CC3333', marginBottom: 8 }}>
                  Couldn’t load the first-row model for comparison: {firstLoadErr}
                </div>
              ) : (
                <>
                  <div style={{ margin: '8px 0' }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      a) Why do you think your selected model is better?
                    </div>
                    <textarea
                      rows={4}
                      value={whyBetter}
                      onChange={(e) => setWhyBetter(e.target.value)}
                      placeholder="Explain your reasoning…"
                      style={textareaStyle}
                    />
                  </div>

                  <div style={{ margin: '8px 0' }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      b) Rate the first-row model:
                    </div>
                    <StarRating value={firstRowRating} onChange={setFirstRowRating} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Optional free text */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={labelStyle}>Additional comments (optional)</div>
            <textarea
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Any other comments about your choice or the list…"
              style={textareaStyle}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || saving}
              style={buttonStyle(canSubmit && !saving)}
              onMouseOver={(e) => {
                if (canSubmit && !saving) e.currentTarget.style.backgroundColor = '#CC3333';
              }}
              onMouseOut={(e) => {
                if (canSubmit && !saving) e.currentTarget.style.backgroundColor = '#1C39BB';
              }}
            >
              {saving ? 'Saving…' : 'Finish'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
