
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { spawn } = require('child_process');
const csv = require('csv-parser'); 

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

let cachedMetadata = null;

function inferMetadataFromCsv(csvPath) {
  console.log('[inferMetadataFromCsv] Starting for', csvPath);	
  return new Promise((resolve, reject) => {
    const columns = {};
    let rowCount = 0;

    fs.createReadStream(csvPath)
      .on('error', (err) => {
	      console.error('[inferMetadataFromCsv] ReadStream error:', err);
	      reject(err); })
      .pipe(csv())
      .on('data', (row) => {
        rowCount += 1;
        Object.entries(row).forEach(([rawKey, rawValue]) => {
          const key = rawKey.trim();
          const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;

          if (!columns[key]) {
            columns[key] = {
              type: null,          // 'numeric' | 'categorical'
              min: Infinity,
              max: -Infinity,
              values: new Set(),
            };
          }
          const col = columns[key];

          const num = Number(value.replace(',', '.'));
          const isNumeric =
            !Number.isNaN(num) &&
            value !== '' &&
            value !== null &&
            value !== undefined;

          if (isNumeric) {
            if (!col.type) col.type = 'numeric';
            if (num < col.min) col.min = num;
            if (num > col.max) col.max = num;
          } else {
            if (!col.type) col.type = 'categorical';
            col.values.add(value);
          }
        });
      })
      .on('end', () => {
	console.log('[inferMetadataFromCsv] Completed. rowCount =', rowCount);
        const metadata = {};
        Object.entries(columns).forEach(([key, col]) => {
          if (col.type === 'numeric') {
            metadata[key] = {
              type: 'numeric',
              min: col.min === Infinity ? null : col.min,
              max: col.max === -Infinity ? null : col.max,
              signs: ['>=', '<=', '=', '>', '<'],
            };
          } else {
            metadata[key] = {
              type: 'categorical',
              values: Array.from(col.values).sort(),
              signs: ['='],
            };
          }
        });
        resolve({ rowCount, metadata });
      })
      .on('error', (err) => {
		console.error('[inferMetadataFromCsv] csv() error:', err);
	      reject(err);});
  });
}

// GET /page2/metadata
app.get('/page2/metadata', async (req, res) => {
  try {
    if (cachedMetadata) {
      console.log('[GET /page2/metadata] Returning cached metadata');
      return res.json(cachedMetadata);
    }
    const datasetCsv = resolveDatasetPath();
    console.log('[GET /page2/metadata] datasetCsv =', datasetCsv);
    if (!datasetCsv) {
      return res.status(500).json({ error: 'Dataset not found' });
    }
    const { metadata, rowCount } = await inferMetadataFromCsv(datasetCsv);
    console.log('[GET /page2/metadata] rowCount =', rowCount);
    cachedMetadata = { rowCount, metadata };
    res.json(cachedMetadata);
  } catch (e) {
    console.error('[GET /page2/metadata] error:', e);
    res.status(500).json({ error: 'Failed to compute metadata' });
  }
});

function parseCsvToRows(csvPath) {
  return new Promise((resolve, reject) => {
    const rows = [];

    fs.createReadStream(csvPath)
      .on('error', (err) => {
        console.error('[parseCsvToRows] ReadStream error:', err);
        reject(err);
      })
      .pipe(csv())
      .on('data', (row) => {
        // row is already an object: { header1: value1, header2: value2, ... }
        // values with commas (like "[16, 16, 16, 16]") stay intact.
        rows.push(row);
      })
      .on('end', () => {
        resolve(rows);
      })
      .on('error', (err) => {
        console.error('[parseCsvToRows] csv() error:', err);
        reject(err);
      });
  });
}



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



// REPLACE getUserKey with:
const getUserKey = (req) => {
  const sid =
    req.headers['x-session-id'] ||
    req.body?.sessionId ||
    req.query?.sessionId ||
    'anonymous';

  return String(sid).replace(/[^a-zA-Z0-9_-]/g, '_');
};


const readJsonSafe = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
};

const writeJsonPretty = (filePath, data) => {
  try{
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  }catch{

    return false;
  }
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

  const { execSync } = require('child_process');

  try {
    execSync('python3 --version', { stdio: 'ignore' });
    console.log('[resolvePythonExe] Using python3');
    return 'python3';
  } catch {}

  try {
    execSync('python --version', { stdio: 'ignore' });
    console.log('[resolvePythonExe] Using python');
    return 'python';
  } catch {}

  console.error('[resolvePythonExe] No Python interpreter found.');
  throw new Error('No Python interpreter found. Install python3 or specify PATH.');

}

