import { useEffect, useState } from "react";
import { formatCurrency } from "../../utils/currencyUtils";
import Icon from "../common/Icon";
import ModalPortal from "../common/ModalPortal";
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
    const validItems = items.filter(
      (i) => i.description.trim() !== "" || parseFloat(i.total) > 0,
    );
    onSave(validItems, grandTotal);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalPortal onClose={onClose} className="breakdown-modal-container">
      <div className="modal-header-section">
        <h2>Itemization Breakdown</h2>
        <p>
          Sub-items for: <strong>{itemName}</strong>
        </p>
      </div>

      <div className="bdm-body">
        <table className="bdm-table">
          <thead>
            <tr>
              <th className="col-desc">Sub-Item Name</th>
              <th className="col-qty">Qty</th>
              <th className="col-type">Type</th>
              <th className="col-mult">Mult.</th>
              <th className="col-rate">Rate</th>
              <th className="col-gross">Gross</th>
              <th className="col-add">Add.</th>
              <th className="col-total">Total</th>
              <th className="col-action"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
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
                  {formatCurrency(item.gross_revenue, false)}
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
                  {formatCurrency(item.total, false)}
                </td>
                <td>
                  {index > 0 && (
                    <button
                      className="project-hero-btn delete remove-item-btn"
                      onClick={() => removeRow(item.id)}
                      title="Remove Row"
                    >
                      <Icon name="delete" modifiers="sm" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="bdm-add-row-container">
          <button className="btn-neo bdm-add-row-btn" onClick={addRow}>
            <Icon name="add" modifiers="sm" /> <span>Add Another Sub-Item</span>
          </button>
        </div>
      </div>

      <div className="bdm-footer">
        <div className="bdm-grand-total">
          <span>Aggregated Total:</span>
          <strong>{formatCurrency(grandTotal)}</strong>
        </div>
        <div className="bdm-actions">
          <button className="btn-neo btn-neo-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-neo btn-neo-solid" onClick={handleSave}>
            Save & Apply
          </button>
        </div>
      </div>
    </ModalPortal>
  );
};

export default BreakdownModal;
