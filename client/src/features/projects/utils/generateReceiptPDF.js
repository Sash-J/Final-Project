import { jsPDF } from "jspdf";
import { VDV_LOGO_BASE64, VDV_LOGO_WHITE_BASE64 } from "../../../assets/svg images/vdv_logo_base64";

function interpolateColor(color1, color2, factor) {
  return [
    Math.round(color1[0] + factor * (color2[0] - color1[0])),
    Math.round(color1[1] + factor * (color2[1] - color1[1])),
    Math.round(color1[2] + factor * (color2[2] - color1[2])),
  ];
}

function getGradientColor(yRatio) {
  // Vision Division Cover Gradient:
  // 0% -> #004583 [0, 69, 131]
  // 22% -> #06205b [6, 32, 91]
  // 48% -> #041542 [4, 21, 66]
  // 75% -> #02092d [2, 9, 45]
  // 100% -> #010422 [1, 4, 34]
  const stops = [
    { pos: 0.0, color: [0, 69, 131] },
    { pos: 0.22, color: [6, 32, 91] },
    { pos: 0.48, color: [4, 21, 66] },
    { pos: 0.75, color: [2, 9, 45] },
    { pos: 1.0, color: [1, 4, 34] },
  ];

  if (yRatio <= 0) return stops[0].color;
  if (yRatio >= 1) return stops[stops.length - 1].color;

  for (let i = 0; i < stops.length - 1; i++) {
    if (yRatio >= stops[i].pos && yRatio <= stops[i + 1].pos) {
      const factor = (yRatio - stops[i].pos) / (stops[i + 1].pos - stops[i].pos);
      return interpolateColor(stops[i].color, stops[i + 1].color, factor);
    }
  }
  return stops[stops.length - 1].color;
}

/**
 * Generates an official, high-resolution vector PDF receipt in A5 format (148 x 210 mm).
 * All text, borders, cards, divider lines, and metrics are rendered as true scalable vector objects.
 */
