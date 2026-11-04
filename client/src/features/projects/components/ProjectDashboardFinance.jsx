import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { budgetService } from "../../../services/budgetService";
import { useProjects } from "../context/ProjectContext";
import { useAuth } from "../../auth/context/AuthContext";
import Icon from "../../../components/common/Icon";
import ModalPortal from "../../../components/common/ModalPortal";
import Dock from "../../../components/common/Dock";
import BudgetSummary from "./BudgetSummary";
import ClientPayments from "./ClientPayments";
import "./ProjectDashboardFinance.css";

const ProjectDashboardFinance = ({ projectId, onClose, projectTotalPaid }) => {
  const navigate = useNavigate();
  const [showPayments, setShowPayments] = useState(false);
  const [autoHide, setAutoHide] = useState(true);
  const [budgetVersions, setBudgetVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");

  const { getBudgetData, budgetCache, budgetLoading } = useProjects();
  const { hasPermission, hasRole } = useAuth();
  const isClient = hasRole("client");
  const canEditBudget = hasPermission("budget.edit") && !isClient;

  const handleFullBudgetSheetClick = () => {
    if (!canEditBudget) return;
    if (onClose) onClose();
    const queryParams = new URLSearchParams();
    if (projectId) queryParams.set("projectId", projectId);
    if (selectedVersionId) queryParams.set("versionId", selectedVersionId);
    navigate(`/admin-budget?${queryParams.toString()}`);
  };

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

  const dockItems = [
    {
      icon: <Icon name="insights" modifiers="sm" />,
      label: "Budget Summary",
      active: !showPayments,
      onClick: () => setShowPayments(false),
      menu: [
        {
          label: "Visual Overview & Trajectory",
          checked: !showPayments,
          onClick: () => setShowPayments(false),
        },
        {
          label: "Switch to Payment Records",
          checked: showPayments,
          onClick: () => setShowPayments(true),
        },
      ],
    },
    {
      icon: <Icon name="payments" modifiers="sm" />,
      label: "Client Payments",
      active: showPayments,
      onClick: () => setShowPayments(true),
      menu: [
        {
          label: "View Payment Ledger & Invoices",
          checked: showPayments,
          onClick: () => setShowPayments(true),
        },
        {
          label: "Switch to Budget Summary",
          checked: !showPayments,
          onClick: () => setShowPayments(false),
        },
      ],
    },
    {
      icon: <Icon name="open_in_new" modifiers="sm" />,
      label: canEditBudget
        ? "Full Interactive Budget Sheet"
        : "Editing Permissions Required",
      disabled: !canEditBudget,
      onClick: handleFullBudgetSheetClick,
      menu: canEditBudget
        ? [
          {
            label: "Open Full Sheet in Editor",
            onClick: handleFullBudgetSheetClick,
          },
        ]
        : [
          {
            label: "Admin Edit Permissions Required",
            disabled: true,
          },
        ],
    },
    {
      separator: true,
    },
    {
      icon: (
        <Icon
          name={autoHide ? "push_pin" : "keep"}
          modifiers={`sm ${!autoHide ? "filled" : ""}`}
        />
      ),
      label: autoHide
        ? "Auto-Hide: ON (Click to Pin)"
        : "Dock Pinned (Click to Auto-Hide)",
      active: !autoHide,
      className: `dock-toggle-item ${!autoHide ? "is-pinned" : ""}`,
      onClick: () => setAutoHide((prev) => !prev),
      menu: [
        {
          label: "Auto-Hide Dock",
          checked: autoHide,
          onClick: () => setAutoHide(true),
        },
        {
          label: "Pin Dock (Keep Visible)",
          checked: !autoHide,
          onClick: () => setAutoHide(false),
        },
      ],
    },
  ];

  return (
    <ModalPortal
      onClose={onClose}
      size="large"
      showClose={true}
      className={`global-modal-glass finance-glass-override ${!autoHide ? "is-dock-pinned" : ""}`}
    >
      {/* macOS-style Spring Physics Dock Navigation */}
      <Dock
        items={dockItems}
        position="left"
        autoHide={autoHide}
        baseItemSize={45}
        magnification={60}
        panelHeight={70}
        distance={190}
        gap={10}
        roundness={0.5}
        spring="smooth"
        bounce={false}
        tiles={true}
        showLabels={true}
        showIndicators={false}
        showBadges={false}
        accentColor="#00c6e6"
        className="finance-dock"
      />

      {/* Navigation Edge Indicator (Visible when dock is auto-hidden) */}
      <button
        type="button"
        className="finance-dock-indicator"
        onClick={() => setAutoHide(false)}
        title="Finance Navigation (Hover to reveal, Click to pin)"
        aria-label="Reveal Finance Navigation Dock"
      >
        <span className="indicator-handle">
          <span className="indicator-dot" />
          <Icon name="chevron_left" modifiers="xs" className="indicator-chevron" />
        </span>
      </button>

      <div className="finance-modal-container">
        {/* Standard global modal header section matching website modals */}
        <div className="modal-header-section">
          <h2>PROJECT FINANCES</h2>
          <p>Manage budget and payments</p>
        </div>

        {/* Main Dashboard Stage */}
        <section className="finance-main-stage">
          <div className="finance-stage-content">
            {!showPayments ? (
              <BudgetSummary
                projectId={projectId}
                versionId={selectedVersionId}
                versions={budgetVersions}
                hierarchy={
                  budgetCache[projectId]?.[selectedVersionId]?.hierarchy || []
                }
                values={
                  budgetCache[projectId]?.[selectedVersionId]?.values || {}
                }
                loading={
                  budgetLoading && !budgetCache[projectId]?.[selectedVersionId]
                }
                totalPaid={projectTotalPaid}
                onSwitchToPayments={() => setShowPayments(true)}
                onSelectVersion={(newId) => setSelectedVersionId(newId)}
              />
            ) : (
              <ClientPayments projectId={projectId} />
            )}
          </div>
        </section>
      </div>
    </ModalPortal>
  );
};

export default ProjectDashboardFinance;
