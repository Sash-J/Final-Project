import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatCurrency } from "../../../utils/currencyUtils";

const buildDetailData = (hierarchy, values) => {
  const rows = [];
  hierarchy.forEach((phase) => {
    rows.push({ type: "phase", name: phase.phase_name });
    
    phase.departments.forEach((dept) => {
      rows.push({ type: "department", name: dept.department_name });
      
      dept.categories.forEach((cat) => {
        rows.push({ type: "category", name: cat.category_name });
        
        cat.items.forEach((item) => {
          const val = values[item.id] || {};
          const quantity = val.quantity || 0;
          const rate = val.rate || 0;
          const total = val.total || 0;
          
          if (quantity > 0 || rate > 0 || total > 0) {
            rows.push({
              type: "item",
              name: item.item_name,
              description: val.comment1 || "",
              quantity,
              rate,
              multiplier: val.rate_multiplier || 1,
              total
            });
          }
        });
      });
    });
  });
  return rows;
};

const buildTopSheetData = (hierarchy, values) => {
  const rows = [];
  let grandTotal = 0;

  hierarchy.forEach((phase) => {
    let phaseTotal = 0;
    const phaseRows = [];

    phase.departments.forEach((dept) => {
      let deptTotal = 0;
      dept.categories.forEach((cat) => {
        cat.items.forEach((item) => {
          const val = values[item.id] || {};
          deptTotal += Number(val.total || 0);
        });
      });

      if (deptTotal > 0) {
        phaseRows.push({ name: dept.department_name, total: deptTotal });
        phaseTotal += deptTotal;
      }
    });

    if (phaseTotal > 0) {
      rows.push({ type: "phase_header", name: phase.phase_name });
      rows.push(...phaseRows.map(r => ({ type: "department", ...r })));
      rows.push({ type: "phase_total", name: `Total ${phase.phase_name}`, total: phaseTotal });
      grandTotal += phaseTotal;
    }
  });

  rows.push({ type: "grand_total", name: "GRAND TOTAL", total: grandTotal });
  return { rows, grandTotal };
};

export const exportBudgetToPDF = (hierarchy, values, projectName, versionName, type = "topsheet") => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(projectName || "Project Budget", 14, 22);
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`Version: ${versionName || "Default"} | Format: ${type.toUpperCase()}`, 14, 30);
  
  if (type === "topsheet") {
    const { rows } = buildTopSheetData(hierarchy, values);
    
    const tableBody = rows.map(r => {
      if (r.type.includes("phase")) {
        return [{ content: r.name, colSpan: 1, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, formatCurrency(r.total || 0)];
      }
      if (r.type === "grand_total") {
        return [{ content: r.name, colSpan: 1, styles: { fontStyle: 'bold', textColor: [255,255,255], fillColor: [16, 185, 129] } }, formatCurrency(r.total || 0)];
      }
      return [r.name, formatCurrency(r.total || 0)];
    });

    autoTable(doc, {
      startY: 40,
      head: [['Description', 'Total']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        1: { halign: 'right' }
      }
    });
  } else {
    // Detail export
    const rows = buildDetailData(hierarchy, values);
    
    const tableBody = rows.map(r => {
      if (r.type === "phase") return [{ content: r.name, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [220, 220, 220] } }];
      if (r.type === "department") return [{ content: r.name, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }];
      if (r.type === "category") return [{ content: r.name, colSpan: 5, styles: { fontStyle: 'italic', textColor: [80, 80, 80] } }];
      
      return [
        r.name,
        r.description || "-",
        r.quantity,
        formatCurrency(r.rate),
        formatCurrency(r.total)
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['Item', 'Description', 'Qty', 'Rate', 'Total']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      }
    });
  }
  
  doc.save(`${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${type}.pdf`);
};

export const exportBudgetToExcel = (hierarchy, values, projectName) => {
  const rows = buildDetailData(hierarchy, values);
  const excelData = rows.map(r => {
    if (r.type !== "item") {
      return { Item: r.name, Description: "", Qty: "", Rate: "", Total: "" };
    }
    return {
      Item: r.name,
      Description: r.description,
      Qty: r.quantity,
      Rate: r.rate,
      Total: r.total
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Budget Detail");
  
  XLSX.writeFile(workbook, `${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_detail.xlsx`);
};