export const downloadReceiptVectorPDF = ({
  payment,
  projectData = {},
  projectCode = "",
  receiptNumber = "REC-0001",
  formattedAmount = "Rs 0.00",
  formattedPaymentDate = "",
  description = "Project Payment",
  bankRef = "",
  paymentMethod = "Bank Transfer",
  notes = "",
  totalBudgetFormatted = "Rs 0.00",
  totalPaidFormatted = "Rs 0.00",
  balanceFormatted = "Rs 0.00",
  paidPct = 0,
  signatoryName = "",
  signatoryRole = "",
  isDarkMode = false,
}) => {
  const doc = new jsPDF({
    unit: "mm",
    format: "a5",
    orientation: "portrait",
    compress: true,
  });

  const pageWidth = 148;
  const pageHeight = 210;
  const marginX = 10;
  const contentWidth = pageWidth - marginX * 2; // 128 mm

  // Theme palettes
  const theme = isDarkMode
    ? {
        cardBg: [4, 18, 52],
        cardBorder: [30, 68, 135],
        textPrimary: [255, 255, 255],
        textSecondary: [186, 206, 235],
        textMuted: [120, 150, 195],
        accent: [56, 189, 248],      // sky-400
        amountBg: [4, 36, 34],
        amountBorder: [52, 211, 153], // emerald-400
        amountText: [52, 211, 153],
        tableHeadBg: [8, 28, 70],
        tableHeadText: [186, 206, 235],
        pillBg: [6, 45, 35],
        pillBorder: [52, 211, 153],
        pillText: [52, 211, 153],
        pillDot: [52, 211, 153],
        progressTrack: [20, 45, 95],
        progressFill: [0, 198, 230],
        lineColor: [40, 75, 140],
      }
    : {
        cardBg: [248, 250, 252],       // slate-50
        cardBorder: [226, 232, 240],   // slate-200
        textPrimary: [15, 23, 42],     // slate-900
        textSecondary: [71, 85, 105],  // slate-600
        textMuted: [100, 116, 139],    // slate-500
        accent: [9, 105, 218],        // #0969da
        amountBg: [230, 249, 240],    // soft mint
        amountBorder: [134, 239, 172], // emerald-300
        amountText: [5, 150, 105],     // emerald-600
        tableHeadBg: [241, 245, 249],
        tableHeadText: [71, 85, 105],
        pillBg: [220, 252, 231],
        pillBorder: [187, 247, 208],
        pillText: [21, 128, 61],
        pillDot: [22, 163, 74],
        progressTrack: [226, 232, 240],
        progressFill: [9, 105, 218],   // #0969da
        lineColor: [226, 232, 240],
      };

  // 1. Vector Page Background
  if (isDarkMode) {
    // Exact Vision Division Cover Gradient rendered as native vector slices
    const sliceHeight = 1.5;
    for (let y = 0; y < pageHeight; y += sliceHeight) {
      const c = getGradientColor(y / pageHeight);
      doc.setFillColor(c[0], c[1], c[2]);
      doc.rect(0, y, pageWidth, sliceHeight + 0.2, "F");
    }
  } else {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
  }

  // 2. Header Section
  const curHeaderY = 12;
  const logoImg = isDarkMode ? VDV_LOGO_WHITE_BASE64 : VDV_LOGO_BASE64;
  if (logoImg) {
    try {
      doc.addImage(logoImg, "PNG", marginX, curHeaderY, 11, 11);
    } catch {
      // Graceful fallback if image load fails
    }
  }

  // Brand Name & Subtitle
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(theme.textPrimary[0], theme.textPrimary[1], theme.textPrimary[2]);
  doc.text("Vision Division", marginX + 13.5, curHeaderY + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
  doc.text("Film & Commercial Production House", marginX + 13.5, curHeaderY + 9.5);

  // Document Title & Number (Right Aligned)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(theme.textPrimary[0], theme.textPrimary[1], theme.textPrimary[2]);
  doc.text("PAYMENT RECEIPT", pageWidth - marginX, curHeaderY + 4, { align: "right" });

  doc.setFontSize(8.5);
  doc.setTextColor(theme.accent[0], theme.accent[1], theme.accent[2]);
  doc.text(receiptNumber, pageWidth - marginX, curHeaderY + 8, { align: "right" });

  // Status Pill: "• CONFIRMED & CLEARED"
  const pillW = 38;
  const pillH = 5;
  const pillX = pageWidth - marginX - pillW;
  const pillY = curHeaderY + 10;
  doc.setFillColor(theme.pillBg[0], theme.pillBg[1], theme.pillBg[2]);
  doc.setDrawColor(theme.pillBorder[0], theme.pillBorder[1], theme.pillBorder[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(pillX, pillY, pillW, pillH, 2.5, 2.5, "FD");

  // Pill Dot
  doc.setFillColor(theme.pillDot[0], theme.pillDot[1], theme.pillDot[2]);
  doc.circle(pillX + 3.5, pillY + 2.5, 0.9, "F");

  // Pill Text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(theme.pillText[0], theme.pillText[1], theme.pillText[2]);
  doc.text("CONFIRMED & CLEARED", pillX + 6, pillY + 3.6);

  // Header Divider Line
  doc.setDrawColor(theme.lineColor[0], theme.lineColor[1], theme.lineColor[2]);
  doc.setLineWidth(0.25);
  doc.line(marginX, 31, pageWidth - marginX, 31);

  // 3. Entity Details (Two Vector Cards)
  const entityCardY = 35;
  const colW = (contentWidth - 4) / 2; // 62 mm each
  const entityCardH = 21;

  // Left Card: Received From (Client)
  doc.setFillColor(theme.cardBg[0], theme.cardBg[1], theme.cardBg[2]);
  doc.setDrawColor(theme.cardBorder[0], theme.cardBorder[1], theme.cardBorder[2]);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, entityCardY, colW, entityCardH, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
  doc.text("RECEIVED FROM (CLIENT)", marginX + 3.5, entityCardY + 5.5);

  doc.setFontSize(9);
  doc.setTextColor(theme.textPrimary[0], theme.textPrimary[1], theme.textPrimary[2]);
  const clientName = projectData?.client_usernames || "Project Client Account";
  doc.text(clientName, marginX + 3.5, entityCardY + 11.5, { maxWidth: colW - 7 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(theme.textSecondary[0], theme.textSecondary[1], theme.textSecondary[2]);
  doc.text("Project Client Account", marginX + 3.5, entityCardY + 17);

  // Right Card: Project Particulars
  const rightCardX = marginX + colW + 4;
  doc.setFillColor(theme.cardBg[0], theme.cardBg[1], theme.cardBg[2]);
  doc.setDrawColor(theme.cardBorder[0], theme.cardBorder[1], theme.cardBorder[2]);
  doc.roundedRect(rightCardX, entityCardY, colW, entityCardH, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
  doc.text("PROJECT PARTICULARS", rightCardX + 3.5, entityCardY + 5.5);

  doc.setFontSize(9);
  doc.setTextColor(theme.textPrimary[0], theme.textPrimary[1], theme.textPrimary[2]);
  const projName = projectData?.project_name || "Production Project";
  doc.text(projName, rightCardX + 3.5, entityCardY + 11.5, { maxWidth: colW - 7 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(theme.textSecondary[0], theme.textSecondary[1], theme.textSecondary[2]);
  doc.text(`Project Code: ${projectCode || "N/A"}`, rightCardX + 3.5, entityCardY + 17);

  // 4. Amount Callout Card
  const amountCardY = 60;
  const amountCardH = 18;
  doc.setFillColor(theme.amountBg[0], theme.amountBg[1], theme.amountBg[2]);
  doc.setDrawColor(theme.amountBorder[0], theme.amountBorder[1], theme.amountBorder[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, amountCardY, contentWidth, amountCardH, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(theme.amountText[0], theme.amountText[1], theme.amountText[2]);
  doc.text("AMOUNT CREDITED", marginX + 4.5, amountCardY + 6.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(theme.textSecondary[0], theme.textSecondary[1], theme.textSecondary[2]);
  let methodText = `via ${paymentMethod || "Bank Transfer"}`;
  if (bankRef) methodText += ` (Ref: ${bankRef})`;
  doc.text(methodText, marginX + 4.5, amountCardY + 12.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(theme.amountText[0], theme.amountText[1], theme.amountText[2]);
  doc.text(formattedAmount, pageWidth - marginX - 4.5, amountCardY + 11.5, { align: "right" });

  // 5. Transaction Particulars Section
  const tableSectionY = 82;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
  doc.text("TRANSACTION PARTICULARS", marginX, tableSectionY + 4);

  // Table Container Box
  const tableBoxY = tableSectionY + 7;
  const tableBoxH = 26;
  doc.setFillColor(theme.cardBg[0], theme.cardBg[1], theme.cardBg[2]);
  doc.setDrawColor(theme.cardBorder[0], theme.cardBorder[1], theme.cardBorder[2]);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, tableBoxY, contentWidth, tableBoxH, 2.5, 2.5, "FD");

  // Table Header Row
  const headH = 7;
  doc.setFillColor(theme.tableHeadBg[0], theme.tableHeadBg[1], theme.tableHeadBg[2]);
  doc.rect(marginX + 0.25, tableBoxY + 0.25, contentWidth - 0.5, headH, "F");
  doc.setDrawColor(theme.lineColor[0], theme.lineColor[1], theme.lineColor[2]);
  doc.line(marginX, tableBoxY + headH, marginX + contentWidth, tableBoxY + headH);

  // Table Head Column Labels
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(theme.tableHeadText[0], theme.tableHeadText[1], theme.tableHeadText[2]);
  doc.text("DESCRIPTION", marginX + 3.5, tableBoxY + 4.8);
  doc.text("PAYMENT METHOD", marginX + 50, tableBoxY + 4.8);
  doc.text("PAYMENT DATE", marginX + 80, tableBoxY + 4.8);
  doc.text("CREDITED AMOUNT", pageWidth - marginX - 3.5, tableBoxY + 4.8, { align: "right" });

  // Table Data Row
  const dataRowY = tableBoxY + headH + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(theme.textPrimary[0], theme.textPrimary[1], theme.textPrimary[2]);
  doc.text(description || "Project Payment", marginX + 3.5, dataRowY, { maxWidth: 44 });

  if (bankRef) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
    doc.text(`Ref: ${bankRef}`, marginX + 3.5, dataRowY + 4.5);
  } else if (notes && notes !== description) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
    doc.text(notes, marginX + 3.5, dataRowY + 4.5, { maxWidth: 44 });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(theme.textSecondary[0], theme.textSecondary[1], theme.textSecondary[2]);
  doc.text(paymentMethod || "Bank Transfer", marginX + 50, dataRowY);
  doc.text(formattedPaymentDate || "N/A", marginX + 80, dataRowY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(theme.textPrimary[0], theme.textPrimary[1], theme.textPrimary[2]);
  doc.text(formattedAmount, pageWidth - marginX - 3.5, dataRowY, { align: "right" });

  // 6. Cumulative Project Ledger Context
  const ledgerY = 120;
  const ledgerH = 32;
  doc.setFillColor(theme.cardBg[0], theme.cardBg[1], theme.cardBg[2]);
  doc.setDrawColor(theme.cardBorder[0], theme.cardBorder[1], theme.cardBorder[2]);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, ledgerY, contentWidth, ledgerH, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
  doc.text("PROJECT LEDGER CONTEXT", marginX + 3.5, ledgerY + 5.5);

  // 3 Ledger Stat Columns
  const stat1X = marginX + 3.5;
  const stat2X = marginX + 46;
  const stat3X = marginX + 88;
  const statLabelY = ledgerY + 11.5;
  const statValY = ledgerY + 17;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
  doc.text("AGREED BUDGET", stat1X, statLabelY);
  doc.text("TOTAL PAID TO DATE", stat2X, statLabelY);
  doc.text("REMAINING BALANCE", stat3X, statLabelY);

  // Values
  doc.setFontSize(8.5);
  doc.setTextColor(theme.textPrimary[0], theme.textPrimary[1], theme.textPrimary[2]);
  doc.text(totalBudgetFormatted, stat1X, statValY);

  doc.setTextColor(theme.amountText[0], theme.amountText[1], theme.amountText[2]);
  doc.text(`${totalPaidFormatted} (${paidPct}%)`, stat2X, statValY);

  doc.setTextColor(theme.accent[0], theme.accent[1], theme.accent[2]);
  doc.text(balanceFormatted, stat3X, statValY);

  // Progress Bar Track & Fill
  const barY = ledgerY + 23;
  const barW = contentWidth - 7;
  const barH = 2.4;
  doc.setFillColor(theme.progressTrack[0], theme.progressTrack[1], theme.progressTrack[2]);
  doc.roundedRect(stat1X, barY, barW, barH, 1.2, 1.2, "F");

  const fillPct = Math.min(Math.max(paidPct || 0, 2), 100);
  const fillW = (barW * fillPct) / 100;
  doc.setFillColor(theme.progressFill[0], theme.progressFill[1], theme.progressFill[2]);
  doc.roundedRect(stat1X, barY, fillW, barH, 1.2, 1.2, "F");

  // 7. Legal Disclaimer & Authorized Signatory Block
  const footerY = 162;
  // Dotted divider line
  doc.setDrawColor(theme.lineColor[0], theme.lineColor[1], theme.lineColor[2]);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(marginX, footerY, pageWidth - marginX, footerY);
  doc.setLineDashPattern([], 0); // reset dash pattern

  // Left Disclaimer Note
  const discY = footerY + 7;
  const discW = 72;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
  const disclaimer = `This computer-generated document confirms receipt of the stated funds credited to the project ledger. Stored digitally with tamper-evident record ID #${payment?.id || "1"}.`;
  doc.text(disclaimer, marginX, discY, { maxWidth: discW, lineHeightFactor: 1.4 });

  // Right Signatory Block
  const signBlockRight = pageWidth - marginX;
  const signBlockW = 44;
  const signBlockX = signBlockRight - signBlockW;

  // Signatory Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(theme.textPrimary[0], theme.textPrimary[1], theme.textPrimary[2]);
  doc.text(signatoryName || "Authorized Executive", signBlockRight, footerY + 11, { align: "right" });

  // Signature line
  doc.setDrawColor(theme.lineColor[0], theme.lineColor[1], theme.lineColor[2]);
  doc.setLineWidth(0.35);
  doc.line(signBlockX, footerY + 13.5, signBlockRight, footerY + 13.5);

  // "AUTHORIZED SIGNATORY"
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(theme.textMuted[0], theme.textMuted[1], theme.textMuted[2]);
  doc.text("AUTHORIZED SIGNATORY", signBlockRight, footerY + 17.5, { align: "right" });

  // Role / Designation
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(theme.accent[0], theme.accent[1], theme.accent[2]);
  const roleText = signatoryRole
    ? `${signatoryRole}, Vision Division`
    : "Vision Division Management";
  doc.text(roleText, signBlockRight, footerY + 21, { align: "right" });

  // Download PDF file
  const filename = `${projectCode || "PRJ"}_Receipt_${receiptNumber}_${isDarkMode ? "Dark" : "Light"}.pdf`;
  doc.save(filename);
};

