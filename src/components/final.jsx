// src/components/Final.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/** ---- Suggested model (provided spec) ---- */
const SUGGESTED_MODEL = {
  field: 'healthcare',
  domain: 'computer vision',
  intent: 'image classification',
  'sub-model': 'image_classification_variant_5',
  layers: 4,
  nodes: '[16, 16, 16, 16]',
  activation_function: 'Tanh',
  kernel_size: 3,
  pool_size: '',
  batch_size: 32,
  epochs: 220,
  processing_unit: 'GPU',
  RAM: 16,
  loss: 0.188,
  accuracy: 0.99,
  recall: 0.837,
  precision: 0.99,
  f1_score: 0.839,
  training_time: 53,
  algorithm: 'Diffusion',
  model: 'Diffusion_Model_45',
};

const ORDER = [
  'field', 'domain', 'intent', 'sub-model',
  'algorithm', 'model', 'processing_unit', 'RAM',
  'layers', 'nodes', 'activation_function',
  'kernel_size', 'pool_size', 'batch_size', 'epochs',
  'accuracy', 'precision', 'recall', 'f1_score', 'loss', 'training_time',
];

const labelize = (k) =>
  k.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

const cell = (v) => (v === undefined || v === null ? '' : String(v));

/** ---- Star style identical to ThanksPage ---- */
const StarRating = ({ value, onChange, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
    {label ? <span style={{ minWidth: 180 }}>{label}</span> : null}
    <div>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onClick={() => onChange(star)}
          style={{
            cursor: 'pointer',
            fontSize: '1.25rem',
            marginRight: '4px',
            color: star <= value ? '#CC3333' : '#D1D5DB',
            userSelect: 'none',
          }}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          {star <= value ? '★' : '☆'}
        </span>
      ))}
    </div>
  </div>
);

