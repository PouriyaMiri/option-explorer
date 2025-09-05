// src/components/constraints.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ALL_PARAMETERS = [
  'processing_unit', // categorical
  'epochs',
  'RAM',
  'batch_size',
  'pool_size',
  'kernel_size',
  'layers',
  'nodes',
  'precision',
  'f1_score',
  'training_time',
  'algorithm',   // categorical
  'model',       // categorical
  'accuracy',
  'recall',
  'loss',
];

const NUMERIC_PARAMS = new Set([
  'epochs','RAM','batch_size','pool_size','kernel_size','layers','nodes',
  'precision','f1_score','training_time','accuracy','recall','loss'
]);

const CATEGORICAL_ONLY = new Set(['processing_unit','algorithm','model']);

// metrics constrained to [0,1]
const ZERO_ONE_METRICS = new Set(['accuracy','precision','recall','f1_score','loss']);

const SIGNS = ['=', '>', '<', '>=', '<='];

// number inputs that are integers (use step=1)
const INTEGERISH = new Set(['epochs','RAM','batch_size','pool_size','kernel_size','layers','nodes']);

export default function Constraints() {
  const navigate = useNavigate();

  // instruction modal
  const [showInstr, setShowInstr] = useState(false);

  const empty = { selectedParameter: '', selectedSign: '', value: '' };
  const [rows, setRows] = useState([{ ...empty }]);
  const [errors, setErrors] = useState({}); // { idx: "message", ... }

  const selectedCount = useMemo(
    () => rows.filter(r => r.selectedParameter).length,
    [rows]
  );
  const canAddMore = selectedCount < 3;

  const addRow = () => {
    if (!canAddMore) return;
    setRows(prev => [...prev, { ...empty }]);
  };

  const updateRow = (idx, patch) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setErrors(prev => {
      const copy = { ...prev };
      delete copy[idx]; // clear error when user changes something
      return copy;
    });
  };

  const removeRow = (idx) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
    setErrors(prev => {
      const copy = { ...prev };
      // reindex remaining errors
      const next = {};
      Object.entries(copy).forEach(([k, v]) => {
        const i = Number(k);
        if (i < idx) next[i] = v;
        if (i > idx) next[i - 1] = v;
      });
      return next;
    });
  };

  const availableParameters = useMemo(() => {
    const chosen = new Set(rows.map(r => r.selectedParameter).filter(Boolean));
    return ALL_PARAMETERS.filter(p => !chosen.has(p));
  }, [rows]);

  // ---------- validation helpers ----------
  const validateRow = (r) => {
    const p = r.selectedParameter;
    if (!p) return 'Pick a parameter.';

    const isCat = CATEGORICAL_ONLY.has(p);
    const isNum = NUMERIC_PARAMS.has(p);

    if (isCat) {
      if (!r.value) return 'Select a category value.';
      return '';
    }

    if (isNum) {
      if (!r.selectedSign) return 'Pick a sign for numeric parameters.';
      if (r.value === '' || r.value === null || Number.isNaN(Number(r.value))) {
        return 'Enter a numeric value.';
      }
      const val = Number(r.value);

      if (ZERO_ONE_METRICS.has(p)) {
        if (val < 0 || val > 1) return 'Value must be between 0 and 1.';
      } else if (!Number.isFinite(val)) {
        return 'Enter a finite number.';
      }
      return '';
    }

    return 'Unsupported parameter.';
  };

  const coerceValueForDisplay = (p, v) => {
    if (typeof v === 'string') return v.trim();
    return v ?? '';
  };

  const onParamChange = (idx, p) => {
    // reset when parameter changes
    if (CATEGORICAL_ONLY.has(p)) {
      updateRow(idx, { selectedParameter: p, selectedSign: '=', value: '' });
    } else if (NUMERIC_PARAMS.has(p)) {
      updateRow(idx, { selectedParameter: p, selectedSign: '', value: '' });
    } else {
      updateRow(idx, { selectedParameter: p, selectedSign: '', value: '' });
    }
  };

  const onValueChange = (idx, r, raw) => {
    const p = r.selectedParameter;
    let val = raw;

    if (NUMERIC_PARAMS.has(p) && raw !== '') {
      // keep the string in state so the input cursor behaves, but block bad chars
      const cleaned = raw.replace(/[^\d.\-eE+]/g, '');
      if (ZERO_ONE_METRICS.has(p)) {
        const n = Number(cleaned);
        if (!Number.isNaN(n)) {
          if (n < 0) val = '0';
          else if (n > 1) val = '1';
          else val = cleaned;
        } else {
          val = cleaned;
        }
      } else {
        val = cleaned;
      }
    }

    updateRow(idx, { value: val });
  };

  const handleSubmit = async () => {
    // trim to first 3 with a selected parameter, in order
    const ordered = rows
      .filter(r => r.selectedParameter)
      .slice(0, 3);

    // validate
    const nextErrors = {};
    ordered.forEach((r, i) => {
      const msg = validateRow(r);
      if (msg) nextErrors[i] = msg;
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || ordered.length === 0) {
      if (ordered.length === 0) alert('Please add at least one valid constraint.');
      return;
    }

    // payload the server expects: { constraints: [ {selectedParameter, selectedSign, value}, ... ] }
    const payload = ordered.map((r) => ({
      selectedParameter: r.selectedParameter,
      selectedSign: CATEGORICAL_ONLY.has(r.selectedParameter) ? '=' : r.selectedSign,
      value: r.value,
    }));

    try {
      const res = await fetch('http://194.249.2.210:3001/page2/constraints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ constraints: payload }),
      });
      if (!res.ok) throw new Error('Failed to save constraints');
      navigate('/results');
    } catch (e) {
      alert('Error sending constraints to backend.');
    }
  };

  // Close modal on Escape for better UX
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setShowInstr(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'white', color: '#1C39BB' }}>
      <header style={{ padding: '32px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>
            Select Constraints
          </h1>
          <button
            type="button"
            onClick={() => setShowInstr(true)}
            style={{
              marginLeft: '5px',
              background: '#1C39BB',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#CC3333')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#1C39BB')}
            title="Recheck instructions"
          >
            Instructions
          </button>
        </div>

        <p style={{ marginTop: 8, color: '#4C63C9' }}>
          Your first choice has weight <strong>3</strong>, the second <strong>2</strong>, and the third <strong>1</strong>.
        </p>
      </header>

      <main style={{ padding: 20 }}>
        <div
          style={{
            width: '100%',
            maxWidth: 980,
            background: '#F7FAFF',
            border: '1px solid #D0DAFF',
            borderRadius: 14,
            boxShadow: '0 6px 16px rgba(28,57,187,0.10)',
            padding: 18,
            margin: '0 auto',
          }}
        >
          {rows.map((row, idx) => {
            const isNumeric = NUMERIC_PARAMS.has(row.selectedParameter);
            const isCategorical = CATEGORICAL_ONLY.has(row.selectedParameter);
            const errMsg = errors[idx];

            return (
              <div
                key={idx}
                style={{
                  border: '1px solid #BFD0FF',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12,
                  background: 'white',
                }}
              >
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr 1fr 1fr auto' }}>
                  {/* Parameter */}
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Parameter</div>
                    <select
                      value={row.selectedParameter}
                      onChange={(e) => onParamChange(idx, e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: 8,
                        border: '1px solid #1C39BB', color: '#1C39BB', background: 'white'
                      }}
                    >
                      <option value="">Select parameter</option>
                      {[row.selectedParameter, ...availableParameters]
                        .filter(Boolean)
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                  </div>

                  {/* Sign */}
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Sign</div>
                    <select
                      disabled={isCategorical || !row.selectedParameter}
                      value={isCategorical ? '=' : row.selectedSign}
                      onChange={(e) => updateRow(idx, { selectedSign: e.target.value })}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: 8,
                        border: '1px solid #1C39BB',
                        color: '#1C39BB',
                        background: (isCategorical || !row.selectedParameter) ? '#F1F5FF' : 'white'
                      }}
                    >
                      <option value="">—</option>
                      {SIGNS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Value */}
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      {isCategorical ? 'Value (category)' : 'Value'}
                    </div>

                    {isCategorical ? (
                      <select
                        value={coerceValueForDisplay(row.selectedParameter, row.value)}
                        onChange={(e) => updateRow(idx, { value: e.target.value })}
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: 8,
                          border: '1px solid #1C39BB', color: '#1C39BB', background: 'white'
                        }}
                      >
                        <option value="">Select…</option>
                        {row.selectedParameter === 'processing_unit' && (
                          <>
                            <option value="CPU">CPU</option>
                            <option value="GPU">GPU</option>
                          </>
                        )}
                        {row.selectedParameter === 'algorithm' && (
                          <>
                            <option value="SVM">SVM</option>
                            <option value="RandomForest">RandomForest</option>
                            <option value="CNN">CNN</option>
                            <option value="RNN">RNN</option>
                          </>
                        )}
                        {row.selectedParameter === 'model' && (
                          <>
                            <option value="ResNet">ResNet</option>
                            <option value="VGG">VGG</option>
                            <option value="MobileNet">MobileNet</option>
                          </>
                        )}
                      </select>
                    ) : (
                      <input
                        type="number"
                        value={coerceValueForDisplay(row.selectedParameter, row.value)}
                        onChange={(e) => onValueChange(idx, row, e.target.value)}
                        disabled={!isNumeric || !row.selectedSign}
                        step={
                          ZERO_ONE_METRICS.has(row.selectedParameter) ? '0.01'
                          : INTEGERISH.has(row.selectedParameter) ? '1'
                          : '0.1'
                        }
                        min={ZERO_ONE_METRICS.has(row.selectedParameter) ? '0' : undefined}
                        max={ZERO_ONE_METRICS.has(row.selectedParameter) ? '1' : undefined}
                        placeholder={
                          isNumeric
                            ? ZERO_ONE_METRICS.has(row.selectedParameter)
                              ? 'e.g. 0.80'
                              : 'Enter number'
                            : '—'
                        }
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: 8,
                          border: '1px solid #1C39BB', color: '#1C39BB',
                          background: isNumeric && row.selectedSign ? 'white' : '#F1F5FF'
                        }}
                      />
                    )}
                  </div>

                  {/* Order (weight hint) */}
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6, marginLeft: 20 }}>Order</div>
                    <div style={{
                      height: 40, display: 'flex', alignItems: 'center', marginLeft: 20,
                      justifyContent: 'center', border: '1px dashed #BFD0FF', borderRadius: 8,
                      color: '#4C63C9'
                    }}>
                      {idx + 1} <span style={{ marginLeft: 6, fontSize: 12, color: '#7A93FF' }}>
                      </span>
                    </div>
                  </div>

                  {/* Remove */}
                  <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      style={{
                        background: '#EEF2FF', color: '#1C39BB', border: '1px solid #BFD0FF',
                        padding: '8px 12px', borderRadius: 8, cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {errMsg && (
                  <div style={{ marginTop: 8, color: '#CC3333', fontSize: 13 }}>
                    {errMsg}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <div style={{ color: '#4C63C9' }}>Selected: {selectedCount} / 3</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={addRow}
                disabled={!canAddMore}
                style={{
                  background: canAddMore ? '#1C39BB' : '#9DB0FF',
                  color: 'white', border: 'none', padding: '10px 14px',
                  borderRadius: 8, cursor: canAddMore ? 'pointer' : 'not-allowed'
                }}
                onMouseOver={(e) => { if (canAddMore) e.currentTarget.style.background = '#CC3333'; }}
                onMouseOut={(e) => { if (canAddMore) e.currentTarget.style.background = '#1C39BB'; }}
              >
                Add Constraint
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={selectedCount === 0}
                style={{
                  background: selectedCount > 0 ? '#1C39BB' : '#9DB0FF',
                  color: 'white', border: 'none', padding: '10px 16px',
                  borderRadius: 8, cursor: selectedCount > 0 ? 'pointer' : 'not-allowed'
                }}
                onMouseOver={(e) => { if (selectedCount > 0) e.currentTarget.style.background = '#CC3333'; }}
                onMouseOut={(e) => { if (selectedCount > 0) e.currentTarget.style.background = '#1C39BB'; }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ---- Instruction Modal ---- */}
      {showInstr && (
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
          onClick={() => setShowInstr(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(720px, 92vw)',
              background: '#FFFFFF',
              border: '2px solid #1C39BB',
              borderRadius: 12,
              boxShadow: '0 16px 40px rgba(28,57,187,0.25)',
              padding: 20,
              color: '#1C39BB'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>Instructions</h2>
              <button
                onClick={() => setShowInstr(false)}
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

            <div style={{ marginTop: 10, lineHeight: 1.55 }}>
              <p style={{ marginTop: 0 }}>
              Imagine you are a <strong>computer vision researcher</strong> at the start of a facial video analysis project. You have access to a large database of published papers with different models, datasets, and metrics. Your goal is to choose a solid starting point that meets baseline performance. <br />
              Your Supervisor requested a model that has at least <strong>80% accuracy</strong>, at least <strong>90% precision</strong> and your hardware is a <strong>GPU</strong> to give you more computational resource, you need to select a model that meets all the requirements with balanced metrics. <br />Accuracy is how often predictions are correct. <br />Precision is how many of the predicted positives are actually correct.<br /> <br /> <strong>When you decide, click a row and then “Next”.</strong>
            </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setShowInstr(false)}
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
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