function resolveDatasetPath() {
  if (process.env.DATASET_PATH && fs.existsSync(process.env.DATASET_PATH)) {
	  console.log('[resolveDatasetPath] Using DATASET_PATH =', process.env.DATASET_PATH);
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
    if (fs.existsSync(p)) {
	console.log('[resolveDatasetPath] Found dataset at', p);
	return p;
	} else {console.log('[resolveDatasetPath] Not found:', p); }
  }
  console.warn('[resolveDatasetPath] No dataset found in any candidate path.');
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
    
    const userKey = getUserKey(req);
    const index = getNextSessionIndex(userKey);
    const filename = `${userKey}_${index}.json`;
    const filePath = path.join(DIRS.sessions, filename);

    const payload = {
      type: 'selection',
      userKey,
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
    const userKey = getUserKey(req);
    const iso = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${userKey}_${iso}.json`;
    const filePath = path.join(DIRS.auth, filename);

    const data = {
      type: 'auth',
      userKey,
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
    const userKey = getUserKey(req);
    const filePath = path.join(DIRS.activity, `${userKey}.ndjson`);

    const line = JSON.stringify({
      type: 'activity',
      userKey,
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

const ORDER_WEIGHTS = [5, 4, 3, 2, 1];

// normalize a numeric from input
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

function toConstraintEntry({ selectedParameter, selectedSign, value }) {
  const param = (selectedParameter || '').trim();

  const isNumeric = [
    'epochs', 'RAM', 'batch_size', 'pool_size', 'kernel_size', 'layers', 'nodes',
    'precision', 'f1_score', 'training_time', 'accuracy', 'recall', 'loss',
  ].includes(param);

  // non-numeric: treat as string equality
  if (!isNumeric) {
    return { key: param, constraint: (value ?? '').toString() };
  }

  const v = num(value);
  if (v === null || Number.isNaN(v)) {
    return { key: param, constraint: null };
  }

  switch (selectedSign) {
    case '=':
      return { key: param, constraint: [v, v] };
    case '>':
    case '>=':
      return { key: param, constraint: [v, null] };
    case '<':
    case '<=':
      return { key: param, constraint: [null, v] };
    default:
      return { key: param, constraint: null };
  }
}

/**
 * Spawn Python to produce BOTH CSV (timestamped) and JSON snapshot.
 */
/**
 * Spawn Python to produce the ranked CSV.
 * We no longer rely on JSON results.
 */
function runRankingForUser(userKey) {
  return new Promise((resolve, reject) => {
    try {
      const constraintsJson = getLatestPage2JsonForUser(userKey);
       console.log('[runRankingForUser] userKey =', userKey, 'constraintsJson =', constraintsJson);
	if (!constraintsJson) {
        return reject(new Error('No constraints saved for this user'));
      }

      if (!fs.existsSync(DIRS.dataArtifacts)) {
        fs.mkdirSync(DIRS.dataArtifacts, { recursive: true });
      }

      const datasetCsv = resolveDatasetPath();
      const probCsv = path.join(DIRS.dataArtifacts, 'graph_world.csv');
      const mainPy = path.join(__dirname, 'main.py');
      const pythonExe = resolvePythonExe();

      console.log('[runRankingForUser] datasetCsv =', datasetCsv);
      console.log('[runRankingForUser] mainPy =', mainPy, 'pythonExe =', pythonExe);
      console.log('[runRankingForUser] probCsv exists =', fs.existsSync(probCsv));

      if (!datasetCsv) {
        const msg =
          'Dataset not found. Set DATASET_PATH env var or place data.csv in a standard location.';
        writeStatus(userKey, { state: 'error', error: msg });
        return reject(new Error(msg));
      }

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');

      // 🔹 THIS is the variable that was "not defined" before
      const outputCsvTs = path.join(DIRS.page2, `${userKey}_ranked_list_${stamp}.csv`);
      const outputCsvLatest = path.join(DIRS.page2, `${userKey}_ranked_list.csv`);

      console.log('[runRankingForUser] outputCsvTs =', outputCsvTs);

      writeStatus(userKey, {
        state: 'running',
        dataset: datasetCsv,
        main: mainPy,
        python: pythonExe,
        csv: outputCsvTs,
      });

      // We still pass --json-output because main.py requires it as an argument,
      // but we won't use the JSON file anymore.
      const dummyJson = path.join(DIRS.page2, `${userKey}_ranked_list_unused.json`);

      const args = [
        mainPy,
        '--constraints-json',
        constraintsJson,
        '--dataset',
        datasetCsv,
        '--output',
        outputCsvTs,
        '--json-output',
        dummyJson,
      ];
      if (fs.existsSync(probCsv)) {
        args.push('--probability', probCsv);
      }

      console.log('[runRankingForUser] Spawning python with args:', [pythonExe, ...args]);	    
      const py = spawn(pythonExe, args, { cwd: __dirname });
      

      let stderr = '';
      py.stderr.on('data', (d) => (stderr += d.toString()));
      py.on('error', (e) => {
	console.error('[runRankingForUser] spawn error:', e);
        writeStatus(userKey, { state: 'error', error: String(e) });
        reject(e);
      });

      py.on('close', (code) => {
	console.log('[runRankingForUser] python exited with code', code);
        if (code !== 0) {
          writeStatus(userKey, { state: 'error', error: stderr || `python exited ${code}` });
          return reject(new Error(stderr || `python exited ${code}`));
        }

        try {
          // Copy timestamped CSV → stable "latest" CSV
          try {
            fs.copyFileSync(outputCsvTs, outputCsvLatest);
            console.log('[runRankingForUser] Copied CSV to', outputCsvLatest);
          } catch (e) {
            console.warn('[runRankingForUser] Could not update latest CSV:', String(e));
          }

          // Count rows in CSV (ignoring header)
          const csvText = fs.readFileSync(outputCsvTs, 'utf8').trim();
          const csvLines = csvText ? csvText.split(/\r?\n/) : [];
          const rowCount = Math.max(0, csvLines.length - 1);

          console.log('[runRankingForUser] rowCount =', rowCount);

          writeStatus(userKey, {
            state: 'done',
            rows: rowCount,
            csv: path.basename(outputCsvTs),
          });

          resolve({
            csvPath: outputCsvTs,
            rows: rowCount,
          });
        } catch (e) {
          console.error('[runRankingForUser] post-processing error:', e);
          writeStatus(userKey, { state: 'error', error: String(e) });
          reject(e);
        }
      });
    } catch (e) {
      console.error('[runRankingForUser] outer error:', e);
      writeStatus(userKey, { state: 'error', error: String(e) });
      reject(e);
    }
  });
}


/**
 * Shared handler for Page 2 constraints.
 * Frontend should POST: { constraints: [{ selectedParameter, selectedSign, value }, ...] }
 */
async function handlePage2Constraints(req, res) {
  try {
    const { constraints = [] } = req.body || {};
    const filtered = constraints.filter((c) => c && c.selectedParameter);

    const constraints_map = {};
    const reward_values = {};

    filtered.forEach((row, idx) => {
      const { key, constraint } = toConstraintEntry(row);
      if (!key || constraint === null || constraint === undefined || constraint === '') return;

      constraints_map[key] = constraint;

      const weightIndex = Math.min(idx, ORDER_WEIGHTS.length - 1);
      reward_values[key] = ORDER_WEIGHTS[weightIndex];
    });

    const userKey = getUserKey(req);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${userKey}_${ts}.json`;
    const filePath = path.join(DIRS.page2, filename);

    const payload = {
      type: 'page2_constraints',
      userKey,
      timestamp: new Date().toISOString(),
      raw: filtered,
      constraints_map,
      reward_values,
    };

    writeJsonPretty(filePath, payload);

    runRankingForUser(userKey)
      .then(({ rows }) => console.log(`[page2] ranking complete for ${userKey}, rows=${rows}`))
      .catch((e) => console.error('[page2] ranking error', e));

    return res
      .status(200)
      .json({ ok: true, saved: filename, message: 'Constraints saved. Ranking started.' });
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'Failed to save constraints / start ranking' });
  }
}

