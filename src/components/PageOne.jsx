// PageOne.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from './DataTable';
import Timer from './Timer';
import { ACTIVITY,LOG } from "../config/endpoints";
import { getSessionId } from '../session';

const ACTIVITY_ENDPOINT = ACTIVITY;
const LOG_ENDPOINT = LOG;
const sessionId = getSessionId();

const PageOne = () => {
  const [started, setStarted] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);

  const [manualStartTime, setManualStartTime] = useState(null);
  //const [manualEndTime, setManualEndTime] = useState(null);

  const [showInfoBox, setShowInfoBox] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [sortColumns, setSortColumns] = useState([]);

  const navigate = useNavigate();

  // small helper to log lightweight activity (non-blocking)
  const ping = (event, meta = {}) =>
    fetch(ACTIVITY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' , 'x-session-id': sessionId },
      body: JSON.stringify({ sessionId, event, meta }),
    }).catch(() => {});

  const handleStart = () => {
    const now = Date.now();

    setStarted(true);
    setTimerKey((prev) => prev + 1); // to reset Timer if user re-starts
    setManualStartTime(now);
    //setManualEndTime(null);
    setTimerSeconds(0);

    ping('page1_timer_start', {
      t_client: new Date(now).toISOString(),
    });
  };

  const handleFinish = async () => {
  if (!selectedRow) return;

  // 🔹 Store manual selection for the final comparison page
  try {
    localStorage.setItem('manual_selected_model', JSON.stringify(selectedRow));
  } catch {
    // ignore storage errors – they only affect the final comparison view
  }

  const endTs = Date.now();
 //setManualEndTime(endTs);

  const manual_time = timerSeconds;
  const manual_start_time =
    manualStartTime != null ? new Date(manualStartTime).toISOString() : null;
  const manual_end_time = new Date(endTs).toISOString();

  // Activity log (lightweight)
  ping('page1_finish_clicked', {
    manual_time,
    manual_start_time,
    manual_end_time,
    sortColumns,
    selectedSnapshot: {
      model: selectedRow?.model ?? null,
      algorithm: selectedRow?.algorithm ?? null,
      accuracy: selectedRow?.accuracy ?? null,
      f1_score: selectedRow?.f1_score ?? null,
    },
  });

  // Main log entry for backend storage
  const payload = {
    page: 'page1',
    manual_time,
    manual_start_time,
    manual_end_time,
    sortColumns,
    selectedRow,
  };

  try {
    await fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,
      },
      body: JSON.stringify({ sessionId, ...payload }),
    });

    navigate('/thanks'); // or whatever route renders thanks.jsx
  } catch (err) {
    alert('Failed to log selection. Please inform the experimenter.');
  }
};


  return (
    <div className="page-one-container relative p-6">
      <h1 className="text-2xl font-bold mb-4">Select a Row from the Table</h1>

      <p className="mb-6 text-slate-700">
        Click <strong>"Start"</strong> to see the table. You can
        sort by up to <strong>three columns in order</strong> then the rows will be sorted based on the selected columns (from high to low). When you are satisfied
        with your choice, click a row (it will be highlighted) and then click{' '}
        <strong>"Next"</strong>.
      </p>



	<p className="mb-6 text-slate-700">
	  <strong>IT MAY TAKE UP TO MINUTE TO SHOW THE TABLE</strong>
	  </p>
      {/* Start + scenario buttons */}
      <div className="flex items-center gap-6 mb-8">
        <button
          onClick={handleStart}
          className="bg-[#1C39BB] text-white hover:bg-[#CC3333] px-4 py-2 rounded"
        >
          Start
        </button>

        <button
          onClick={() => {
            setShowInfoBox(true);
            ping('scenario_opened');
          }}
          className="bg-[#1C39BB] text-white hover:bg-[#CC3333] px-4 py-2 rounded"
        >
          Check Scenario
        </button>
      </div>

      {/* Scenario / info box */}
      {showInfoBox && (
        <div
          className="mb-8 relative mx-auto text-[#1C39BB]"
          style={{
            maxWidth: '900px',
            backgroundColor: '#F0F4FF',
            border: '2px solid #1C39BB',
            borderRadius: '0.75rem',
            boxShadow: '0 6px 12px rgba(0,0,0,0.15)',
            padding: '2rem',
            lineHeight: '1.6',
          }}
        >
          <button
            onClick={() => setShowInfoBox(false)}
            className="absolute top-3 right-3 text-sm text-[#1C39BB] hover:text-[#CC3333]"
          >
            ✕
          </button>
          <h2 className="font-bold mb-2">Scenario Reminder</h2>
          <p>
            Imagine you are a <strong>computer vision researcher</strong> working on
            a facial video analysis project. You are choosing a starting model from
            existing papers.
            <br />
            <br />
            You can consider: <strong>loss</strong>, <strong>accuracy</strong>,{' '}
            <strong>recall</strong>, <strong>precision</strong>,{' '}
            <strong>f1_score</strong>.
            <br />
            Your supervisor requested a model with at least{' '}
            <strong>80% accuracy</strong>, at least <strong>90% precision</strong>,
            and using a <strong>GPU</strong> as processing unit. Select a model that
            meets these requirements and has balanced metrics.
            <br />
            <br />
            <strong>Accuracy</strong> is how often predictions are correct.
            <br />
            <strong>Precision</strong> is how many of the predicted positives are
            actually correct.
            <br />
            <br />
            <strong>When you decide, click a row and then “Next”.</strong>
          </p>
        </div>
      )}

      {/* Timer + table appear only after start */}
      {started && (
        <>
          <Timer
            key={timerKey}
            startTime={manualStartTime}
            onTick={(s) => {
              setTimerSeconds(s);
              // ticks are used to compute manual_time on finish
            }}
          />

          <DataTable
	    //csvUrl="/page1/data"
            onRowSelect={(row) => {
              setSelectedRow(row);
              ping('row_selected', {
                model: row?.model ?? null,
                algorithm: row?.algorithm ?? null,
                accuracy: row?.accuracy ?? null,
                f1_score: row?.f1_score ?? null,
              });
            }}
            onSortChange={(cols) => {
              setSortColumns(cols);
              ping('sort_changed', { columns: cols });
            }}
            selectedRow={selectedRow}
          />
        </>
      )}

      {/* Floating Next button once a row is selected */}
      {selectedRow && (
        <div
          style={{
            position: 'fixed',
            bottom: '1rem',
            right: '1rem',
            zIndex: 50,
          }}
        >
          <button
            onClick={handleFinish}
            className="px-6 py-3 rounded text-lg font-semibold text-white transition-colors duration-300 shadow-lg"
            style={{ backgroundColor: '#CC3333' }}
            onMouseOver={(e) =>
              (e.currentTarget.style.backgroundColor = '#1C39BB')
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor = '#CC3333')
            }
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default PageOne;