export default function Final() {
  const navigate = useNavigate();

  const [userModel, setUserModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Q1
  const [stillBetter, setStillBetter] = useState(''); // 'Y' | 'N'
  const [whyBetter, setWhyBetter] = useState('');
  // Q2
  const [feelRating, setFeelRating] = useState(0);

  // timing
  const tStartRef = useRef(null);

  // Thanks modal
  const [showThanks, setShowThanks] = useState(false);

  const allKeys = useMemo(() => {
    const k = new Set(ORDER);
    if (userModel) Object.keys(userModel).forEach((x) => k.add(x));
    Object.keys(SUGGESTED_MODEL).forEach((x) => k.add(x));
    const extras = Array.from(k).filter((x) => !ORDER.includes(x)).sort();
    return [...ORDER, ...extras];
  }, [userModel]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setErr('');
        // fetch latest session to get the model chosen on Page 1
        const res = await fetch('http://194.249.2.210:3001/latest-session');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        const sess = await res.json();
        const chosen = sess?.selectedRow || null;
        if (!chosen) throw new Error('Could not find the selected model.');
        setUserModel(chosen);

        // mark page-load start time
        tStartRef.current = new Date();
        // optional activity
        fetch('http://194.249.2.210:3001/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'final_page_loaded',
            page: 'final',
            t_start_client: tStartRef.current.toISOString(),
          }),
        }).catch(() => {});
      } catch (e) {
        setErr(e.message || 'Failed to load your selected model.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const canSubmit = useMemo(() => {
    if (!userModel) return false;
    if (stillBetter !== 'Y' && stillBetter !== 'N') return false;
    if (stillBetter === 'Y' && !whyBetter.trim()) return false;
    if (feelRating < 1 || feelRating > 5) return false;
    return true;
  }, [userModel, stillBetter, whyBetter, feelRating]);

  const onFinish = async () => {
    const tEnd = new Date();

    const payload = {
      // store under the same user’s latest session
      final_feedback: {
        t_start_client: tStartRef.current ? tStartRef.current.toISOString() : null,
        t_end_client: tEnd.toISOString(),
        duration_ms_client: tStartRef.current ? (tEnd - tStartRef.current) : null,
        selected_model_page1: userModel,
        suggested_model: SUGGESTED_MODEL,
        answers: {
          thought: stillBetter,             // 'Y' | 'N'
          if_yes: stillBetter === 'Y' ? whyBetter.trim() : '',
          Rating: feelRating,      // 1..5
        },
      },
    };

    try {
      const res = await fetch('http://194.249.2.210:3001/log-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to store your feedback.');
      }
      // show styled modal (no alert)
      setShowThanks(true);
    } catch (e) {
      alert(e.message || 'Failed to record your answers. Please try again.');
    }
  };

  const closeThanks = () => {
    setShowThanks(false);
    // navigate as desired (to /thanks, home, etc.)
    navigate('#', { state: { finalSubmitted: true } });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'white', color: '#1C39BB' }}>
      <header style={{ padding: '24px 20px 0' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>
          Final Comparison
        </h1>
      </header>

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
          {loading ? (
            <div style={{ color: '#4C63C9' }}>Loading…</div>
          ) : err ? (
            <div style={{ color: '#CC3333' }}>{err}</div>
          ) : (
            <>
              {/* Comparison table */}
              <div style={{ overflowX: 'auto', border: '1px solid #BFD0FF', borderRadius: 10, background: 'white' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', color: '#1C39BB', minWidth: 800 }}>
                  <thead style={{ background: '#E7EEFF' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #BFD0FF', width: 240 }}>Field</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #BFD0FF' }}>Your Selected Model</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #BFD0FF' }}>Suggested Model by Our Framework</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allKeys.map((k, idx) => (
                      <tr key={k} style={{ background: idx % 2 ? '#FFFFFF' : '#F8FAFF' }}>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #EEF2FF', fontWeight: 700 }}>
                          {labelize(k)}
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #EEF2FF', whiteSpace: 'nowrap' }}>
                          {cell(userModel?.[k])}
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #EEF2FF', whiteSpace: 'nowrap' }}>
                          {cell(SUGGESTED_MODEL[k])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Questions */}
              <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
                <div
                  style={{
                    border: '1px solid #BFD0FF',
                    borderRadius: 10,
                    background: 'white',
                    padding: 14,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    1) Do you still think your selected model is better?
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 10 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="stillBetter"
                        value="Y"
                        checked={stillBetter === 'Y'}
                        onChange={() => setStillBetter('Y')}
                      />
                      Yes
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="stillBetter"
                        value="N"
                        checked={stillBetter === 'N'}
                        onChange={() => setStillBetter('N')}
                      />
                      No
                    </label>
                  </div>

                  {stillBetter === 'Y' && (
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>
                        If yes: why?
                      </div>
                      <textarea
                        value={whyBetter}
                        onChange={(e) => setWhyBetter(e.target.value)}
                        rows={4}
                        placeholder="Write your reasoning here…"
                        style={{
                          width: '100%',
                          border: '1px solid #1C39BB',
                          borderRadius: 8,
                          padding: '10px 12px',
                          color: '#1C39BB',
                          background: 'white',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                  )}
                </div>

                <div
                  style={{
                    border: '1px solid #BFD0FF',
                    borderRadius: 10,
                    background: 'white',
                    padding: 14,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    2) How do you feel about the suggested model?
                    <span style={{ color: '#4C63C9', marginLeft: 8, fontWeight: 600 }}>
                      (1 = disagree, 5 = full-agree)
                    </span>
                  </div>
                  <StarRating value={feelRating} onChange={setFeelRating} />
                </div>
              </div>

              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={onFinish}
                  disabled={!canSubmit}
                  style={{
                    background: canSubmit ? '#1C39BB' : '#9DB0FF',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 16px',
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                  }}
                  title={canSubmit ? 'Submit your answers' : 'Please complete all questions'}
                >
                  Finish
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* ---- Thanks Modal (same tone as Results instruction modal) ---- */}
      {showThanks && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={closeThanks}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(640px, 92vw)',
              background: '#FFFFFF',
              border: '2px solid #1C39BB',
              borderRadius: 12,
              boxShadow: '0 16px 40px rgba(28,57,187,0.25)',
              padding: 20,
              color: '#1C39BB'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>Thank you</h2>
              <button
                onClick={closeThanks}
                aria-label="Close"
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 22,
                  color: '#1C39BB',
                  cursor: 'pointer',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginTop: 10, lineHeight: 1.5 }}>
              Thanks for your contribution to this research.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                onClick={closeThanks}
                style={{
                  background: '#1C39BB',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 16px',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#CC3333')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#1C39BB')}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
