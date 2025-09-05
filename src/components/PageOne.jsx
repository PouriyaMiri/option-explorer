import { useState } from 'react';
import DataTable from './DataTable';
import Timer from './Timer';
import { useNavigate } from 'react-router-dom';

const PageOne = () => {
  const [started, setStarted] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showInfoBox, setShowInfoBox] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [sortColumns, setSortColumns] = useState([]);
  const navigate = useNavigate();

  // small helper to log lightweight activity (non-blocking)
  const ping = (event, meta = {}) =>
    fetch('http://194.249.2.210:3001/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, meta }),
    }).catch(() => {});

  const handleFinish = async () => {
    if (!selectedRow) return;

    ping('finish_clicked', {
      time: timerSeconds,
      sortColumns,
      // avoid huge payloads; include a compact snapshot
      selectedSnapshot: {
        model: selectedRow?.model ?? null,
        algorithm: selectedRow?.algorithm ?? null,
        accuracy: selectedRow?.accuracy ?? null,
        f1_score: selectedRow?.f1_score ?? null,
      },
    });

    const payload = {
      selectedRow,
      sortColumns,
      time: timerSeconds,
    };

    try {
      await fetch('http://194.249.2.210:3001/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      navigate('/thanks');
    } catch {
      alert('Failed to log selection.');
    }
  };

  return (
    <div className="page-one-container relative p-6">
      <h1 className="text-2xl font-bold mb-4">Select a Row from the Table</h1>
      <p className="mb-6">
        Click <strong>"Start"</strong> to load the table from the CSV file. You can sort by up to <strong>three columns in order</strong>.
      </p>

      <div className="flex items-center gap-6 mb-8">
        <button
          onClick={() => {
            setStarted(true);
            setTimerKey((prev) => prev + 1);
            ping('start_clicked');
          }}
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
            onClick={() => {
              setShowInfoBox(false);
              ping('scenario_closed');
            }}
            className="absolute top-2 right-2 px-3 py-1 bg-[#CC3333] text-white rounded hover:bg-[#1C39BB]"
            aria-label="Close scenario information"
          >
            ✕
          </button>
          <h2 className="text-2xl font-bold mb-4 text-center">Scenario Information</h2>
          <p style={{ marginTop: 10, lineHeight: 1.6 }}>
              Imagine you are a <strong>computer vision researcher</strong> at the start of a facial video analysis project.
              You have access to a large database of published papers with different models, datasets, and metrics.
              Your goal is to choose a solid starting point that meets baseline performance.
              <br /><br />
              You can consider: loss, accuracy, recall,
              {' '}precision, f1_score. Your Supervisor requested a model that has at least <strong>80% accuracy</strong>, at least <strong>90% precision</strong> and your hardware is a <strong>GPU</strong> to give you more computational resource, you need to select a model that meets all the requirements with balanced metrics.
              <br /><strong>Accuracy</strong> is how often predictions are correct. <br /> <strong>Precision</strong> is how many of the predicted positives are actually correct.
              <br /><br />
              <strong>When you decide, click a row and then “Next”.</strong>
            </p>
        </div>
      )}

      {started && (
        <>
          <Timer
            key={timerKey}
            onTick={(s) => {
              setTimerSeconds(s);
              // ping less frequently if desired; here we skip to avoid noise
            }}
          />
          <DataTable
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
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1C39BB')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#CC3333')}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default PageOne;
