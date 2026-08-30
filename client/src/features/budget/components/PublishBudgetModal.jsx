import React, { useState, useEffect } from "react";
import ModalPortal from "../../../components/common/ModalPortal";
import { budgetService } from "../../../services/budgetService";

const PublishBudgetModal = ({
  isOpen,
  onClose,
  projectId,
  versionsCache,
  initialVersionId,
  onSuccess
}) => {
  const [selectedPublishVersionId, setSelectedPublishVersionId] = useState("");
  const [publishToCrew, setPublishToCrew] = useState(false);
  const [publishToClient, setPublishToClient] = useState(false);

  useEffect(() => {
    if (isOpen && initialVersionId) {
      setSelectedPublishVersionId(initialVersionId);
      const versionList = versionsCache[projectId] || [];
      const currentVersion = versionList.find((v) => String(v.id) === String(initialVersionId));
      if (currentVersion) {
        setPublishToCrew(!!currentVersion.published_to_crew);
        setPublishToClient(!!currentVersion.published_to_client);
      } else {
        setPublishToCrew(false);
        setPublishToClient(false);
      }
    }
  }, [isOpen, initialVersionId, projectId, versionsCache]);

  const handlePublishVersionChange = (targetVersionId) => {
    setSelectedPublishVersionId(targetVersionId);
    const versionList = versionsCache[projectId] || [];
    const targetVersion = versionList.find((v) => String(v.id) === String(targetVersionId));
    if (targetVersion) {
      setPublishToCrew(!!targetVersion.published_to_crew);
      setPublishToClient(!!targetVersion.published_to_client);
    } else {
      setPublishToCrew(false);
      setPublishToClient(false);
    }
  };

  const handleSavePublishSettings = async () => {
    try {
      const data = await budgetService.publishBudgetVersion(selectedPublishVersionId, {
        published_to_crew: publishToCrew,
        published_to_client: publishToClient,
      });

      if (data && !data.error) {
        alert("Publish settings saved!");
        onSuccess && await onSuccess();
        onClose();
      } else {
        alert(`Failed to update publish settings: ${data?.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error saving publish settings");
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal className="no-glass" showClose={false}>
      <div className="publish-modal-overlay" onClick={onClose}>
        <div className="publish-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="publish-modal-header">
            <h3>Publish Budget Version</h3>
            <button className="publish-modal-close" onClick={onClose}>&times;</button>
          </div>
          <div className="publish-modal-body">
            <div className="publish-modal-field">
              <label className="publish-modal-label">Select Version to Publish</label>
              <select
                className="publish-version-select"
                value={selectedPublishVersionId}
                onChange={(e) => handlePublishVersionChange(e.target.value)}
              >
                {(versionsCache[projectId] || []).map((v) => {
                  const tags = [];
                  if (v.published_to_crew) tags.push("Crew");
                  if (v.published_to_client) tags.push("Client");
                  const tagStr = tags.length > 0 ? ` [Published: ${tags.join(" & ")}]` : "";
                  return (
                    <option key={v.id} value={v.id}>
                      Version {v.version_number}{tagStr}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="publish-version-details">
              <div className="detail-item">
                <span className="detail-label">Active Version in Editor:</span>
                <span className="detail-value active-highlight">
                  Version {(versionsCache[projectId] || []).find((v) => String(v.id) === String(initialVersionId))?.version_number || "None"}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Last Published:</span>
                <span className="detail-value">
                  {(() => {
                    const selVer = (versionsCache[projectId] || []).find((v) => String(v.id) === String(selectedPublishVersionId));
                    if (selVer && selVer.published_at) {
                      return new Date(selVer.published_at).toLocaleString();
                    }
                    return "Not published yet";
                  })()}
                </span>
              </div>
            </div>

            <div className="publish-options-group">
              <div className="publish-option">
                <label className="publish-checkbox-label">
                  <input
                    type="checkbox"
                    checked={publishToCrew}
                    onChange={(e) => setPublishToCrew(e.target.checked)}
                    className="publish-checkbox-input"
                  />
                  <span>Publish to Production Crew</span>
                </label>
              </div>

              <div className="publish-option">
                <label className="publish-checkbox-label">
                  <input
                    type="checkbox"
                    checked={publishToClient}
                    onChange={(e) => setPublishToClient(e.target.checked)}
                    className="publish-checkbox-input"
                  />
                  <span>Publish to Client</span>
                </label>
              </div>
            </div>
          </div>
          <div className="publish-modal-footer">
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <button className="btn-save" onClick={handleSavePublishSettings}>Save Settings</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default PublishBudgetModal;
