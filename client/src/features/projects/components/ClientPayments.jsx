import React, { useState, useEffect } from "react";
import { useProjects } from "../context/ProjectContext";
import { useAuth } from "../../auth/context/AuthContext";
import Icon from "../../../components/common/Icon";
import GlassDatePicker from "../../../components/common/GlassDatePicker";
import "./ClientPayments.css";
import { formatCurrency, getCurrencySymbol } from "../../../utils/currencyUtils";

const ClientPayments = ({ projectId }) => {
  const { user } = useAuth();
  const {
    getProjectPayments,
    paymentsCache,
    paymentsLoading,
    recordPayment,
    detailsCache,
  } = useProjects();

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [recording, setRecording] = useState(false);
  const [msg, setMsg] = useState(null);

  const payments = paymentsCache[projectId] || [];
  const project = detailsCache[projectId] || {};
  const isAdmin = user?.role === "admin" || user?.role === "manager";

  useEffect(() => {
    if (projectId) {
      getProjectPayments(projectId);
    }
  }, [projectId, getProjectPayments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !date) return;

    setRecording(true);
    setMsg(null);

    const result = await recordPayment(projectId, {
      amount: parseFloat(amount),
      payment_date: date,
      notes: notes.trim(),
    });

    if (result.success) {
      setMsg({ type: "success", text: "Payment recorded successfully!" });
      setAmount("");
      setNotes("");
      setDate(new Date().toISOString().split("T")[0]);
    } else {
      setMsg({
        type: "error",
        text: result.error || "Failed to record payment",
      });
    }
    setRecording(false);
  };

  const totalPaid = payments.reduce(
    (sum, p) => sum + (parseFloat(p.amount) || 0),
    0,
  );

  return (
    <div className="client-payments-root">
      <div className="payments-overview-grid">
        <div className="payment-stat-card glass-card">
          <div className="stat-icon-wrap received">
            <Icon name="payments" modifiers="md" />
          </div>
          <div className="stat-content">
            <label>Total Received</label>
            <h3>{formatCurrency(totalPaid)}</h3>
          </div>
        </div>
        <div className="payment-stat-card glass-card">
          <div className="stat-icon-wrap pending">
            <Icon name="account_balance_wallet" modifiers="md" />
          </div>
          <div className="stat-content">
            <label>Outstanding Balance</label>
            <h3
              className={project.balance > 0 ? "warning-text" : "success-text"}
            >
              {formatCurrency(project.balance || 0)}
            </h3>
          </div>
        </div>
      </div>

      <div className="payments-main-layout">
        <div className="payment-history-panel glass-card">
          <div className="panel-header">
            <h3>Payment History</h3>
            <span className="count-badge">{payments.length} Records</span>
          </div>

          {paymentsLoading && payments.length === 0 ? (
            <div className="payments-loading">
              <div className="spinner-simple" />
              <span>Loading records...</span>
            </div>
          ) : payments.length === 0 ? (
            <div className="empty-payments">
              <Icon name="history" modifiers="lg" />
              <p>No payments recorded yet.</p>
            </div>
          ) : (
            <div className="payment-list-table-wrap">
              <table className="payment-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference / Notes</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="payment-row">
                      <td className="date-cell">
                        {new Date(p.payment_date).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </td>
                      <td className="notes-cell">
                        {p.notes || <span className="no-notes">N/A</span>}
                      </td>
                      <td className="amount-cell text-right">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="record-payment-panel glass-card">
            <h3>Record New Payment</h3>
            <p className="panel-subtext">Add a client payment to the ledger.</p>

            {msg && (
              <div className="neo-status-messages" style={{ marginBottom: "20px" }}>
                <div className={`neo-status ${msg.type} show`}>
                  <Icon
                    name={msg.type === "success" ? "check_circle" : "error"}
                    modifiers="sm"
                  />
                  <span>{msg.text}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="neo-form">
              <div className="neo-form-group">
                <label className="neo-label">Amount ({getCurrencySymbol()})</label>
                <div className="input-with-icon">
                  <span className="currency-tag">{getCurrencySymbol()}</span>
                  <input
                    type="number"
                    className="neo-input"
                    placeholder="0.00"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="neo-form-group">
                <label className="neo-label">Payment Date</label>
                <GlassDatePicker 
                  value={date} 
                  onChange={(val) => setDate(val)} 
                  required 
                />
              </div>

              <div className="neo-form-group">
                <label className="neo-label">Reference / Notes</label>
                <textarea
                  className="neo-input"
                  placeholder="e.g. Bank Transfer Ref #12345"
                  rows="3"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn-neo btn-neo-solid"
                disabled={recording}
                style={{ width: "100%", marginTop: "10px" }}
              >
                {recording ? "Recording..." : "Capture Payment"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientPayments;
