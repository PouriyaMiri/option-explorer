// src/components/Page2.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACTIVITY, PAGE2, METAD } from '../config/endpoints';
import { getSessionId } from '../session';
const sessionId = getSessionId();

const ACTIVITY_ENDPOINT = ACTIVITY;
const CONSTRAINTS_ENDPOINT = PAGE2;

// Parameter choices
const PARAMETER_OPTIONS = [
  // metrics
  'accuracy',
  'precision',
  'recall',
  'f1_score',
  'loss',
  'training_time',
  // architecture / resources
  'processing_unit',
  'RAM',
  'epochs',
  'batch_size',
  'layers',
  'nodes',
  'kernel_size',
  'pool_size',
  // semantic
  'field',
  'domain',
  'intent',
  'algorithm',
  'model',
];





// For display purposes
const prettyName = (key) => {
  if (!key) return '';
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const SIGNS = ['>=', '<=', '=', '>', '<'];

/** fire-and-forget activity logging */
const ping = (event, meta = {}) =>
  fetch(ACTIVITY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
    body: JSON.stringify({ event, meta, t_client: new Date().toISOString() }),
  }).catch(() => {});

const Page2 = () => {
  const navigate = useNavigate();

  // dynamic metadata from backend
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState('');

  const [groupSize, setGroupSize] = useState(3); // 1,3,5
  const [assignmentReady, setAssignmentReady] = useState(false);

  // Constraints array, in order
  const [constraints, setConstraints] = useState([]);
  // Which index is currently editable
  const [activeIndex, setActiveIndex] = useState(0);
  // Lock info (order + timestamp)
  const [lockEvents, setLockEvents] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ----------- METADATA LOAD (dynamic limits/signs) -----------

  useEffect(() => {
    fetch(METAD)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setMeta(data.metadata || {});
      })
      .catch((err) => {
        console.error('Failed to load metadata', err);
        setMetaError(
          'Failed to load dataset information. Constraints will be less strict.'
        );
      });
  }, []);

  const getParamMeta = (param) => {
    if (!meta || !param) return null;
    return meta[param] || null;
  };

  const getAllowedSigns = (param) => {
    const m = getParamMeta(param);
    if (!m) return SIGNS;
    if (Array.isArray(m.signs)) return m.signs;
    if (m.type === 'categorical') return ['='];
    return SIGNS;
  };

  // ----------- ASSIGNMENT: 1 vs 3 vs 5 constraints -----------

  useEffect(() => {
    // Reuse assignment if present in localStorage for this browser
    const stored = localStorage.getItem('constraint_group_size');
    let size;
    if (stored === '1' || stored === '3' || stored === '5') {
      size = parseInt(stored, 10);
    } else {
      // Randomly choose 1, 3, or 5 with equal probability
      const options = [1, 3, 5];
      size = options[Math.floor(Math.random() * options.length)];
      localStorage.setItem('constraint_group_size', String(size));
    }

    setGroupSize(size);
    setConstraints(
      Array.from({ length: size }, () => ({
        selectedParameter: '',
        selectedSign: '>=',
        value: '',
        locked: false,
        lockedAt: null,
      })),
    );
    setActiveIndex(0);
    setLockEvents([]);

    ping('page2_assignment', { groupSize: size });
    setAssignmentReady(true);
  }, []);

  const isThreeConstraintGroup = useMemo(() => groupSize === 3, [groupSize]);

  const requiredForThree = useMemo(
    () => new Set(['accuracy', 'precision', 'processing_unit']),
    [],
  );

  const selectedParams = useMemo(
    () => constraints.map((c) => (c.selectedParameter || '').trim()),
    [constraints],
  );

  // whether all constraints are locked
  const allLocked = useMemo(
    () => assignmentReady && groupSize > 0 && constraints.every((c) => c.locked),
    [assignmentReady, groupSize, constraints],
  );

  const threeGroupValid = useMemo(() => {
    if (!isThreeConstraintGroup) return true;
    if (!allLocked) return false;
    const set = new Set(selectedParams.filter(Boolean));
    if (set.size !== 3) return false;
    for (const p of requiredForThree) {
      if (!set.has(p)) return false;
    }
    return true;
  }, [isThreeConstraintGroup, allLocked, selectedParams, requiredForThree]);

  const canProceed = allLocked && threeGroupValid && !submitting;

  // ----------- HANDLERS -----------

  const handleParamChange = (idx, param) => {
    if (idx !== activeIndex) return; // enforce in-order

    setConstraints((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const next = { ...c, selectedParameter: param };

        const m = getParamMeta(param);
        // Categorical (e.g. processing_unit) → force '='
        if (m && m.type === 'categorical') {
          next.selectedSign = '=';
        }

        return next;
      }),
    );

    ping('page2_param_changed', { index: idx, param });
  };

  const handleSignChange = (idx, sign) => {
    if (idx !== activeIndex) return;
    setConstraints((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, selectedSign: sign } : c)),
    );
    ping('page2_sign_changed', { index: idx, sign });
  };

  const handleValueChange = (idx, value) => {
    if (idx !== activeIndex) return;
    setConstraints((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, value } : c)),
    );
  };

  const handleLock = (idx) => {
    if (idx !== activeIndex) return;

    const c = constraints[idx];
    const param = c.selectedParameter;
    const raw = (c.value || '').trim();
    const m = getParamMeta(param);

    if (!param || !raw) {
      setErrorMsg('Please fill parameter and value before locking.');
      return;
    }

    // Categorical validation (e.g. processing_unit CPU/GPU)
    if (m && m.type === 'categorical') {
      const allowed = new Set(m.values || []);
      if (!allowed.has(raw)) {
        setErrorMsg(
          `Value for ${prettyName(param)} must be one of: ${Array.from(allowed).join(
            ', ',
          )}`,
        );
        return;
      }
    }

    // Numeric range validation (e.g. accuracy in [0,1])
    if (m && m.type === 'numeric') {
      const num = Number(raw.replace(',', '.'));
      if (!Number.isFinite(num)) {
        setErrorMsg(`Value for ${prettyName(param)} must be a number.`);
        return;
      }
      if (m.min != null && num < m.min) {
        setErrorMsg(
          `Value for ${prettyName(param)} must be at least ${m.min}.`,
        );
        return;
      }
      if (m.max != null && num > m.max) {
        setErrorMsg(
          `Value for ${prettyName(param)} must be at most ${m.max}.`,
        );
        return;
      }
    }

    setErrorMsg('');

    const now = Date.now();
    const iso = new Date(now).toISOString();

    setConstraints((prev) =>
      prev.map((row, i) =>
        i === idx ? { ...row, locked: true, lockedAt: iso } : row,
      ),
    );

    setLockEvents((prev) => [
      ...prev,
      {
        index: idx,
        order: idx + 1,
        t: iso,
        selectedParameter: c.selectedParameter,
        selectedSign: c.selectedSign,
        value: c.value,
      },
    ]);

    // Advance to next constraint if any
    if (idx + 1 < groupSize) {
      setActiveIndex(idx + 1);
    }

    ping('page2_constraint_locked', {
      index: idx,
      order: idx + 1,
      param: c.selectedParameter,
      sign: c.selectedSign,
      value: c.value,
      t_locked: iso,
    });
  };


  const handleUnlock = (idx) => {
    // Allow unlocking any locked row
    setConstraints((prev) =>
      prev.map((row, i) =>
        i === idx ? { ...row, locked: false, lockedAt: null } : row,
      ),
    );

    // Make this row the active editable one again
    setActiveIndex(idx);

    // Clear any generic error message
    setErrorMsg('');

    // Optional logging
    ping('page2_constraint_unlocked', { index: idx });
  };
	
  const handleSubmit = async () => {
    if (!canProceed) return;
    setSubmitting(true);
    setErrorMsg('');

    // Build minimal constraints array in the shape backend expects:
    //  [{ selectedParameter, selectedSign, value }, ...]
    const pureConstraints = constraints.map((c) => ({
      selectedParameter: c.selectedParameter,
      selectedSign: c.selectedSign,
      value: c.value,
    }));

    // 1) Log detailed click/assignment info to activity
    ping('page2_submit_constraints', {
      groupSize,
      lockEvents,
      constraints: pureConstraints,
    });

    try {
      // 2) Send constraints to backend; this triggers ranking / MDP pipeline
      const res = await fetch(CONSTRAINTS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
        body: JSON.stringify({ sessionId, constraints: pureConstraints }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // 3) Start MDP timer -> stored in localStorage so Results page can read it
      const now = Date.now();
      localStorage.setItem('mdp_start_time', String(now));
      ping('mdp_timer_start', { t_client: new Date(now).toISOString() });

      // 4) Go to results page; MDP_time will be closed when user clicks Next there
      navigate('/results');
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to submit constraints. Please try again.');
      setSubmitting(false);
    }
  };

  // ----------- UI -----------

  const groupDescription = useMemo(() => {
    if (!assignmentReady) return '';
    if (groupSize === 1) {
      return 'You have been assigned to select exactly 1 constraint of your choice.';
    }
    if (groupSize === 3) {
      return 'You have been assigned to select exactly 3 constraints: accuracy, precision, and processing unit (in any order).';
    }
    if (groupSize === 5) {
      return 'You have been assigned to select exactly 5 constraints of your choice.';
    }
    return '';
  }, [assignmentReady, groupSize]);

  return (
    <div style={{ padding: '24px', color: '#1C39BB' }}>
      <div
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          backgroundColor: '#F7FAFF',
          borderRadius: '12px',
          border: '1px solid #CBD5E1',
          boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
          padding: '20px',
        }}
      >
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem' }}>
          Constraint Selection
        </h1>
        <p style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1rem' }}>
          On this page, you will configure constraints for Option Explorer. You must
          complete the required number of constraints in order before you can continue.
        </p>

        {metaError && (
          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              backgroundColor: '#FEF3C7',
              color: '#92400E',
              fontSize: '0.9rem',
            }}
          >
            {metaError}
          </div>
        )}

        {assignmentReady ? (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: '#E0EBFF',
            }}
          >
            <strong>Assignment:</strong>{' '}
            <span>{groupDescription}</span>
          </div>
        ) : (
          <p>Assigning your condition…</p>
        )}

        {isThreeConstraintGroup && (
          <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
            Required parameters (in any order):{' '}
            <strong>accuracy</strong>, <strong>precision</strong>,{' '}
            <strong>processing unit</strong>.
          </p>
        )}

        {errorMsg && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              backgroundColor: '#FEF2F2',
              color: '#B91C1C',
              fontSize: '0.9rem',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Constraints table */}
        <div
          style={{
            marginTop: '1rem',
            borderRadius: '10px',
            border: '1px solid #CBD5E1',
            overflow: 'hidden',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: 'white',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: '#E5EDFF',
                  textAlign: 'left',
                  fontSize: '0.9rem',
                }}
              >
                <th style={{ padding: '8px 10px', width: '5%' }}>#</th>
                <th style={{ padding: '8px 10px', width: '30%' }}>Parameter</th>
                <th style={{ padding: '8px 10px', width: '15%' }}>Sign</th>
                <th style={{ padding: '8px 10px', width: '30%' }}>Value</th>
                <th style={{ padding: '8px 10px', width: '20%' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {constraints.map((c, idx) => {
                const isActive = idx === activeIndex && !c.locked;
                const disabled = !isActive || submitting || !assignmentReady;
                const paramMeta = getParamMeta(c.selectedParameter);

                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid #E5E7EB',
                      backgroundColor: c.locked ? '#F1F5F9' : 'white',
                    }}
                  >
                    <td style={{ padding: '8px 10px' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <select
                        value={c.selectedParameter}
                        disabled={disabled}
                        onChange={(e) => handleParamChange(idx, e.target.value)}
                        style={{
                          width: '100%',
                          borderRadius: '6px',
                          padding: '4px 6px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: disabled ? '#F9FAFB' : 'white',
                        }}
                      >
                        <option value="">Select parameter…</option>
                        {PARAMETER_OPTIONS.map((p) => (
                          <option key={p} value={p}>
                            {prettyName(p)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <select
                        value={c.selectedSign}
                        disabled={disabled}
                        onChange={(e) => handleSignChange(idx, e.target.value)}
                        style={{
                          width: '100%',
                          borderRadius: '6px',
                          padding: '4px 6px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: disabled ? '#F9FAFB' : 'white',
                        }}
                      >
                        {getAllowedSigns(c.selectedParameter).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {/* Dynamic value input: dropdown for categorical, ranged number for numeric */}
                      {paramMeta && paramMeta.type === 'categorical' ? (
                        <select
                          value={c.value}
                          disabled={disabled}
                          onChange={(e) => handleValueChange(idx, e.target.value)}
                          style={{
                            width: '100%',
                            borderRadius: '6px',
                            padding: '4px 6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: disabled ? '#F9FAFB' : 'white',
                          }}
                        >
                          <option value="">Select value…</option>
                          {(paramMeta.values || []).map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ) : paramMeta && paramMeta.type === 'numeric' ? (
                        <input
                          type="number"
                          value={c.value}
                          disabled={disabled}
                          min={paramMeta.min != null ? paramMeta.min : undefined}
                          max={paramMeta.max != null ? paramMeta.max : undefined}
                          step={0.01}
                          onChange={(e) => handleValueChange(idx, e.target.value)}
                          placeholder={
                            paramMeta.min != null && paramMeta.max != null
                              ? `Between ${paramMeta.min} and ${paramMeta.max}`
                              : 'Enter numeric value…'
                          }
                          style={{
                            width: '100%',
                            borderRadius: '6px',
                            padding: '4px 6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: disabled ? '#F9FAFB' : 'white',
                          }}
                        />
                      ) : (
                        <input
                          type="text"
                          value={c.value}
                          disabled={disabled}
                          onChange={(e) => handleValueChange(idx, e.target.value)}
                          placeholder="Enter value…"
                          style={{
                            width: '100%',
                            borderRadius: '6px',
                            padding: '4px 6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: disabled ? '#F9FAFB' : 'white',
                          }}
                        />
                      )}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
			{c.locked ? (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
				<span style={{ fontSize: '0.85rem', color: '#16A34A' }}>
				   Locked {c.lockedAt ? `(${c.lockedAt})` : ''}
				</span>
      				<button
        				type="button"
        				disabled={submitting || !assignmentReady}
        				onClick={() => handleUnlock(idx)}
        				style={{
          					padding: '4px 8px',
          					borderRadius: '6px',
          					border: '1px solid #CBD5E1',
          					fontSize: '0.8rem',
          					fontWeight: 500,
          					color: '#1C39BB',
          					cursor: submitting || !assignmentReady ? 'not-allowed' : 'pointer',
          					backgroundColor: 'white',
       	 				}}
        				onMouseOver={(e) => {
          					if (!submitting && assignmentReady)
            					   e.currentTarget.style.backgroundColor = '#E5EDFF';
        				}}
        				onMouseOut={(e) => {
          					e.currentTarget.style.backgroundColor = 'white';
        				}}
      				       >
        			Unlock
      			    </button>
    			</div>
  		) : (
    			<button
      			  type="button"
      			  disabled={disabled}
      			  onClick={() => handleLock(idx)}
      			  style={{
     			   padding: '6px 10px',
     			   borderRadius: '6px',
     			   border: 'none',
     			   fontSize: '0.9rem',
    			   fontWeight: 600,
    			   color: 'white',
      			   cursor: disabled ? 'not-allowed' : 'pointer',
     			   backgroundColor: disabled ? '#94A3B8' : '#1C39BB',
     			  }}
      			onMouseOver={(e) => {
        			if (!disabled)
          				e.currentTarget.style.backgroundColor = '#CC3333';
      			}}
     	 		onMouseOut={(e) => {
       			 if (!disabled)
        		  e.currentTarget.style.backgroundColor = '#1C39BB';
      			}}
    			>
      			Lock
    		</button>
 	       )}
		</td>



			</tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer actions */}
        <div
          style={{
            marginTop: '1.25rem',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canProceed}
            style={{
              borderRadius: '8px',
              padding: '0.6rem 1.6rem',
              border: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: canProceed ? 'pointer' : 'not-allowed',
              backgroundColor: canProceed ? '#1C39BB' : '#94A3B8',
              color: 'white',
            }}
            onMouseOver={(e) => {
              if (canProceed) e.currentTarget.style.backgroundColor = '#CC3333';
            }}
            onMouseOut={(e) => {
              if (canProceed) e.currentTarget.style.backgroundColor = '#1C39BB';
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default Page2;
