import React, { useEffect, useMemo, useState } from "react";
import { LOG_FEEDBACK, } from "../config/endpoints";
import { getSessionId } from '../session';
const sessionId = getSessionId();
const LOG_FEEDBACK_ENDPOINT = LOG_FEEDBACK;

/** Small star rating control 1–5 */
const StarRating = ({ value, onChange }) => (
  <div style={{ display: "inline-flex", gap: 6 }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <span
        key={n}
        onClick={() => onChange(n)}
        style={{
          cursor: "pointer",
          fontSize: "1.2rem",
          lineHeight: 1,
          color: n <= value ? "#CC3333" : "#CBD5E1",
          userSelect: "none",
        }}
      >
        {n <= value ? "★" : "☆"}
      </span>
    ))}
  </div>
);

const cardStyle = {
  maxWidth: "1060px",
  margin: "24px auto",
  backgroundColor: "#F7FAFF",
  borderRadius: "14px",
  border: "1px solid #CBD5E1",
  boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
  padding: "20px 22px",
  color: "#1C39BB",
};

/**
 * Final comparison page ("Thank2"):
 * - Shows 3 models side by side:
 *   1) Manual choice (Page 1)
 *   2) Choice from Results page
 *   3) Top-ranked option from Results
 * - Records final judgements + comments
 * - Sends everything to /log-feedback, then shows a thank-you state.
 */
