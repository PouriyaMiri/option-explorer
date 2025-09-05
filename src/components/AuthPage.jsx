import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
const inputBase = {
  border: '1px solid #1C39BB',
  background: 'white',
  color: '#1C39BB',
  borderRadius: 10,
  padding: '10px 12px',
  outline: 'none',
};

const AuthPage = () => {
  const navigate = useNavigate();

  // Password (for routing)
  const [password, setPassword] = useState('');

  // Questionnaire state
  const [gender, setGender] = useState(''); // Male/Female
  const [age, setAge] = useState(''); // number
  const [clarity, setClarity] = useState(0); // 0–5

  const [experience, setExperience] = useState({
    metrics: 0,
    dataset: 0,
    models: 0,
  });

  const [pipelineDesign, setPipelineDesign] = useState(''); // yes/no/planning

  const updateExperience = (key, val) =>
    setExperience((prev) => ({ ...prev, [key]: val }));

  const postAuth = async () => {
    try {
      await fetch('http://194.249.2.210:3001/log-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gender,
          age: age === '' ? null : Number(age),
          clarity,
          experience,
          pipelineDesign,
          version: 'auth-v2',
        }),
      });
    } catch {
      // non-blocking
    }
  };

  const handleContinue = async () => {
    // send the questionnaire
    await postAuth();

    // route by password
    if (password === 'lj25') navigate('/page1');
    else if (password === 'fri25') navigate('/page2');
    else alert('Wrong password');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'white', color: '#1C39BB' }}>
      {/* Header / Instructions */}
      <header style={{ padding: '48px 20px 12px' }}>
        <div style={{ ...card, margin: '0 auto' }}>
          <div style={{ padding: '22px 24px' }}>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>Instructions</h1>
            <p style={{ marginTop: 10, ...muted, lineHeight: 1.6 }}>
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
        </div>
      </header>

      {/* Main content: two cards */}
      <main style={{ padding: '20px', display: 'grid', gap: 20, justifyItems: 'center' }}>
        {/* Card 1: Questionnaire */}
        <section style={{ ...card }}>
          <div style={{ padding: '22px 24px', display: 'grid', gap: 16 }}>
            <div style={sectionTitle}>Your Information </div>

            {/* Row: gender */}
            <div>
              <div style={label}>1. What is your gender?</div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="radio"
                    name="gender"
                    value="Male"
                    checked={gender === 'Male'}
                    onChange={() => setGender('Male')}
                  />
                  Male
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="radio"
                    name="gender"
                    value="Female"
                    checked={gender === 'Female'}
                    onChange={() => setGender('Female')}
                  />
                  Female
                </label>
              </div>
            </div>

            {/* Row: age + clarity side by side on wide screens */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 16,
              }}
            >
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={label}>2. What is your age?</div>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 29"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  style={{ ...inputBase, maxWidth: 240 }}
                />
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                <div style={label}>3. How clear were the instructions? (1: Not-clear to 5: Fully-clear)</div>
                <StarRating value={clarity} onChange={setClarity} />
              </div>
            </div>

            {/* Experience block */}
            <div>
              <div style={label}>4. Rate your experience in the following areas (1: None to 5: Expert)</div> 
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

            {/* Pipeline design */}
            <div>
              <div style={label}>
                5. Have you designed your own research pipeline using multiple methods or metrics?
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="radio"
                    name="pipeline"
                    value="yes"
                    checked={pipelineDesign === 'yes'}
                    onChange={() => setPipelineDesign('yes')}
                  />
                  Yes
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="radio"
                    name="pipeline"
                    value="no"
                    checked={pipelineDesign === 'no'}
                    onChange={() => setPipelineDesign('no')}
                  />
                  No
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
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
          </div>
        </section>

        {/* Card 2: Password & continue */}
        <section style={{ ...card }}>
          <div
            style={{
              padding: '22px 24px',
              display: 'grid',
              gap: 14,
              alignItems: 'end',
            }}
          >
            <div style={sectionTitle}>Access</div>

            <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
              <label style={label}>Password</label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputBase}
              />
              <div style={{ fontSize: 12, color: '#6C7ADD' }}>
                Use your study code to access the task.
              </div>
            </div>

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
                onMouseOver={(e) => (e.currentTarget.style.background = '#CC3333')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#1C39BB')}
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
