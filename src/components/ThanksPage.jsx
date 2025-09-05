import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/** Lightweight star component */
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

const box = {
  maxWidth: '900px',
  margin: '2rem auto',
  backgroundColor: '#F0F4FF',
  border: '2px solid #1C39BB',
  borderRadius: '12px',
  boxShadow: '0 6px 12px rgba(0,0,0,0.15)',
  padding: '1.5rem',
  color: '#1C39BB',
};

const labelStyle = { fontWeight: 700, marginBottom: '0.25rem' };
const textareaStyle = {
  width: '100%',
  border: '1px solid #1C39BB',
  borderRadius: '8px',
  padding: '10px',
  resize: 'vertical',
  color: '#1C39BB',
  backgroundColor: 'white',
};

const radioWrap = { display: 'flex', gap: '1.5rem', marginTop: '0.25rem' };

const buttonStyle = (enabled) => ({
  padding: '10px 20px',
  borderRadius: '8px',
  fontSize: '16px',
  cursor: enabled ? 'pointer' : 'not-allowed',
  color: 'white',
  backgroundColor: enabled ? '#1C39BB' : '#94A3B8',
  border: 'none',
});

const ThanksPage = () => {
  const navigate = useNavigate();

  const [difficulty, setDifficulty] = useState(0);
  const [satisfaction, setSatisfaction] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [hasSortReason, setHasSortReason] = useState(null); // true | false | null
  const [sortReasonText, setSortReasonText] = useState('');

  // we’ll display the sort order as [a, b, c]
  const [sortColumns, setSortColumns] = useState(['-', '-', '-']);

  // fetch the latest sort columns (array) from backend
  useEffect(() => {
    fetch('http://194.249.2.210:3001/latest-log')
      .then((res) => res.json())
      .then((arr) => {
        // Ensure we always have exactly 3 display slots
        const safe = Array.isArray(arr) ? arr.slice(0, 3) : [];
        const padded = [safe[0] || '-', safe[1] || '-', safe[2] || '-'];
        setSortColumns(padded);
      })
      .catch(() => {
        setSortColumns(['-', '-', '-']);
      });
  }, []);

  const isFormValid = () => {
    if (difficulty === 0 || satisfaction === 0) return false;
    if (hasSortReason === null) return false;
    if (feedback.trim() === '') return false;
    if (hasSortReason && sortReasonText.trim() === '') return false;
    return true;
  };

  const handleSubmit = async () => {
    const payload = {
      difficulty,
      satisfaction,
      feedback,
      sortColumns: sortColumns.map((s) => (s ?? '-')),
      sortReasonGiven: hasSortReason,
      sortReasonText: hasSortReason ? sortReasonText : '',
    };

    try {
      await fetch('http://194.249.2.210:3001/log-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      navigate('/final');
    } catch {
      alert('Failed to submit feedback.');
    }
  };

  return (
    <div style={{ padding: '24px', color: '#1C39BB' }}>
      <div style={box}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem', textAlign: 'center' }}>
          Thank you for your submission!
        </h1>

        {/* Q1: Difficulty */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={labelStyle}>1. Please rate the difficulty of finding the optimal model:</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StarRating value={difficulty} onChange={setDifficulty} />
            <span style={{ fontSize: '0.85rem' }}>(1 = Very Easy, 5 = Very Difficult)</span>
          </div>
        </div>

        {/* Q2: System satisfaction */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={labelStyle}>2. How satisfied are you with the system?</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StarRating value={satisfaction} onChange={setSatisfaction} />
            <span style={{ fontSize: '0.85rem' }}>(1 = Very Dissatisfied, 5 = Very Satisfied)</span>
          </div>
        </div>

        {/* Q3: Reason for selection order */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={labelStyle}>
            3. Is there any reason for your selection order [{sortColumns[0]}, {sortColumns[1]}, {sortColumns[2]}]?
          </div>
          <div style={radioWrap}>
            <label>
              <input
                type="radio"
                name="sort-reason"
                checked={hasSortReason === true}
                onChange={() => setHasSortReason(true)}
              />{' '}
              Yes
            </label>
            <label>
              <input
                type="radio"
                name="sort-reason"
                checked={hasSortReason === false}
                onChange={() => setHasSortReason(false)}
              />{' '}
              No
            </label>
          </div>
        </div>

        {/* Q4: Why (if Yes) */}
        {hasSortReason && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={labelStyle}>4. Why did you choose this column order?</div>
            <textarea
              value={sortReasonText}
              onChange={(e) => setSortReasonText(e.target.value)}
              rows={3}
              placeholder="Explain your reasoning..."
              style={textareaStyle}
            />
          </div>
        )}

        {/* Q5: Satisfaction with the chosen model (free text) */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={labelStyle}>
            5. How satisfied are you with the model you selected? (Please explain)
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            placeholder="Write your explanation..."
            style={textareaStyle}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid()}
            style={buttonStyle(isFormValid())}
            onMouseOver={(e) => {
              if (isFormValid()) e.currentTarget.style.backgroundColor = '#CC3333';
            }}
            onMouseOut={(e) => {
              if (isFormValid()) e.currentTarget.style.backgroundColor = '#1C39BB';
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThanksPage;
