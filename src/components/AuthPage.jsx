import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AUTH_LOG } from "../config/endpoints";
import { getSessionId } from '../session';

const sessionId = getSessionId();

/** Reusable star rating */
const StarRating = ({ value, onChange, size = '1.1rem' }) => (
  <div style={{ display: 'inline-flex', gap: 6 }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <span
        key={n}
        onClick={() => onChange(n)}
        style={{
          cursor: 'pointer',
          fontSize: size,
          lineHeight: 1,
          color: n <= value ? '#CC3333' : '#CBD5E1', // filled vs muted
          userSelect: 'none',
        }}
        aria-label={`${n} star${n > 1 ? 's' : ''}`}
      >
        {n <= value ? '★' : '☆'}
      </span>
    ))}
  </div>
);

const card = {
  width: '100%',
  maxWidth: 980,
  background: '#F7FAFF',
  border: '1px solid #D0DAFF',
  borderRadius: 14,
  boxShadow: '0 6px 16px rgba(28,57,187,0.10)',
};

const sectionTitle = {
  fontSize: '1.1rem',
  fontWeight: 800,
  color: '#1C39BB',
  marginBottom: 8,
};

const label = {
  fontWeight: 700,
  marginBottom: 6,
  color: '#1C39BB',
};

const muted = { color: '#4C63C9' };

const AUTH_ENDPOINT = AUTH_LOG;

const AuthPage = () => {
  const navigate = useNavigate();

  // Questionnaire state
  const [clarity, setClarity] = useState(0); // 0–5
  const [experience, setExperience] = useState({
    metrics: 0,
    dataset: 0,
  });
  const [pipelineDesign, setPipelineDesign] = useState(''); // yes/no/planning

  const updateExperience = (key, val) =>
    setExperience((prev) => ({ ...prev, [key]: val }));

  /**
   * Fire-and-forget logger for auth-related events.
   * `kind` could be "auth_enter" or "auth_questionnaire".
   */
  const logAuthEvent = async (kind, extra = {}) => {
    try {
      await fetch(AUTH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
        body: JSON.stringify({  
          sessionId,
          type: 'auth_event',
          event: kind,
          t_client: new Date().toISOString(),
          version: 'auth-v3',
          ...extra,
        }),
      });
    } catch {
      // non-blocking; ignore errors
    }
  };

  // When user ENTERS AuthPage, record that immediately
  useEffect(() => {
    logAuthEvent('auth_enter');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = async () => {
    // Log the questionnaire answers explicitly
    await logAuthEvent('auth_questionnaire', {
      clarity,
      experience,
      pipelineDesign,
    });

    // Move user into Page 1 (manual selection task)
    navigate('/page1');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'white', color: '#1C39BB' }}>
      {/* Header / Instructions */}
      <header style={{ padding: '48px 20px 12px' }}>
        <div style={{ ...card, margin: '0 auto' }}>
          <div style={{ padding: '22px 24px' }}>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>
              Instructions
            </h1>
            <p style={{ marginTop: 10, ...muted, lineHeight: 1.6 }}>
              Imagine you are a <strong>computer vision researcher</strong> at
              the start of a facial video analysis project. You have access to a
              large database of published papers with different models,
              datasets, and metrics. Your goal is to choose a solid starting
              point that meets baseline performance.
              <br />
              <br />
              You can consider: loss, accuracy, recall, precision, f1_score.
              Your Supervisor requested a model that has at least{' '}
              <strong>80% accuracy</strong>, at least{' '}
              <strong>90% precision</strong> and your hardware is a{' '}
              <strong>GPU</strong> to give you more computational resource, you
              need to select a model that meets all the requirements with
              balanced metrics.
              <br />
              <strong>Accuracy</strong> is how often predictions are correct.
              <br /> <strong>Precision</strong> is how many of the predicted
              positives are actually correct.
              <br />
              <br />
              <strong>When you decide, click a row and then “Next”.</strong>
            </p>
          </div>
        </div>
      </header>

      {/* Main content: single card with questionnaire + Next button */}
      <main
        style={{
          padding: '20px',
          display: 'grid',
          gap: 20,
          justifyItems: 'center',
        }}
      >
        <section style={{ ...card }}>
          <div
            style={{
              padding: '22px 24px',
              display: 'grid',
              gap: 16,
            }}
          >
            <div style={sectionTitle}>Information</div>

            {/* Q1: clarity */}
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={label}>
                1. How clear were the instructions? (1: Not-clear to 5:
                Fully-clear)
              </div>
              <StarRating value={clarity} onChange={setClarity} />
            </div>

            {/* Q2: experience */}
            <div>
              <div style={label}>
                2. Rate your experience in the following areas (1: None to 5:
                Expert)
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(140px, 1fr))',
                  gap: 14,
                }}
              >
                <div>
                  <div style={{ marginBottom: 6 }}>Metrics</div>
                  <StarRating
                    value={experience.metrics}
                    onChange={(v) => updateExperience('metrics', v)}
                  />
                </div>
                <div>
                  <div style={{ marginBottom: 6 }}>Dataset Selection</div>
                  <StarRating
                    value={experience.dataset}
                    onChange={(v) => updateExperience('dataset', v)}
                  />
                </div>
              </div>
            </div>

            {/* Q3: pipeline design */}
            <div>
              <div style={label}>
                3. Have you designed your own research pipeline using multiple
                methods or metrics?
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <input
                    type="radio"
                    name="pipeline"
                    value="yes"
                    checked={pipelineDesign === 'yes'}
                    onChange={() => setPipelineDesign('yes')}
                  />
                  Yes
                </label>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <input
                    type="radio"
                    name="pipeline"
                    value="no"
                    checked={pipelineDesign === 'no'}
                    onChange={() => setPipelineDesign('no')}
                  />
                  No
                </label>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <input
                    type="radio"
                    name="pipeline"
                    value="planning"
                    checked={pipelineDesign === 'planning'}
                    onChange={() => setPipelineDesign('planning')}
                  />
                  Planning to
                </label>
              </div>
            </div>

            {/* Next button */}
            <div>
              <button
                onClick={handleContinue}
                style={{
                  background: '#1C39BB',
                  color: 'white',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 18px',
                  fontSize: 16,
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = '#CC3333')
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = '#1C39BB')
                }
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AuthPage;
