// src/components/Results.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RESULTS, LOG, ACTIVITY } from '../config/endpoints';
import DataTable from './DataTable';
import { getSessionId } from '../session';
const sessionId = getSessionId();

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';

const RESULTS_ENDPOINT = RESULTS;
const LOG_ENDPOINT = LOG;
const ACTIVITY_ENDPOINT = ACTIVITY;

const Results = () => {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stateMsg, setStateMsg] = useState('Running…');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [csvFile, setCsvFile] = useState(null);

  const pollRef = useRef(null);

  // fire-and-forget activity logger
  const ping = (event, meta = {}) =>
    fetch(ACTIVITY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
      body: JSON.stringify({ sessionId, event, meta, t_client: new Date().toISOString() }),
    }).catch(() => {});

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const tick = async ({ fromPoll = false } = {}) => {
    try {
      if (!fromPoll) setLoading(true);
      setError('');

      const res = await fetch(RESULTS_ENDPOINT, { headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId } });

      if (res.status === 202) {
        setStateMsg('Computing ranking…');
        setLoading(true);
        return;
      }

      if (res.status === 404) {
        setStateMsg('No results available yet.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      // Expect: { ok: true, state: 'done', csv: '...', rows: <count> }
      if (!data || !data.csv) {
        setStateMsg('No results CSV found.');
        setLoading(false);
        return;
      }

      if (Array.isArray(data.rows)){
	setRows(data.rows);
      } else{
	setRows([]);
      }
      setCsvFile(data.csv);
      setLoading(false);
      setStateMsg('');
      stopPolling();
    } catch (_err) {
      setError('Failed to load results.');
      setLoading(false);
    }
  };

  useEffect(() => {
    // initial fetch + start polling
    tick({ fromPoll: false }).catch(() => {});
    pollRef.current = setInterval(() => {
      tick({ fromPoll: true }).catch(() => {});
    }, 1200);

    return () => {
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNext = async () => {
    if (!selectedRow || rows.length === 0) return;
    setSubmitting(true);

    const selectedRowLocal = selectedRow;
    const idx = rows.findIndex((r) => r === selectedRowLocal);
    const selectedIndex = idx >= 0 ? idx : null;
    const topRow = rows[0];

    const now = Date.now();
    const mdpStartStr = localStorage.getItem('mdp_start_time');
    let mdp_time = null;
    let mdp_start_time = null;

    if (mdpStartStr) {
      const startTs = parseInt(mdpStartStr, 10);
      if (!Number.isNaN(startTs)) {
        mdp_time = Math.floor((now - startTs) / 1000);
        mdp_start_time = new Date(startTs).toISOString();
      }
    }
    const mdp_end_time = new Date(now).toISOString();

    // store models for final comparison / thanks page
    try {
      localStorage.setItem('results_selected_model', JSON.stringify(selectedRowLocal));
      localStorage.setItem('results_top_model', JSON.stringify(topRow || null));
    } catch {
      // ignore storage errors
    }

    ping('results_next_clicked', {
      mdp_time,
      mdp_start_time,
      mdp_end_time,
      selectedIndex,
      selectedSnapshot: {
        model: selectedRowLocal?.model ?? null,
        algorithm: selectedRowLocal?.algorithm ?? null,
        accuracy: selectedRowLocal?.accuracy ?? null,
        f1_score: selectedRowLocal?.f1_score ?? null,
      },
    });

    const payload = {
      page: 'results',
      mdp_time,
      mdp_start_time,
      mdp_end_time,
      selectedRow: selectedRowLocal,
      topRow,
    };

    try {
      await fetch(LOG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
        body: JSON.stringify({ sessionId, ...payload }),
      });
    } catch {
      // logging failure is non-fatal
    } finally {
      localStorage.removeItem('mdp_start_time');
    }

    setSubmitting(false);
    navigate('/thanks2');
  };

  const canProceed = !!selectedRow && !submitting && rows.length > 0;

  return (
    <div style={{ padding: '24px', color: '#1C39BB' }}>
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          backgroundColor: '#F7FAFF',
          borderRadius: '12px',
          border: '1px solid #CBD5E1',
          boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
          padding: '20px',
        }}
      >
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem' }}>
          Results
        </h1>
        <p style={{ fontSize: '0.95rem', marginBottom: '1rem', lineHeight: 1.6 }}>
          Below is the ranked list of models produced by our system based on the
          constraints you selected on the previous page. Please select the model you
          would choose to continue your research with, then click <strong>Next</strong>. <strong><bold>IT MAY TAKE UP TO 3 MINUTES FOR THE RESULTS TO APPEAR. PLEASE BE PATIENT.</bold></strong>
        </p>

        {loading && (
          <div style={{ marginTop: '1rem', fontSize: '0.95rem' }}>
            {stateMsg || 'Loading results…'}
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.6rem 0.8rem',
              borderRadius: '6px',
              backgroundColor: '#FEF2F2',
              color: '#B91C1C',
              fontSize: '0.9rem',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && csvFile && rows.length === 0 && (
          <div style={{ marginTop: '1rem', fontSize: '0.95rem' }}>
            No rows available. Please inform the experimenter.
          </div>
        )}

        {!loading && !error && csvFile && (
          <div style={{ marginTop: '1.5rem' }}>
            <DataTable
	      rows={rows}
              csvUrl={rows.length ? null: `${API_BASE}/logs/page2/${csvFile}`}
              showFieldFilter={false}
              selectedRow={selectedRow}
              onDataLoaded={(data) => {
                // same row objects as DataTable uses internally
                
		if (!rows.length && data && data.length) {
		   setRows(data);
              }}}
              onRowSelect={(row) => {
                setSelectedRow(row);

                const idx = rows.findIndex((r) => r === row);
                const index = idx >= 0 ? idx : null;

                ping('results_row_selected', {
                  index,
                  model: row?.model ?? null,
                  algorithm: row?.algorithm ?? null,
                  accuracy: row?.accuracy ?? null,
                  f1_score: row?.f1_score ?? null,
                });
              }}
              onSortChange={(cols) => {
                ping('results_sort_changed', { columns: cols });
              }}
            />
          </div>
        )}

        {/* Next button */}
        <div
          style={{
            marginTop: '1.25rem',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed}
            style={{
              borderRadius: '8px',
              padding: '0.6rem 1.8rem',
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

export default Results;
