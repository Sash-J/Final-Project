import React, { useState } from "react";
import PageHeader from "../common/PageHeader";
import "./BudgetPredictor.css";

import { API } from "../../config";

const BudgetPredictor = () => {
  const [formData, setFormData] = useState({
    shooting_days: "",
    crew_size: "",
    location_count: "",
    Indoor_shoot: 0,
    within_colombo: 0,
    crew_budget: "",
    light_budget: "",
    camera_budget: "",
    transport_budget: "",
    location_budget: "",
    post_budget: "",
    artist_popularity: 1,
    vfx_required: 0,
  });

  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (checked ? 1 : 0) : value,
    }));
  };

  const handlePredict = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPrediction(null);

    try {
      const response = await fetch(`${API}/api/predict-budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Prediction failed");

      setPrediction(data.predicted_total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 3,
    }).format(val);
  };

  return (
    <div className="predictor-container">
      <PageHeader
        title="Budget Predictor"
        description="Estimate project's total budget using our Model."
      />

      <div className="predictor-glass-card">
        <form onSubmit={handlePredict} className="predictor-form-bento">
          {/* Box 1: Scale & Logistics */}
          <div className="bento-box box-logistics">
            <h3>Logistics & Scale</h3>
            <div className="input-field">
              <label>Shooting Days</label>
              <input
                type="number"
                name="shooting_days"
                value={formData.shooting_days}
                onChange={handleChange}
                placeholder="e.g. 5"
                required
              />
            </div>
            <div className="input-field">
              <label>Crew Size</label>
              <input
                type="number"
                name="crew_size"
                value={formData.crew_size}
                onChange={handleChange}
                placeholder="e.g. 20"
                required
              />
            </div>
            <div className="input-field">
              <label>Location Count</label>
              <input
                type="number"
                name="location_count"
                value={formData.location_count}
                onChange={handleChange}
                placeholder="e.g. 3"
                required
              />
            </div>
            <div className="toggle-row">
              <label className="bento-switch">
                <span>Indoor</span>
                <input
                  type="checkbox"
                  name="Indoor_shoot"
                  checked={formData.Indoor_shoot === 1}
                  onChange={handleChange}
                />
                <span className="bento-slider"></span>
              </label>
              <label className="bento-switch">
                <span>Colombo</span>
                <input
                  type="checkbox"
                  name="within_colombo"
                  checked={formData.within_colombo === 1}
                  onChange={handleChange}
                />
                <span className="bento-slider"></span>
              </label>
            </div>
          </div>

          {/* Box 2: Financial Breakdown */}
          <div className="bento-box box-finance">
            <h3>Dept. Estimates (Rs.)</h3>
            <div className="finance-grid">
              <div className="input-field">
                <label>Crew Budget</label>
                <input
                  type="number"
                  name="crew_budget"
                  value={formData.crew_budget}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="input-field">
                <label>Lights Budget</label>
                <input
                  type="number"
                  name="light_budget"
                  value={formData.light_budget}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="input-field">
                <label>Camera Budget</label>
                <input
                  type="number"
                  name="camera_budget"
                  value={formData.camera_budget}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="input-field">
                <label>Transport Budget</label>
                <input
                  type="number"
                  name="transport_budget"
                  value={formData.transport_budget}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="input-field">
                <label>Location Budget</label>
                <input
                  type="number"
                  name="location_budget"
                  value={formData.location_budget}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="input-field">
                <label>Post/Editing</label>
                <input
                  type="number"
                  name="post_budget"
                  value={formData.post_budget}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          {/* Box 3: Quality Factors */}
          <div className="bento-box box-quality">
            <h3>Production Value</h3>
            <div className="input-field">
              <label>Artist Popularity (1-5)</label>
              <div className="range-container">
                <input
                  type="range"
                  name="artist_popularity"
                  min="1"
                  max="5"
                  value={formData.artist_popularity}
                  onChange={handleChange}
                  className="bento-range"
                />
                <div className="range-markers">
                  <span>Regular</span>
                  <span>Superstar</span>
                </div>
              </div>
            </div>
            <div className="toggle-row" style={{ marginTop: "15px" }}>
              <label className="bento-switch">
                <span>VFX Required</span>
                <input
                  type="checkbox"
                  name="vfx_required"
                  checked={formData.vfx_required === 1}
                  onChange={handleChange}
                />
                <span className="bento-slider"></span>
              </label>
            </div>
          </div>

          {/* Box 4: User Consideration Notes */}
          <div className="bento-box box-notes">
            <h3>User Considerations</h3>
            <p className="notes-text">
              This model is optimized for projects with a total budget{" "}
              <strong>under 2 Million LKR</strong>. Estimates for larger
              projects may have reduced accuracy due to dataset limitations.
              <br />
              <br />
              Please consider the predications as a reference and is{" "}
              <strong>subjected to a variance of +/- 300,000 LKR</strong>.
            </p>
          </div>

          {/* Box 5: Prediction Console */}
          <div className="bento-box box-console">
            <div className="console-layout">
              <div className="action-area">
                <button
                  type="submit"
                  className={`bento-btn ${loading ? "loading" : ""}`}
                  disabled={loading}
                >
                  {loading ? "Calculating..." : "Predict Total Budget"}
                </button>
              </div>

              <div className="result-area">
                {prediction ? (
                  <div className="prediction-display fade-in">
                    <span className="result-title">Estimated Total</span>
                    <span className="result-amount">
                      {formatCurrency(prediction)}
                    </span>
                  </div>
                ) : (
                  <div className="prediction-placeholder">
                    Ready for analysis...
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        {error && <div className="predictor-error">❌ {error}</div>}
      </div>
    </div>
  );
};

export default BudgetPredictor;
