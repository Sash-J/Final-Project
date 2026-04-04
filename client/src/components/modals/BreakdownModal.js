import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "./BreakdownModal.css";

const BreakdownModal = ({
  isOpen,
  onClose,
  onSave,
  initialItems = [],
  itemName = "",
}) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (isOpen) {
      if (initialItems && initialItems.length > 0) {
        setItems(
          initialItems.map((item) => ({
            ...item,
            id: item.id || Math.random().toString(36).substr(2, 9),
          })),
        );
      } else {
        setItems([
          {
            id: Math.random().toString(36).substr(2, 9),
            description: "",
            quantity: "",
            rate_type: "day",
            rate_multiplier: "1",
            rate: "",
            gross_revenue: 0,
            additional1: "",
            total: 0,
          },
        ]);
      }
    }
  }, [isOpen, initialItems]);

  const calculateRow = (item) => {
    const q = parseFloat(item.quantity) || 0;
    const m = parseFloat(item.rate_multiplier) || 1;
    const r = parseFloat(item.rate) || 0;
    const a = parseFloat(item.additional1) || 0;

    const gross = +(q * m * r).toFixed(2);
    const total = +(gross + a).toFixed(2);

    return { ...item, gross_revenue: gross, total: total };
  };

  const handleRowChange = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          return calculateRow(updated);
        }
        return item;
      }),
    );
  };

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        description: "",
        quantity: "",
        rate_type: "day",
        rate_multiplier: "1",
        rate: "",
        gross_revenue: 0,
        additional1: "",
        total: 0,
      },
    ]);
  };

  const removeRow = (id) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    } else {
      // Clear the only row instead of removing it
      setItems([
        {
          id: Math.random().toString(36).substr(2, 9),
          description: "",
          quantity: "",
          rate_type: "day",
          rate_multiplier: "1",
          rate: "",
          gross_revenue: 0,
          additional1: "",
          total: 0,
        },
      ]);
    }
  };

  const grandTotal = items.reduce(
    (sum, item) => sum + (parseFloat(item.total) || 0),
    0,
  );

  const handleSave = () => {
    // Filter out empty rows
    const validItems = items.filter(
      (i) => i.description.trim() !== "" || parseFloat(i.total) > 0,
    );
    onSave(validItems, grandTotal);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="bdm-overlay">
      <div className="bdm-content fade-in">
        <div className="bdm-header">
          <div className="bdm-header-left">
            <h3>Itemization Breakdown</h3>
            <p>
              Sub-items for: <strong>{itemName}</strong>
            </p>
          </div>
          <button className="bdm-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="bdm-body">
          <table className="bdm-table">
            <thead>
              <tr>
                <th style={{ width: "24%" }}>Sub-Item Name</th>
                <th style={{ width: "7%" }}>Qty</th>
                <th style={{ width: "13%" }}>Type</th>
                <th style={{ width: "7%" }}>Mult.</th>
                <th style={{ width: "11%" }}>Rate</th>
                <th style={{ width: "11%" }}>Gross</th>
                <th style={{ width: "11%" }}>Add.</th>
                <th style={{ width: "11%" }}>Total</th>
                <th style={{ width: "40px" }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="bdm-row">
                  <td>
                    <input
                      type="text"
                      placeholder="e.g. 2K Fresnel"
                      value={item.description}
                      onChange={(e) =>
                        handleRowChange(item.id, "description", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      placeholder="0"
                      value={item.quantity}
                      onChange={(e) =>
                        handleRowChange(item.id, "quantity", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="bdm-select"
                      value={item.rate_type}
                      onChange={(e) =>
                        handleRowChange(item.id, "rate_type", e.target.value)
                      }
                    >
                      <option value="day">Day</option>
                      <option value="cs">Call Sheet</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      placeholder="1"
                      value={item.rate_multiplier}
                      onChange={(e) =>
                        handleRowChange(
                          item.id,
                          "rate_multiplier",
                          e.target.value,
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={item.rate}
                      onChange={(e) =>
                        handleRowChange(item.id, "rate", e.target.value)
                      }
                    />
                  </td>
                  <td className="bdm-readonly">
                    {item.gross_revenue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={item.additional1}
                      onChange={(e) =>
                        handleRowChange(item.id, "additional1", e.target.value)
                      }
                    />
                  </td>
                  <td className="bdm-total-cell">
                    {item.total.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td>
                    <button
                      className="bdm-remove-btn"
                      onClick={() => removeRow(item.id)}
                      title="Remove Row"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="bdm-add-row" onClick={addRow}>
            <span className="material-symbols-outlined">add</span> Add Another
            Sub-Item
          </button>
        </div>

        <div className="bdm-footer">
          <div className="bdm-grand-total">
            <span>Aggregated Total:</span>
            <strong>
              Rs.{" "}
              {grandTotal.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </strong>
          </div>
          <div className="bdm-actions">
            <button className="bdm-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button className="bdm-save-btn" onClick={handleSave}>
              Save & Apply
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default BreakdownModal;
