import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LATEST_LOG,LOG_FEEDBACK } from "../config/endpoints";
import { getSessionId } from '../session';
const sessionId = getSessionId();
const StarRating = ({ value, onChange, label }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexWrap: 'wrap',
    }}
  >
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
            color: star <= value ? '#CC3333' : '#CBD5E1',
            userSelect: 'none',
          }}
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
  padding: '0.5rem 0.75rem',
  minHeight: '80px',
  resize: 'vertical',
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  color: '#0f172a',
};

const radioWrap = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1rem',
  marginTop: '0.25rem',
};

const buttonBase = {
  borderRadius: '8px',
  padding: '0.6rem 1.4rem',
  border: 'none',
  fontSize: '1rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color 0.2s ease, transform 0.1s ease',
};

const ThanksPage = () => {
  const navigate = useNavigate();

  // Q1/Q2 ratings
  const [difficulty, setDifficulty] = useState(0);
  const [satisfaction, setSatisfaction] = useState(0);

  // Q3/Q4 – reason for sort order
  const [hasSortReason, setHasSortReason] = useState(null); // true | false | null
  const [sortReasonText, setSortReasonText] = useState('');

  // We display sort order as [a, b, c]
  const [sortColumns, setSortColumns] = useState(['-', '-', '-']);

  // Open feedback text
  const [feedback, setFeedback] = useState('');

  const [saving, setSaving] = useState(false);

  // Fetch latest sort columns (used on Page 1) from backend
  useEffect(() => {
    fetch(LATEST_LOG, { headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId } })
      .then((res) => res.json())
      .then((arr) => {
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
    if (!isFormValid()) return;
    setSaving(true);

    const payload = {
      page: 'thanks_page1',
      difficulty,
      satisfaction,
      feedback,
      sortColumns: sortColumns.map((s) => s ?? '-'),
      sortReasonGiven: hasSortReason,
      sortReasonText: hasSortReason ? sortReasonText : '',
    };

    try {
      // This updates the same session file created by /log (Page 1)
      await fetch(LOG_FEEDBACK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
        body: JSON.stringify({ sessionId, ...payload }),
      });

      // After this questionnaire, send user to Page 2 (constraint-based system)
      navigate('/page2');
    } catch {
      alert('Failed to submit feedback.');
    } finally {
      setSaving(false);
    }
  };

  const nextEnabled = isFormValid() && !saving;

  return (
    <div style={{ padding: '24px', color: '#1C39BB' }}>
      <div style={box}>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            marginBottom: '1rem',
            textAlign: 'center',
          }}
        >
          Thank you for your selection!
        </h1>

        <p
          style={{
            fontSize: '0.95rem',
            marginBottom: '1.5rem',
            lineHeight: 1.6,
          }}
        >
          You manually selected a model on the previous page. Before moving to
          the next part of the study (using our system), please answer the
          following questions about your experience.
        </p>

        {/* Q1: Difficulty */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={labelStyle}>
            1. Please rate the difficulty of finding the optimal model:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StarRating value={difficulty} onChange={setDifficulty} />
            <span style={{ fontSize: '0.85rem' }}>
              (1 = Very easy, 5 = Very difficult)
            </span>
          </div>
        </div>

        {/* Q2: Satisfaction */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={labelStyle}>
            2. How satisfied are you with the model you selected?
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StarRating value={satisfaction} onChange={setSatisfaction} />
            <span style={{ fontSize: '0.85rem' }}>
              (1 = Not satisfied, 5 = Very satisfied)
            </span>
          </div>
        </div>

        {/* Q3: Sort order reason */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={labelStyle}>
            3. Is there any reason for your selection order [
            {sortColumns[0]}, {sortColumns[1]}, {sortColumns[2]}]?
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
            <div style={labelStyle}>
              4. Why did you choose this column order?
            </div>
            <textarea
              style={textareaStyle}
              value={sortReasonText}
              onChange={(e) => setSortReasonText(e.target.value)}
              placeholder="Please explain the reasoning behind your chosen sort order..."
            />
          </div>
        )}

        {/* Q5: Open feedback */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={labelStyle}>
            5. Add any comments about this first selection task - N/A if you don't have
            any:
          </div>
          <textarea
            style={textareaStyle}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Your feedback..."
          />
        </div>

        {/* Next button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            disabled={!nextEnabled}
            onClick={handleSubmit}
            style={{
              ...buttonBase,
              backgroundColor: nextEnabled ? '#1C39BB' : '#94A3B8',
              color: 'white',
              cursor: nextEnabled ? 'pointer' : 'not-allowed',
            }}
            onMouseOver={(e) => {
              if (nextEnabled) e.currentTarget.style.backgroundColor = '#CC3333';
            }}
            onMouseOut={(e) => {
              if (nextEnabled) e.currentTarget.style.backgroundColor = '#1C39BB';
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
