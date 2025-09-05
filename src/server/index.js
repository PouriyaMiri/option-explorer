// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

/* ------------------------------ Directories ------------------------------ */

const DIRS = {
  root: path.join(__dirname, 'logs'),
  sessions: path.join(__dirname, 'logs', 'sessions'),
  auth: path.join(__dirname, 'logs', 'auth'),
  activity: path.join(__dirname, 'logs', 'activity'),
  page2: path.join(__dirname, 'logs', 'page2'),
  dataArtifacts: path.join(__dirname, 'data'),
};

// ensure folder structure
for (const d of Object.values(DIRS)) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

/* ------------------------------ Helpers ------------------------------ */

const getClientIP = (req) =>
  (req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    'unknown').trim();

const getUserKey = (req) => getClientIP(req).replace(/[^a-zA-Z0-9_-]/g, '_');

const readJsonSafe = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
};

const writeJsonPretty = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

// find the latest *constraints* json for user (exclude status and ranked_list files)
function getLatestPage2JsonForUser(userKey) {
  const files = fs
    .readdirSync(DIRS.page2)
    .filter(
      (f) =>
        f.startsWith(`${userKey}_`) &&
        f.endsWith('.json') &&
        !f.endsWith('_status.json') &&
        !f.includes('ranked_list') // exclude ranked_list*.json
    )
    .sort()
    .reverse();
  if (!files.length) return null;
  return path.join(DIRS.page2, files[0]);
}

function writeStatus(userKey, status) {
  const file = path.join(DIRS.page2, `${userKey}_status.json`);
  const prev = readJsonSafe(file) || {};
  writeJsonPretty(file, { ...prev, ...status, ts: new Date().toISOString() });
}
function readStatus(userKey) {
  const file = path.join(DIRS.page2, `${userKey}_status.json`);
  return readJsonSafe(file) || { state: 'idle' };
}

function resolvePythonExe() {
  if (process.env.PYTHON && process.env.PYTHON.trim()) return process.env.PYTHON.trim();
  // default: rely on PATH
  return 'python3';
}

