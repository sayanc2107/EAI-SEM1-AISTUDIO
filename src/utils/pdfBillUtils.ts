import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PharmacySale } from "../types/hospital";

function formatRs(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString("en-IN")}.00`;
}

/**
 * Generates and directly downloads a print-ready A4 Hospital Pharmacy Tax Invoice PDF
 * without relying on blocked iframe popups (window.open).
 */
export function exportPharmacyBillToPdf(sale: PharmacySale): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;

  // Top Header Band
  doc.setFillColor(11, 17, 32); // Obsidian clinical header
  doc.rect(0, 0, pageWidth, 34, "F");

  doc.setTextColor(248, 250, 252);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("MedCore AI Hospital", margin, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Central Pharmacy & Emergency Dispensing Unit  |  24x7 Clinical Care",
    margin,
    21
  );
  doc.text(
    "DL No: MH-MZ4-419820  |  GSTIN: 27AABCM4821K1Z9  |  Helpline: +91-22-4091-8800",
    margin,
    27
  );

  // Invoice Badge on Right
  doc.setFillColor(14, 165, 233);
  doc.roundedRect(pageWidth - margin - 46, 9, 46, 15, 2, 2, "F");
  doc.setTextColor(11, 17, 32);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PHARMACY BILL", pageWidth - margin - 23, 15.5, { align: "center" });
  doc.setFontSize(8);
  doc.text("PAID INVOICE", pageWidth - margin - 23, 21, { align: "center" });

  // Patient & Invoice Metadata Grid
  const metaY = 42;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, metaY, pageWidth - margin * 2, 30, 2, 2, "FD");

  // Left Column: Patient & Doctor
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PATIENT / CUSTOMER DETAILS", margin + 5, metaY + 7);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(sale.patientName || "Walk-In Customer", margin + 5, metaY + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Prescribing Doctor: ${sale.doctorName || "Walk-In"}`,
    margin + 5,
    metaY + 20.5
  );
  doc.text(
    `Prescription Ref: ${sale.prescriptionId || "Direct Counter Sale"}`,
    margin + 5,
    metaY + 26
  );

  // Right Column: Bill Info
  const rightColX = pageWidth / 2 + 6;
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("BILLING DETAILS", rightColX, metaY + 7);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Bill No: ${sale.billNumber}`, rightColX, metaY + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Date / Time: ${sale.soldAtLabel}`, rightColX, metaY + 20.5);
  doc.text(
    `Payment: ${sale.paymentMethod} (Paid)  |  Billed By: ${sale.pharmacistName}`,
    rightColX,
    metaY + 26
  );

  // Itemized Medicines Table
  const tableRows = sale.items.map((item, idx) => [
    String(idx + 1),
    item.itemName,
    item.dosage || "As directed",
    String(item.quantity),
    formatRs(item.unitPrice),
    formatRs(item.quantity * item.unitPrice),
  ]);

  autoTable(doc, {
    startY: metaY + 38,
    margin: { left: margin, right: margin },
    head: [["#", "Medicine / Item Description", "Dosage / Note", "Qty", "Rate", "Amount"]],
    body: tableRows,
    theme: "grid",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [248, 250, 252],
      fontStyle: "bold",
      fontSize: 9,
      halign: "left",
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 41, 59],
      cellPadding: 3.2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 66 },
      2: { cellWidth: 40 },
      3: { cellWidth: 14, halign: "right" },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 24, halign: "right", fontStyle: "bold" },
    },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? metaY + 90;

  // Totals Summary Box on Right
  const summaryWidth = 76;
  const summaryX = pageWidth - margin - summaryWidth;
  const summaryY = finalY + 8;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(summaryX, summaryY, summaryWidth, 28, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Subtotal (Incl. GST):", summaryX + 4, summaryY + 8);
  doc.text(formatRs(sale.totalAmount), summaryX + summaryWidth - 4, summaryY + 8, {
    align: "right",
  });

  doc.text("Total Units Dispensed:", summaryX + 4, summaryY + 14.5);
  const totalUnits = sale.items.reduce((sum, i) => sum + i.quantity, 0);
  doc.text(String(totalUnits), summaryX + summaryWidth - 4, summaryY + 14.5, {
    align: "right",
  });

  doc.setDrawColor(148, 163, 184);
  doc.line(summaryX + 4, summaryY + 18, summaryX + summaryWidth - 4, summaryY + 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("GRAND TOTAL:", summaryX + 4, summaryY + 24.5);
  doc.setTextColor(5, 150, 105);
  doc.text(
    formatRs(sale.totalAmount),
    summaryX + summaryWidth - 4,
    summaryY + 24.5,
    { align: "right" }
  );

  // Left Note & Pharmacist Signature Area
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text("Dispensing & Printing Notes:", margin, summaryY + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "• Please verify medicine names and dosage instructions before leaving the counter.",
    margin,
    summaryY + 13
  );
  doc.text(
    "• Medicines once dispensed against prescription cannot be returned after 48 hours.",
    margin,
    summaryY + 18.5
  );
  doc.text(
    "• For emergency dosing questions, contact MedCore Central Pharmacy Desk.",
    margin,
    summaryY + 24
  );

  // Signature Footer
  const footerY = Math.max(summaryY + 46, 262);
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Verified by: ${sale.pharmacistName}`, margin, footerY);
  doc.text(
    "Authorized Pharmacist Signature",
    pageWidth - margin,
    footerY,
    { align: "right" }
  );

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "MedCore AI Hospital Management System  —  Print-Ready Computer Generated Tax Invoice",
    pageWidth / 2,
    footerY + 10,
    { align: "center" }
  );

  const safeFile = sale.billNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`MedCore_Pharmacy_Bill_${safeFile}.pdf`);
}
