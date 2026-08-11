import { useEffect, useState } from "react";
import { budgetService } from "../../../services/budgetService";
import { useProjects } from "../context/ProjectContext";
import Icon from "../../../components/common/Icon";
import ModalPortal from "../../../components/common/ModalPortal";
import BudgetSummary from "./BudgetSummary";
import ClientPayments from "./ClientPayments";
import "./ProjectDashboardFinance.css";

const ProjectDashboardFinance = ({ projectId, onClose, projectTotalPaid }) => {
  const [showPayments, setShowPayments] = useState(false);
  const [budgetVersions, setBudgetVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  
  const { getBudgetData, budgetCache, budgetLoading } = useProjects();

  useEffect(() => {
    if (!projectId) return;
    const fetchVersions = async () => {
      try {
        const data = await budgetService.getBudgetVersions(projectId);
        if (Array.isArray(data) && data.length > 0) {
          setBudgetVersions(data);
          setSelectedVersionId((prev) => prev || String(data[data.length - 1].id));
        }
      } catch (err) {
        console.error("Failed to fetch budget versions:", err);
      }
    };
    fetchVersions();
  }, [projectId]);

  useEffect(() => {
    if (selectedVersionId && projectId) {
      getBudgetData(projectId, selectedVersionId);
    }
  }, [selectedVersionId, projectId, getBudgetData]);

  return (
    <ModalPortal 
      onClose={onClose}
      size="large"
      className="global-modal-glass finance-glass-override"
    >
      <div className="finance-modal-container">
        <div className="modal-header-section">
          <h2>Project Finances</h2>
          <p>Manage budget and payments</p>
        </div>
        
        <div className="integrated-budget-section fade-in" style={{ marginTop: '20px' }}>
          <div className="finance-sub-nav">
            <button
              className={`btn-neo ${!showPayments ? "btn-neo-solid" : ""}`}
              onClick={() => setShowPayments(false)}
              style={{ gap: '8px' }}
            >
              <Icon name="finance" modifiers="md" />
              <span>Budget Summary</span>
            </button>
            <button
              className={`btn-neo ${showPayments ? "btn-neo-solid" : ""}`}
              onClick={() => setShowPayments(true)}
              style={{ gap: '8px' }}
            >
              <Icon name="payments" modifiers="md" />
              <span>Payment Records</span>
            </button>
          </div>

          {!showPayments ? (
            <>
              {budgetVersions.length > 0 && (
                <div className="budget-version-bar">
                  <span className="bvb-label">
                    <Icon name="layers" modifiers="md" />
                  </span>
                  <div className="bvb-pills">
                    {budgetVersions.map((v) => (
                      <button
                        key={v.id}
                        className={`bvb-pill ${
                          String(v.id) === String(selectedVersionId)
                            ? "active"
                            : ""
                        }`}
                        onClick={() => setSelectedVersionId(String(v.id))}
                      >
                        v{v.version_number}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <BudgetSummary
                projectId={projectId}
                versionId={selectedVersionId}
                hierarchy={
                  budgetCache[projectId]?.[selectedVersionId]?.hierarchy ||
                  []
                }
                values={
                  budgetCache[projectId]?.[selectedVersionId]?.values || {}
                }
                loading={
                  budgetLoading &&
                  !budgetCache[projectId]?.[selectedVersionId]
                }
                totalPaid={projectTotalPaid}
              />
            </>
          ) : (
            <ClientPayments projectId={projectId} />
          )}
        </div>
      </div>
    </ModalPortal>
  );
};

export default ProjectDashboardFinance;
