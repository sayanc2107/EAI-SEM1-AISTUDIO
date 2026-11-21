import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { StaffPayrollRecord } from "../types/hospital";

function formatRs(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString("en-IN")}.00`;
}

/**
 * Generates and downloads an official A4 salary slip PDF for any staff member
 */
export function exportPayslipToPdf(record: StaffPayrollRecord): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;

  // Header banner
  doc.setFillColor(11, 17, 32);
  doc.rect(0, 0, pageWidth, 36, "F");

  doc.setTextColor(248, 250, 252);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("MedCore AI Hospital", margin, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Human Resources & Hospital Accounts Division  |  Official Salary Pay Slip",
    margin,
    22
  );
  doc.text(
    "Registration: MH-HOSP-2026/8912  |  Tax Deductor TAN: MUMM19820B",
    margin,
    29
  );

  // Month Badge on Right
  doc.setFillColor(14, 165, 233);
  doc.roundedRect(pageWidth - margin - 50, 9, 50, 16, 2, 2, "F");
  doc.setTextColor(11, 17, 32);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("SALARY SLIP", pageWidth - margin - 25, 15.5, { align: "center" });
  doc.setFontSize(8);
  doc.text(record.monthYear.toUpperCase(), pageWidth - margin - 25, 21.5, { align: "center" });

  // Employee Information Box
  const metaY = 44;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, metaY, pageWidth - margin * 2, 34, 2, 2, "FD");

  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("STAFF IDENTIFICATION", margin + 5, metaY + 7);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(record.staffName, margin + 5, metaY + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`${record.designation} (${record.role.toUpperCase()})`, margin + 5, metaY + 20);
  doc.text(`Department: ${record.department}  |  Staff ID: ${record.staffId}`, margin + 5, metaY + 26);

  // Bank & Payout info on right
  const rightColX = pageWidth / 2 + 5;
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PAYMENT & BANKING DETAILS", rightColX, metaY + 7);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(`${record.bankName}  (${record.bankAccountNumber})`, rightColX, metaY + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`IFSC: ${record.ifscOrSwift}  |  Status: ${record.status.toUpperCase()}`, rightColX, metaY + 20);
  doc.text(
    record.transactionReference
      ? `Txn Ref: ${record.transactionReference} (${record.paidAt || "Paid"})`
      : "Payment Mode: Direct Bank Credit / NEFT",
    rightColX,
    metaY + 26
  );

  // Earnings & Deductions Table
  const specialPaymentsTotal = record.specialPayments?.reduce((s, p) => s + p.amount, 0) || 0;
  const grossEarnings = record.baseSalary + record.allowances + record.bonus + record.overtimePay + specialPaymentsTotal;

  const tableData: Array<[string, string, string, string]> = [
    ["Basic Salary", formatRs(record.baseSalary), "Statutory Deductions (TDS/PF)", formatRs(record.deductions)],
    ["House Rent & Clinical Allowance", formatRs(record.allowances), "Professional Tax", "Rs. 200.00"],
    ["Performance & On-Call Bonus", formatRs(record.bonus), "Medical Insurance Contribution", "Rs. 800.00"],
    [
      record.overtimeHours > 0
        ? `Overtime Allowance (${record.overtimeHours} hrs)`
        : "Overtime Allowance",
      formatRs(record.overtimePay),
      "—",
      "—",
    ],
  ];

  if (record.specialPayments && record.specialPayments.length > 0) {
    record.specialPayments.forEach((sp) => {
      const desc = sp.title || sp.remarks || "Special Incentive";
      tableData.push([`Special: ${desc}`, formatRs(sp.amount), "—", "—"]);
    });
  }

  tableData.push([
    "TOTAL GROSS EARNINGS",
    formatRs(grossEarnings),
    "TOTAL DEDUCTIONS",
    formatRs(record.deductions + 1000),
  ]);

  autoTable(doc, {
    startY: metaY + 40,
    head: [["Earnings Description", "Amount", "Deductions Description", "Amount"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [248, 250, 252],
      fontSize: 9,
      fontStyle: "bold",
      halign: "left",
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3.5,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 35, halign: "right" },
      2: { cellWidth: 55 },
      3: { cellWidth: 35, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  // Net Pay Box
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 150;
  const netBoxY = finalY + 6;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.roundedRect(margin, netBoxY, pageWidth - margin * 2, 24, 2, 2, "FD");

  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("NET SALARY DISBURSED (TAKE-HOME)", margin + 6, netBoxY + 8);

  doc.setTextColor(2, 132, 199);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(formatRs(record.netSalary), margin + 6, netBoxY + 18);

  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `Disbursed by ${record.paidBy || "Hospital Accounts"} via Electronic Fund Transfer.`,
    pageWidth - margin - 6,
    netBoxY + 16,
    { align: "right" }
  );

  // Signatures & Legal Disclaimer
  const signY = netBoxY + 36;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, signY, margin + 50, signY);
  doc.line(pageWidth - margin - 50, signY, pageWidth - margin, signY);

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text("Employee Acknowledgment", margin, signY + 5);
  doc.text("Authorized Signatory (Finance Controller)", pageWidth - margin - 50, signY + 5);

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "This is a system-generated electronic salary slip approved by MedCore AI Hospital Finance Administration. No physical signature required.",
    pageWidth / 2,
    signY + 18,
    { align: "center" }
  );

  const cleanMonth = record.monthYear.replace(/\s+/g, "_");
  const cleanName = record.staffName.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`Payslip_${cleanName}_${cleanMonth}.pdf`);
}