// Mount the same handler on both routes (no app._router magic)
app.post('/page2', handlePage2Constraints);
app.post('/page2/constraints', handlePage2Constraints);

// Results endpoint: serve latest CSV snapshot
// Results endpoint: serve rows parsed from the latest CSV (no JSON file)

app.get('/page2/results', async (req, res) => {
  try {
    const userKey = getUserKey(req);
    const status = readStatus(userKey);
    console.log('[GET /page2/results] userKey =', userKey, 'status =', status);

    if (!status || (!status.csv && status.state !== 'done')) {
      if (status && (status.state === 'running' || status.state === 'queued')) {
        return res.status(202).json({ state: status.state });
      }
      return res
        .status(404)
        .json({ error: 'No results yet', state: status ? status.state : 'idle' });
    }

    if (status.state === 'running' || status.state === 'queued') {
      return res.status(202).json({ state: status.state });
    }

    const csvFileName = status.csv;
    if (!csvFileName) {
      return res.status(404).json({ error: 'No CSV found', state: status.state });
    }

    const csvPath = path.join(DIRS.page2, csvFileName);
    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ error: 'CSV file missing', state: status.state });
    }

    // NEW: use robust CSV parsing
    const rows = await parseCsvToRows(csvPath);

    return res.json({
      ok: true,
      state: status.state,
      csv: csvFileName,
      rows,
    });
  } catch (e) {
    console.error('[GET /page2/results] Error:', e);
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

// Serve the base dataset CSV for Page 1
app.get('/page1/data', (req, res) => {
  try {
    const datasetCsv = resolveDatasetPath();
    if (!datasetCsv || !fs.existsSync(datasetCsv)) {
      console.error('[GET /page1/data] Dataset CSV not found');
      return res.status(404).send('Dataset CSV not found');
    }

    res.setHeader('Content-Type', 'text/csv');
    fs.createReadStream(datasetCsv).pipe(res);
  } catch (err) {
    console.error('[GET /page1/data] Error:', err);
    res.status(500).send('Failed to read dataset');
  }
});


/* ------------------------------ Static logs for CSV/JSON ------------------------------ */
// Frontend can fetch artifacts from a stable, static URL: /logs/page2/<filename>
app.use('/logs', express.static(path.join(__dirname, 'logs')));

/* ------------------------------ Start server ------------------------------ */

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});