function resolveDatasetPath() {
  if (process.env.DATASET_PATH && fs.existsSync(process.env.DATASET_PATH)) {
    return process.env.DATASET_PATH;
  }
  const candidates = [
    path.join(__dirname, 'public', 'data', 'data.csv'),
    path.join(process.cwd(), 'public', 'data', 'data.csv'),
    path.join(__dirname, '..', 'public', 'data', 'data.csv'),
    path.join(__dirname, '..', '..', 'public', 'data', 'data.csv'),
    path.join(__dirname, 'data', 'data.csv'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/* ------------------------------ Health ------------------------------ */

app.get('/health', (_req, res) => res.json({ ok: true }));

/* ------------------------------ Page One ------------------------------ */

const getUserSessionFiles = (userKey) => {
  const files = fs.readdirSync(DIRS.sessions).filter((f) => {
    return f.startsWith(`${userKey}_`) && f.endsWith('.json');
  });
  return files.sort((a, b) => {
    const na = parseInt(a.split('_').pop(), 10);
    const nb = parseInt(b.split('_').pop(), 10);
    return nb - na;
  });
};

const getNextSessionIndex = (userKey) => {
  const files = getUserSessionFiles(userKey);
  if (files.length === 0) return 1;
  const latest = files[0];
  const latestIndex = parseInt(latest.split('_').pop(), 10) || 0;
  return latestIndex + 1;
};

app.post('/log', (req, res) => {
  try {
    const ip = getClientIP(req);
    const userKey = getUserKey(req);
    const index = getNextSessionIndex(userKey);
    const filename = `${userKey}_${index}.json`;
    const filePath = path.join(DIRS.sessions, filename);

    const payload = {
      type: 'selection',
      userKey,
      ip,
      index,
      timestamp: new Date().toISOString(),
      ...req.body,
    };

    // --- Compute Page-2 experiment duration on the server when provided ---
    // Expecting client to send:
    //   experiment_t_start (ISO) -> when Results finished loading
    //   experiment_t_end   (ISO) -> when Finish was clicked
    if (payload.experiment_t_start && payload.experiment_t_end) {
      const t0 = Date.parse(payload.experiment_t_start);
      const t1 = Date.parse(payload.experiment_t_end);
      if (!Number.isNaN(t0) && !Number.isNaN(t1) && t1 >= t0) {
        payload.experiment_duration_ms_server = t1 - t0;
      }
    }

    writeJsonPretty(filePath, payload);
    return res.status(200).json({ message: 'Selection logged', filename, index });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to write selection log' });
  }
});

app.post('/log-feedback', (req, res) => {
  try {
    const userKey = getUserKey(req);
    const files = getUserSessionFiles(userKey);
    if (files.length === 0) return res.status(404).json({ error: 'No session file found for user' });

    const latestFile = files[0];
    const filePath = path.join(DIRS.sessions, latestFile);
    const existing = readJsonSafe(filePath) || {};

    const feedback = {
      type: 'feedback',
      timestamp: new Date().toISOString(),
      ...req.body,
    };

    const updated = { ...existing, feedback };
    writeJsonPretty(filePath, updated);
    return res.status(200).json({ message: 'Feedback logged', filename: latestFile });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to write feedback' });
  }
});

app.get('/latest-log', (req, res) => {
  try {
    const userKey = getUserKey(req);
    const files = getUserSessionFiles(userKey);
    if (files.length === 0) return res.json([]);

    const latest = readJsonSafe(path.join(DIRS.sessions, files[0])) || {};
    const arr = Array.isArray(latest.sortColumns) ? latest.sortColumns : [];
    return res.json(arr);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read latest log' });
  }
});

app.get('/latest-session', (req, res) => {
  try {
    const userKey = getUserKey(req);
    const files = getUserSessionFiles(userKey);
    if (files.length === 0) return res.status(404).json({ error: 'No session found' });

    const latest = readJsonSafe(path.join(DIRS.sessions, files[0]));
    if (!latest) return res.status(500).json({ error: 'Invalid session file' });

    return res.json(latest);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read latest session' });
  }
});

/* ------------------------------ Auth logging ------------------------------ */

app.post('/log-auth', (req, res) => {
  try {
    const ip = getClientIP(req);
    const userKey = getUserKey(req);
    const iso = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${userKey}_${iso}.json`;
    const filePath = path.join(DIRS.auth, filename);

    const data = {
      type: 'auth',
      userKey,
      ip,
      timestamp: new Date().toISOString(),
      ...req.body,
    };

    writeJsonPretty(filePath, data);
    return res.status(200).json({ message: 'Auth info logged', filename });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to write auth log' });
  }
});

/* ------------------------------ Activity ------------------------------ */

app.post('/activity', (req, res) => {
  try {
    const ip = getClientIP(req);
    const userKey = getUserKey(req);
    const filePath = path.join(DIRS.activity, `${userKey}.ndjson`);

    const line = JSON.stringify({
      type: 'activity',
      userKey,
      ip,
      timestamp: new Date().toISOString(),
      ...req.body,
    }) + '\n';

    fs.appendFileSync(filePath, line, 'utf8');
    return res.status(200).json({ message: 'Activity logged' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to append activity' });
  }
});

/* ------------------------------ Page 2: Auto-Ranking ------------------------------ */

const ORDER_WEIGHTS = [3, 2, 1];

// normalize a numeric from input
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

function toConstraintEntry({ selectedParameter, selectedSign, value }) {
  const param = (selectedParameter || '').trim();
  const isNumeric = [
    'epochs','RAM','batch_size','pool_size','kernel_size','layers','nodes',
    'precision','f1_score','training_time','accuracy','recall','loss'
  ].includes(param);

  if (!isNumeric) return { key: param, constraint: (value ?? '').toString() };

  const v = num(value);
  if (v === null || isNaN(v)) return { key: param, constraint: null };

  switch (selectedSign) {
    case '=':  return { key: param, constraint: [v, v] };
    case '>':
    case '>=': return { key: param, constraint: [v, null] };
    case '<':
    case '<=': return { key: param, constraint: [null, v] };
    default:   return { key: param, constraint: null };
  }
}

/**
 * Spawn Python to produce BOTH CSV (timestamped) and JSON snapshot.
 */
function runRankingForUser(userKey) {
  return new Promise((resolve, reject) => {
    try {
      const constraintsJson = getLatestPage2JsonForUser(userKey);
      if (!constraintsJson) return reject(new Error('No constraints saved for this user'));

      if (!fs.existsSync(DIRS.dataArtifacts)) {
        fs.mkdirSync(DIRS.dataArtifacts, { recursive: true });
      }

      const datasetCsv = resolveDatasetPath();
      const probCsv = path.join(DIRS.dataArtifacts, 'graph_world.csv');
      const mainPy = path.join(__dirname, 'main.py');
      const pythonExe = resolvePythonExe();

      if (!datasetCsv) {
        const msg = 'Dataset not found. Set DATASET_PATH env var or place data.csv in a standard location.';
        writeStatus(userKey, { state: 'error', error: msg });
        return reject(new Error(msg));
      }

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputCsvTs = path.join(DIRS.page2, `${userKey}_ranked_list_${stamp}.csv`);
      const outputJsonLatest = path.join(DIRS.page2, `${userKey}_ranked_list.json`);
      const outputCsvLatest = path.join(DIRS.page2, `${userKey}_ranked_list.csv`); // best-effort copy

      writeStatus(userKey, {
        state: 'running',
        dataset: datasetCsv,
        main: mainPy,
        python: pythonExe,
        csv: path.basename(outputCsvTs),
      });

      const args = [
        mainPy,
        '--constraints-json', constraintsJson,
        '--dataset', datasetCsv,
        '--output', outputCsvTs,
        '--json-output', outputJsonLatest
      ];
      if (fs.existsSync(probCsv)) {
        args.push('--probability', probCsv);
      }

      const py = spawn(pythonExe, args, { cwd: __dirname });

      let stderr = '';
      py.stderr.on('data', (d) => (stderr += d.toString()));
      py.on('error', (e) => {
        writeStatus(userKey, { state: 'error', error: String(e) });
        reject(e);
      });

      py.on('close', (code) => {
        if (code !== 0) {
          writeStatus(userKey, { state: 'error', error: stderr || `python exited ${code}` });
          return reject(new Error(stderr || `python exited ${code}`));
        }

        try {
          // Python wrote the JSON snapshot already
          const data = readJsonSafe(outputJsonLatest) || { rows: [] };

          // best-effort copy the CSV to a stable name for downloads (ignore Windows lock)
          try {
            fs.copyFileSync(outputCsvTs, outputCsvLatest);
          } catch (e) {
            console.warn('[runRankingForUser] Could not update latest CSV:', String(e));
          }

          writeStatus(userKey, {
            state: 'done',
            rows: Array.isArray(data.rows) ? data.rows.length : 0,
            csv: path.basename(outputCsvTs),
          });

          resolve({ csvPath: outputCsvTs, jsonPath: outputJsonLatest, rows: data.rows || [] });
        } catch (e) {
          writeStatus(userKey, { state: 'error', error: String(e) });
          reject(e);
        }
      });
    } catch (err) {
      writeStatus(userKey, { state: 'error', error: String(err) });
      reject(err);
    }
  });
}

app.post('/page2/constraints', async (req, res) => {
  try {
    const { constraints = [] } = req.body || {};
    const ordered = constraints.filter((c) => c?.selectedParameter).slice(0, 3);

    const constraints_map = {};
    const reward_values = {}; // <-- numeric weights only

    ordered.forEach((row, idx) => {
      const { key, constraint } = toConstraintEntry(row);
      if (!key || constraint === null || constraint === undefined || constraint === '') return;
      constraints_map[key] = constraint;
      // IMPORTANT: store a single number (3/2/1), not a range
      reward_values[key] = ORDER_WEIGHTS[idx] ?? 1;
    });

    const userKey = getUserKey(req);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${userKey}_${ts}.json`;
    const filePath = path.join(DIRS.page2, filename);

    const payload = {
      type: 'page2_constraints',
      userKey,
      timestamp: new Date().toISOString(),
      raw: ordered,
      constraints_map,
      reward_values, // e.g., { accuracy: 3, precision: 2 }
    };

    writeJsonPretty(filePath, payload);

    runRankingForUser(userKey)
      .then(({ rows }) => console.log(`[page2/constraints] ranking complete for ${userKey}, rows=${rows.length}`))
      .catch((e) => console.error('[page2/constraints] ranking error', e));

    return res.status(200).json({ ok: true, saved: filename, message: 'Constraints saved. Ranking started.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save constraints / start ranking' });
  }
});

// Results endpoint: serve the latest JSON snapshot (already structured, safe for commas in fields)
app.get('/page2/results', (req, res) => {
  try {
    const userKey = getUserKey(req);
    const resultJson = path.join(DIRS.page2, `${userKey}_ranked_list.json`);
    if (!fs.existsSync(resultJson)) {
      const status = readStatus(userKey);
      if (status.state === 'running' || status.state === 'queued') {
        return res.status(202).json({ state: status.state });
      }
      return res.status(404).json({ error: 'No results yet', state: status.state || 'idle' });
    }
    const data = readJsonSafe(resultJson) || { rows: [] };
    return res.json({ ok: true, ...data });
  } catch {
    return res.status(500).json({ error: 'Failed to read results' });
  }
});

app.get('/page2/status', (req, res) => {
  try {
    const userKey = getUserKey(req);
    return res.json(readStatus(userKey));
  } catch {
    return res.json({ state: 'idle' });
  }
});

/* ------------------------------ Static logs for CSV/JSON ------------------------------ */
// Frontend can fetch artifacts from a stable, static URL: /logs/page2/<filename>
app.use('/logs', express.static(path.join(__dirname, 'logs')));

/* ------------------------------ Start server ------------------------------ */

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://194.249.2.210:${PORT}`);
});
