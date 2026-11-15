/**
 * Lazy-loaded document export utility for Vision Division Finance Workspace.
 * Dynamically imports `jspdf`, `jspdf-autotable`, and `xlsx` on-demand (Web Performance Trick #5).
 */
import { formatCurrency } from "../../../utils/currencyUtils";

export const exportReportToPDF = async (reportData, reportType = "pnl") => {
  const jspdfModule = await import("jspdf");
  const JsPDF = jspdfModule.jsPDF || jspdfModule.default?.jsPDF || jspdfModule.default;
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default || autoTableModule;

  const doc = new JsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const meta = reportData?.meta || {};
  const totals = reportData?.totals || {};
  const dateStr = meta.generated_on || new Date().toISOString().split("T")[0];

  // Vision Division Branded Header
  doc.setFillColor(15, 23, 42); // #0f172a
  doc.rect(0, 0, 210, 32, "F");

  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("VISION DIVISION STUDIO", 14, 15);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184); // #94a3b8
  const reportTitles = {
    pnl: "PROFIT & LOSS STATEMENT",
    income_expense: "INCOME & EXPENSE STATEMENT",
    trial_balance: "TRIAL BALANCE REPORT",
    general_ledger: "GENERAL LEDGER REPORT",
    capital_drawings: "CAPITAL & DRAWINGS STATEMENT",
  };
  const title = reportTitles[reportType] || "FINANCIAL STATEMENT";
  doc.text(title, 14, 23);

  doc.setFontSize(9);
  doc.text(`Generated: ${dateStr} | Scope: ${(meta.scope || "all").toUpperCase()}`, 130, 23);

  let startY = 42;

  if (reportType === "pnl" || reportType === "income_expense") {
    const sections = reportData.sections || {};
    const income = sections.income || [];
    const cogs = sections.cogs || [];
    const opex = sections.operating_expenses || [];

    const tableRows = [];

    // Revenue Section
    tableRows.push([{ content: "1. OPERATING REVENUE (INCOME)", colSpan: 3, styles: { fontStyle: "bold", fillColor: [241, 245, 249] } }]);
    if (income.length === 0) {
      tableRows.push(["No revenue entries recorded for this period", "-", "Rs 0.00"]);
    } else {
      income.forEach((item) => {
        tableRows.push([`${item.code} - ${item.name}`, item.sub_type || "-", formatCurrency(item.amount)]);
      });
    }
    tableRows.push([{ content: "Total Revenue", colSpan: 2, styles: { fontStyle: "bold" } }, { content: formatCurrency(totals.total_revenue || 0), styles: { fontStyle: "bold" } }]);

    // COGS Section
    if (cogs.length > 0) {
      tableRows.push([{ content: "2. DIRECT PROJECT COSTS (COGS)", colSpan: 3, styles: { fontStyle: "bold", fillColor: [241, 245, 249] } }]);
      cogs.forEach((item) => {
        tableRows.push([`${item.code} - ${item.name}`, item.sub_type || "-", formatCurrency(item.amount)]);
      });
      tableRows.push([{ content: "Total Direct Costs", colSpan: 2, styles: { fontStyle: "bold" } }, { content: formatCurrency(totals.total_cogs || 0), styles: { fontStyle: "bold" } }]);
      tableRows.push([{ content: "GROSS PROFIT", colSpan: 2, styles: { fontStyle: "bold", textColor: [16, 185, 129] } }, { content: formatCurrency(totals.gross_profit || 0), styles: { fontStyle: "bold", textColor: [16, 185, 129] } }]);
    }

    // Operating Expenses Section
    tableRows.push([{ content: "3. OPERATING OVERHEAD & EXPENSES", colSpan: 3, styles: { fontStyle: "bold", fillColor: [241, 245, 249] } }]);
    if (opex.length === 0) {
      tableRows.push(["No operating expenses recorded for this period", "-", "Rs 0.00"]);
    } else {
      opex.forEach((item) => {
        tableRows.push([`${item.code} - ${item.name}`, item.sub_type || "-", formatCurrency(item.amount)]);
      });
    }
    tableRows.push([{ content: "Total Operating Expenses", colSpan: 2, styles: { fontStyle: "bold" } }, { content: formatCurrency(totals.total_operating_expenses || 0), styles: { fontStyle: "bold" } }]);

    // Net Profit
    tableRows.push([
      { content: "OPERATING NET PROFIT / (LOSS)", colSpan: 2, styles: { fontStyle: "bold", fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
      { content: formatCurrency(totals.net_profit || 0), styles: { fontStyle: "bold", fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
    ]);

    autoTable(doc, {
      startY,
      head: [["Account Description", "Category", "Amount (LKR)"]],
      body: tableRows,
      theme: "plain",
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 45 }, 2: { cellWidth: 45, halign: "right" } },
    });
  } else if (reportType === "trial_balance") {
    const rows = reportData.rows || [];
    const tableRows = rows.map((r) => [
      r.code,
      r.name,
      r.account_class?.toUpperCase() || "-",
      formatCurrency(r.period_debit),
      formatCurrency(r.period_credit),
      formatCurrency(r.closing_debit),
      formatCurrency(r.closing_credit),
    ]);

    tableRows.push([
      { content: "TOTALS", colSpan: 3, styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
      { content: formatCurrency(totals.total_debit || 0), styles: { fontStyle: "bold" } },
      { content: formatCurrency(totals.total_credit || 0), styles: { fontStyle: "bold" } },
      { content: totals.is_balanced ? "BALANCED" : "OUT OF BALANCE", colSpan: 2, styles: { fontStyle: "bold", halign: "center", textColor: totals.is_balanced ? [16, 185, 129] : [239, 68, 68] } },
    ]);

    autoTable(doc, {
      startY,
      head: [["Code", "Account Name", "Class", "Period Dr", "Period Cr", "Closing Dr", "Closing Cr"]],
      body: tableRows,
      theme: "plain",
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
      },
    });
  } else if (reportType === "general_ledger") {
    const rows = reportData.rows || [];
    const tableRows = rows.map((r) => [
      r.entry_date || "-",
      r.voucher_no || "-",
      `${r.account_code} ${r.account_name}`,
      r.project_name || r.scope?.toUpperCase() || "-",
      formatCurrency(r.debit),
      formatCurrency(r.credit),
      r.memo || "-",
    ]);

    autoTable(doc, {
      startY,
      head: [["Date", "Voucher", "Account", "Scope/Project", "Debit", "Credit", "Memo"]],
      body: tableRows,
      theme: "plain",
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });
  } else if (reportType === "capital_drawings") {
    const rows = reportData.rows || [];
    const tableRows = rows.map((r) => [
      r.owner_name || "-",
      r.role?.toUpperCase() || "DIRECTOR",
      formatCurrency(r.capital_contributed),
      formatCurrency(r.drawings_taken),
      formatCurrency(Number(r.capital_contributed || 0) - Number(r.drawings_taken || 0)),
    ]);

    autoTable(doc, {
      startY,
      head: [["Stakeholder", "Role", "Capital Injected", "Drawings Taken", "Net Equity Balance"]],
      body: tableRows,
      theme: "plain",
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right", fontStyle: "bold" },
      },
    });
  }

  const filename = `vision_division_${reportType}_${dateStr}.pdf`;
  doc.save(filename);
};