const Thank2Page = () => {
  const [manualModel, setManualModel] = useState(null);
  const [resultsSelectedModel, setResultsSelectedModel] = useState(null);
  const [resultsTopModel, setResultsTopModel] = useState(null);

  // questions
	//
	//
	//
  const [configSatisfaction, setConfigSatisfaction] = useState(0);
  const [configDifficulty, setConfigDifficulty] = useState(0);
  const [consistency, setConsistency] = useState(0); // 1–5
  const [preference, setPreference] = useState(""); // "manual" | "results" | "top"
  const [confidence, setConfidence] = useState(0); // 1–5
  const [comments, setComments] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // pull models from localStorage on mount
  useEffect(() => {
    const safeParse = (key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch {
        return null;
      }
    };

    setManualModel(safeParse("manual_selected_model"));
    setResultsSelectedModel(safeParse("results_selected_model"));
    setResultsTopModel(safeParse("results_top_model"));
  }, []);

  // Build union of all keys to show in table
  const tableKeys = useMemo(() => {
    const keys = new Set();
    const addKeys = (obj) => {
      if (!obj || typeof obj !== "object") return;
      Object.keys(obj).forEach((k) => keys.add(k));
    };
    addKeys(manualModel);
    addKeys(resultsSelectedModel);
    addKeys(resultsTopModel);

    // put some likely interesting fields first
    const important = [
      "model",
      "algorithm",
      "dataset",
      "domain",
      "field",
      "intent",
      "processing_unit",
      "RAM",
      "accuracy",
      "precision",
      "recall",
      "f1_score",
      "loss",
      "training_time",
    ];

    const ordered = [];
    important.forEach((k) => {
      if (keys.has(k)) {
        ordered.push(k);
        keys.delete(k);
      }
    });

    // remaining keys in alphabetical order
    return [...ordered, ...Array.from(keys).sort()];
  }, [manualModel, resultsSelectedModel, resultsTopModel]);

  const getCell = (obj, key) => {
    if (!obj) return "";
    const v = obj[key];
    if (v == null) return "";
    if (typeof v === "number") return v;
    if (typeof v === "string") return v;
    return String(v);
  };

  const isReadyToSubmit = () =>
    !!manualModel &&
    !!resultsSelectedModel &&
    !!resultsTopModel &&
    consistency > 0 &&
    configSatisfaction > 0 &&
    configDifficulty > 0 &&
    confidence > 0 &&
    preference !== "" &&
    !submitting;

  const handleSubmit = async () => {
    if (!isReadyToSubmit()) return;
    setSubmitting(true);
    setError("");

    const payload = {
      page: "thank2_final_comparison",
      configSatisfaction, // satisfaction with configuration selection
      configDifficulty, // difficulty of configuration selection
      consistency, // perceived consistency between three choices
      confidence, // confidence in final preference
      preference, // which model they ultimately prefer
      comments,
      manualModel,
      resultsSelectedModel,
      resultsTopModel,
    };

    try {
      await fetch(LOG_FEEDBACK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" , 'x-session-id': sessionId },
        body: JSON.stringify({ sessionId, ...payload }),
      });

      // optional: clean up client-side state
      // (keep it if you want to inspect localStorage later)
      // localStorage.removeItem("manual_selected_model");
      // localStorage.removeItem("results_selected_model");
      // localStorage.removeItem("results_top_model");

      setDone(true);
    } catch (err) {
      setError("Failed to submit final feedback. Please inform the experimenter.");
    } finally {
      setSubmitting(false);
    }
  };

  const missingAnyModel = !manualModel || !resultsSelectedModel || !resultsTopModel;

  if (done) {
    return (
      <div style={{ padding: "24px" }}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.75rem" }}>
            Thank you!
          </h1>
          <p style={{ fontSize: "0.95rem", lineHeight: 1.6 }}>
            Your responses and model comparisons have been recorded. This concludes the study.
            You may now close this window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", color: "#1C39BB" }}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.75rem" }}>
          Final Comparison
        </h1>
        <p style={{ fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "1rem" }}>
          Below you see the model you selected manually, the model you selected from
          the system&apos;s ranked list, and the top-ranked option from that list. Please review
          them side by side and answer the questions at the bottom.
        </p>

        {missingAnyModel && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.65rem 0.85rem",
              borderRadius: "8px",
              backgroundColor: "#FEF2F2",
              color: "#B91C1C",
              fontSize: "0.9rem",
            }}
          >
            Some comparison data is missing. Please inform the experimenter. You can still provide
            comments below.
          </div>
        )}

        {/* Comparison table */}
        {!missingAnyModel && (
          <div
            style={{
              marginTop: "0.5rem",
              borderRadius: "10px",
              border: "1px solid #CBD5E1",
              overflow: "hidden",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                backgroundColor: "white",
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "#E5EDFF",
                    textAlign: "left",
                    fontSize: "0.9rem",
                  }}
                >
                  <th
                    style={{
                      padding: "8px 10px",
                      borderBottom: "1px solid #CBD5E1",
                      width: "18%",
                    }}
                  >
                    Attribute
                  </th>
                  <th
                    style={{
                      padding: "8px 10px",
                      borderBottom: "1px solid #CBD5E1",
                    }}
                  >
                    Manually selection
                  </th>
                  <th
                    style={{
                      padding: "8px 10px",
                      borderBottom: "1px solid #CBD5E1",
                    }}
                  >
                    Results selection
                  </th>
                  <th
                    style={{
                      padding: "8px 10px",
                      borderBottom: "1px solid #CBD5E1",
                    }}
                  >
                    Top-ranked option
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableKeys.map((key) => (
                  <tr key={key} style={{ borderBottom: "1px solid #E5E7EB" }}>
                    <td
                      style={{
                        padding: "6px 10px",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                      }}
                    >
                      {key}
                    </td>
                    <td style={{ padding: "6px 10px", fontSize: "0.9rem" }}>
                      {getCell(manualModel, key)}
                    </td>
                    <td style={{ padding: "6px 10px", fontSize: "0.9rem" }}>
                      {getCell(resultsSelectedModel, key)}
                    </td>
                    <td style={{ padding: "6px 10px", fontSize: "0.9rem" }}>
                      {getCell(resultsTopModel, key)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Questions */}
        <div style={{ marginTop: "1.5rem", display: "grid", gap: "0.9rem" }}>
        

          {/* Q1: satisfaction with configuration selection */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
              1. How satisfied are you with the configuration selection you made in this stage by defining the constraint(s)?
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StarRating value={configSatisfaction} onChange={setConfigSatisfaction} />
              <span style={{ fontSize: "0.85rem" }}>
                (1 = Very dissatisfied, 5 = Very satisfied)
              </span>
            </div>
          </div>

          {/* Q2: difficulty of configuration selection */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
              2. How difficult was the configuration selection task with the framework by defining constraints?
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StarRating value={configDifficulty} onChange={setConfigDifficulty} />
              <span style={{ fontSize: "0.85rem" }}>
                (1 = Very easy, 5 = Very difficult)
              </span>
            </div>
          </div>

{/* Divider text before comparison questions */}
<div
  style={{
    margin: "1rem 0 0.5rem",
    padding: "0.6rem 0.8rem",
    backgroundColor: "#F1F5F9",
    borderRadius: "6px",
    fontSize: "0.9rem",
    color: "#334155",
    border: "1px solid #CBD5E1",
  }}
>
  The following questions (Q3–Q6) refer to the three options shown in the table above.
</div>



	  {/* Q3: consistency */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
              3. How consistent are these three options with each other?
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StarRating value={consistency} onChange={setConsistency} />
              <span style={{ fontSize: "0.85rem" }}>
                (1 = Very inconsistent, 5 = Very consistent)
              </span>
            </div>
          </div>

          {/* Q4: preference */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
              4. If you had to pick one now, which model would you actually use? <br />(if your selected model and top-ranked option are the same, please select the top-ranked option)
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "1.25rem",
                fontSize: "0.95rem",
              }}
            >
              <label>
                <input
                  type="radio"
                  name="preference"
                  value="manual"
                  checked={preference === "manual"}
                  onChange={() => setPreference("manual")}
                />{" "}
                The model I selected manually
              </label>
              <label>
                <input
                  type="radio"
                  name="preference"
                  value="results"
                  checked={preference === "results"}
                  onChange={() => setPreference("results")}
                />{" "}
                The model I selected from the results list
              </label>
              <label>
                <input
                  type="radio"
                  name="preference"
                  value="top"
                  checked={preference === "top"}
                  onChange={() => setPreference("top")}
                />{" "}
                The top-ranked option in the results list
              </label>
            </div>
          </div>

          {/* Q5: confidence */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
              5. How confident are you in this final choice?
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StarRating value={confidence} onChange={setConfidence} />
              <span style={{ fontSize: "0.85rem" }}>
                (1 = Not confident, 5 = Very confident)
              </span>
            </div>
          </div>

          {/* Comments */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
              6. Any comments about the differences between these options, or about the system in
              general?
            </div>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Your comments..."
              style={{
                width: "100%",
                minHeight: "90px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                padding: "0.6rem 0.75rem",
                fontFamily: "inherit",
                fontSize: "0.95rem",
                resize: "vertical",
                color: "#0f172a",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                marginTop: "0.4rem",
                padding: "0.5rem 0.75rem",
                borderRadius: "8px",
                backgroundColor: "#FEF2F2",
                color: "#B91C1C",
                fontSize: "0.9rem",
              }}
            >
              {error}
            </div>
          )}

          {/* Finish button */}
          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isReadyToSubmit()}
              style={{
                borderRadius: "8px",
                padding: "0.6rem 1.8rem",
                border: "none",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: isReadyToSubmit() ? "pointer" : "not-allowed",
                backgroundColor: isReadyToSubmit() ? "#1C39BB" : "#94A3B8",
                color: "white",
              }}
              onMouseOver={(e) => {
                if (isReadyToSubmit()) e.currentTarget.style.backgroundColor = "#CC3333";
              }}
              onMouseOut={(e) => {
                if (isReadyToSubmit()) e.currentTarget.style.backgroundColor = "#1C39BB";
              }}
            >
              Finish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Thank2Page;
