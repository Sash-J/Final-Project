import React from "react";
import ProjectFinancesView from "./ProjectFinancesView";
import CompanyFinancesView from "./CompanyFinancesView";
import PersonalFinancesView from "./PersonalFinancesView";
import TransactionsLedgerView from "./TransactionsLedgerView";
import DebtorsCreditorsView from "./DebtorsCreditorsView";
import FinancialReportsView from "./FinancialReportsView";
import AccountsTaxonomyView from "./AccountsTaxonomyView";
import PerformanceAuditView from "./PerformanceAuditView";
import "./FinanceLazySection.css";

const FinanceLazySection = ({ sectionKey }) => {
  if (sectionKey === "projects") {
    return <ProjectFinancesView />;
  }
  if (sectionKey === "company") {
    return <CompanyFinancesView />;
  }
  if (sectionKey === "personal") {
    return <PersonalFinancesView />;
  }
  if (sectionKey === "ledger") {
    return <TransactionsLedgerView />;
  }
  if (sectionKey === "debtors") {
    return <DebtorsCreditorsView />;
  }
  if (sectionKey === "reports") {
    return <FinancialReportsView />;
  }
  if (sectionKey === "accounts") {
    return <AccountsTaxonomyView />;
  }
  if (sectionKey === "telemetry") {
    return <PerformanceAuditView />;
  }

  return (
    <div className="fin-lazy-unknown">
      <p>Unknown Finance Section: {sectionKey}</p>
    </div>
  );
};

export default FinanceLazySection;