export const exportReportToExcel = async (reportData, reportType = "pnl") => {
  const XLSX = await import("xlsx");
  const meta = reportData?.meta || {};
  const totals = reportData?.totals || {};
  const dateStr = meta.generated_on || new Date().toISOString().split("T")[0];

  const wb = XLSX.utils.book_new();

  if (reportType === "pnl" || reportType === "income_expense") {
    const rows = [
      ["VISION DIVISION STUDIO - PROFIT & LOSS STATEMENT"],
      [`Generated: ${dateStr}`, `Scope: ${meta.scope || "all"}`],
      [],
      ["Section", "Account Code", "Account Name", "Amount (LKR)"],
    ];

    const sections = reportData.sections || {};
    (sections.income || []).forEach((x) => rows.push(["Revenue", x.code, x.name, Number(x.amount || 0)]));
    rows.push(["Total Revenue", "", "", Number(totals.total_revenue || 0)]);
    rows.push([]);

    (sections.cogs || []).forEach((x) => rows.push(["Direct Costs (COGS)", x.code, x.name, Number(x.amount || 0)]));
    rows.push(["Total Direct Costs", "", "", Number(totals.total_cogs || 0)]);
    rows.push(["Gross Profit", "", "", Number(totals.gross_profit || 0)]);
    rows.push([]);

    (sections.operating_expenses || []).forEach((x) => rows.push(["Operating Expense", x.code, x.name, Number(x.amount || 0)]));
    rows.push(["Total Operating Expenses", "", "", Number(totals.total_operating_expenses || 0)]);
    rows.push([]);
    rows.push(["OPERATING NET PROFIT", "", "", Number(totals.net_profit || 0)]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Profit & Loss");
  } else if (reportType === "trial_balance") {
    const rows = [
      ["VISION DIVISION STUDIO - TRIAL BALANCE"],
      [`Generated: ${dateStr}`, `Scope: ${meta.scope || "all"}`],
      [],
      ["Code", "Account Name", "Class", "Period Debit", "Period Credit", "Closing Debit", "Closing Credit"],
    ];
    (reportData.rows || []).forEach((r) => {
      rows.push([
        r.code,
        r.name,
        r.account_class,
        Number(r.period_debit || 0),
        Number(r.period_credit || 0),
        Number(r.closing_debit || 0),
        Number(r.closing_credit || 0),
      ]);
    });
    rows.push([]);
    rows.push([
      "TOTALS",
      "",
      "",
      Number(totals.total_debit || 0),
      Number(totals.total_credit || 0),
      totals.is_balanced ? "BALANCED" : "OUT OF BALANCE",
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
  } else if (reportType === "general_ledger") {
    const rows = [
      ["VISION DIVISION STUDIO - GENERAL LEDGER"],
      [`Generated: ${dateStr}`, `Scope: ${meta.scope || "all"}`],
      [],
      ["Date", "Voucher No", "Doc Type", "Scope", "Account Code", "Account Name", "Project", "Person", "Debit", "Credit", "Memo"],
    ];
    (reportData.rows || []).forEach((r) => {
      rows.push([
        r.entry_date,
        r.voucher_no,
        r.doc_type,
        r.scope,
        r.account_code,
        r.account_name,
        r.project_name || "",
        r.person_name || "",
        Number(r.debit || 0),
        Number(r.credit || 0),
        r.memo || "",
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "General Ledger");
  } else if (reportType === "capital_drawings") {
    const rows = [
      ["VISION DIVISION STUDIO - CAPITAL & DRAWINGS STATEMENT"],
      [`Generated: ${dateStr}`, `Scope: ${meta.scope || "all"}`],
      [],
      ["Stakeholder", "Role", "Capital Injected", "Drawings Taken", "Net Balance"],
    ];
    (reportData.rows || []).forEach((r) => {
      rows.push([
        r.owner_name,
        r.role || "Director",
        Number(r.capital_contributed || 0),
        Number(r.drawings_taken || 0),
        Number(r.capital_contributed || 0) - Number(r.drawings_taken || 0),
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Capital & Drawings");
  }

  const filename = `vision_division_${reportType}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);
};
