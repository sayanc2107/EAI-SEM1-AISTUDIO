import React, { useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  Edit2,
  FileCheck,
  FileText,
  Filter,
  Printer,
  Search,
  ShieldCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import { exportPayslipToPdf } from "../utils/pdfPayslipUtils";
import type { DisbursementRail, StaffPayrollRecord, UserRole } from "../types/hospital";

export function PayrollSystemView() {
  const {
    payrollRecords,
    specialPayments,
    paySalary,
    payAllPendingSalaries,
    updatePayrollCompensation,
    issueSpecialPayment,
    userProfile,
    activeRole,
  } = useHospital();

  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "Paid" | "Pending" | "Processing">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Pay Slip Modal State
  const [activeSlipRecord, setActiveSlipRecord] = useState<StaffPayrollRecord | null>(null);

  // Edit Compensation & Bank Account Setup Modal State
  const [editingRecord, setEditingRecord] = useState<StaffPayrollRecord | null>(null);
  const [editBase, setEditBase] = useState("");
  const [editAllowances, setEditAllowances] = useState("");
  const [editBonus, setEditBonus] = useState("");
  const [editOvertimePay, setEditOvertimePay] = useState("");
  const [editDeductions, setEditDeductions] = useState("");
  const [editBankName, setEditBankName] = useState("");
  const [editBankAccountNumber, setEditBankAccountNumber] = useState("");
  const [editIfsc, setEditIfsc] = useState("");
  const [editDesignation, setEditDesignation] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Final Disbursement Adjustment Modal State
  const [disbursingRecord, setDisbursingRecord] = useState<StaffPayrollRecord | null>(null);
  const [disburseBase, setDisburseBase] = useState("");
  const [disburseAllowances, setDisburseAllowances] = useState("");
  const [disburseBonus, setDisburseBonus] = useState("");
  const [disburseOvertime, setDisburseOvertime] = useState("");
  const [disburseDeductions, setDisburseDeductions] = useState("");
  const [disburseRail, setDisburseRail] = useState<DisbursementRail>("NEFT");
  const [disburseNotes, setDisburseNotes] = useState("");
  const [processingDisburse, setProcessingDisburse] = useState(false);

  // Special Hospital Payment / Purchases Modal State
  const [showSpecialModal, setShowSpecialModal] = useState(false);
  const [specialPayeeName, setSpecialPayeeName] = useState("");
  const [specialAccountNumber, setSpecialAccountNumber] = useState("");
  const [specialIfsc, setSpecialIfsc] = useState("");
  const [specialAmount, setSpecialAmount] = useState("");
  const [specialRemarks, setSpecialRemarks] = useState("");
  const [specialPaymentType, setSpecialPaymentType] = useState<DisbursementRail>("RTGS");
  const [specialTargetStaffId, setSpecialTargetStaffId] = useState<string>("none");
  const [savingSpecial, setSavingSpecial] = useState(false);

  const [processingBatch, setProcessingBatch] = useState(false);

  // Aggregate metrics
  const totalPayrollBudget = useMemo(
    () => payrollRecords.reduce((acc, r) => acc + r.netSalary, 0),
    [payrollRecords]
  );

  const totalPaid = useMemo(
    () =>
      payrollRecords
        .filter((r) => r.status === "Paid")
        .reduce((acc, r) => acc + r.netSalary, 0),
    [payrollRecords]
  );

  const totalPending = useMemo(
    () =>
      payrollRecords
        .filter((r) => r.status !== "Paid")
        .reduce((acc, r) => acc + r.netSalary, 0),
    [payrollRecords]
  );

  const pendingCount = payrollRecords.filter((r) => r.status !== "Paid").length;

  const filteredRecords = useMemo(() => {
    return payrollRecords.filter((rec) => {
      if (roleFilter !== "all" && rec.role !== roleFilter) return false;
      if (statusFilter !== "all" && rec.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          rec.staffName.toLowerCase().includes(q) ||
          rec.staffId.toLowerCase().includes(q) ||
          rec.department.toLowerCase().includes(q) ||
          rec.designation.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [payrollRecords, roleFilter, statusFilter, searchQuery]);

  async function handleBatchPay() {
    setProcessingBatch(true);
    try {
      await payAllPendingSalaries();
    } finally {
      setProcessingBatch(false);
    }
  }

  function handleOpenDisburse(rec: StaffPayrollRecord) {
    setDisbursingRecord(rec);
    setDisburseBase(String(rec.baseSalary));
    setDisburseAllowances(String(rec.allowances));
    setDisburseBonus(String(rec.bonus));
    setDisburseOvertime(String(rec.overtimePay));
    setDisburseDeductions(String(rec.deductions));
    setDisburseRail(rec.disbursementRail || "NEFT");
    setDisburseNotes(rec.notes || "");
  }

  async function handleConfirmDisburse(e: React.FormEvent) {
    e.preventDefault();
    if (!disbursingRecord) return;
    setProcessingDisburse(true);
    try {
      await paySalary(disbursingRecord.id, {
        baseSalary: Number(disburseBase) || 0,
        allowances: Number(disburseAllowances) || 0,
        bonus: Number(disburseBonus) || 0,
        overtimePay: Number(disburseOvertime) || 0,
        deductions: Number(disburseDeductions) || 0,
        rail: disburseRail,
        notes: disburseNotes.trim() || undefined,
      });
      setDisbursingRecord(null);
    } finally {
      setProcessingDisburse(false);
    }
  }

  function handleOpenEdit(rec: StaffPayrollRecord) {
    setEditingRecord(rec);
    setEditBase(String(rec.baseSalary));
    setEditAllowances(String(rec.allowances));
    setEditBonus(String(rec.bonus));
    setEditOvertimePay(String(rec.overtimePay));
    setEditDeductions(String(rec.deductions));
    setEditBankName(rec.bankName || "");
    setEditBankAccountNumber(rec.bankAccountNumber || "");
    setEditIfsc(rec.ifscOrSwift || "");
    setEditDesignation(rec.designation || "");
  }

  async function handleSaveCompensation(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRecord) return;
    setSavingEdit(true);
    try {
      await updatePayrollCompensation(editingRecord.id, {
        baseSalary: Number(editBase) || 0,
        allowances: Number(editAllowances) || 0,
        bonus: Number(editBonus) || 0,
        overtimePay: Number(editOvertimePay) || 0,
        deductions: Number(editDeductions) || 0,
        bankName: editBankName.trim() || "HDFC Bank",
        bankAccountNumber: editBankAccountNumber.trim() || "000000000000",
        ifscOrSwift: editIfsc.trim().toUpperCase() || "HDFC0000000",
        designation: editDesignation.trim() || editingRecord.designation,
      });
      setEditingRecord(null);
    } finally {
      setSavingEdit(false);
    }
  }

  function handleOpenSpecialModal(presetStaff?: StaffPayrollRecord) {
    if (presetStaff) {
      setSpecialPayeeName(presetStaff.staffName);
      setSpecialAccountNumber(presetStaff.bankAccountNumber);
      setSpecialIfsc(presetStaff.ifscOrSwift);
      setSpecialRemarks(`Duty Incentive / Bonus for ${presetStaff.staffName}`);
      setSpecialTargetStaffId(presetStaff.id);
      setSpecialPaymentType("IMPS");
    } else {
      setSpecialPayeeName("");
      setSpecialAccountNumber("");
      setSpecialIfsc("");
      setSpecialRemarks("");
      setSpecialTargetStaffId("none");
      setSpecialPaymentType("RTGS");
    }
    setSpecialAmount("");
    setShowSpecialModal(true);
  }

  async function handleExecuteSpecialPayment(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(specialAmount);
    if (!specialPayeeName.trim() || !specialAccountNumber.trim() || !specialIfsc.trim() || isNaN(amt) || amt <= 0) {
      return;
    }
    setSavingSpecial(true);
    try {
      const targetPayroll = specialTargetStaffId !== "none" ? specialTargetStaffId : undefined;
      await issueSpecialPayment(
        {
          payeeName: specialPayeeName.trim(),
          accountNumber: specialAccountNumber.trim(),
          ifsc: specialIfsc.trim().toUpperCase(),
          amount: amt,
          remarks: specialRemarks.trim() || "Hospital Special Expense / Purchase",
          paymentType: specialPaymentType,
        },
        targetPayroll
      );
      setShowSpecialModal(false);
      setSpecialPayeeName("");
      setSpecialAccountNumber("");
      setSpecialIfsc("");
      setSpecialAmount("");
      setSpecialRemarks("");
    } finally {
      setSavingSpecial(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold uppercase tracking-wider">
              <Banknote className="w-4 h-4" />
              Automated Hospital Payroll Desk
            </div>
            <h2 className="text-xl font-bold text-slate-100 mt-1">
              Doctor & Hospital Staff Payroll & Compensation
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Manage physician salaries, emergency duty allowances, nurse overtime, and disburse bank transfers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenSpecialModal()}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
            >
              <Coins className="w-4 h-4" />
              + Issue Special Payment / Purchase
            </button>
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={handleBatchPay}
                disabled={processingBatch}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                {processingBatch
                  ? "Processing Payouts..."
                  : `Disburse All ${pendingCount} Pending Salaries`}
              </button>
            )}
          </div>
        </div>

        {/* 4 Financial Aggregate Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
          <div className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium">Monthly Payroll Budget</div>
            <div className="text-xl font-mono font-bold text-slate-100 mt-1">
              ₹{totalPayrollBudget.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              November 2026 Cycle · {payrollRecords.length} Staff
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium">Disbursed / Paid</div>
            <div className="text-xl font-mono font-bold text-emerald-400 mt-1">
              ₹{totalPaid.toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-400/80 mt-0.5">
              {payrollRecords.filter((r) => r.status === "Paid").length} Settled
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium">Pending Disbursals</div>
            <div className="text-xl font-mono font-bold text-amber-400 mt-1">
              ₹{totalPending.toLocaleString()}
            </div>
            <div className="text-[10px] text-amber-400/80 mt-0.5">
              {pendingCount} Staff awaiting payment
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium">Doctor Salaries (6 MDs)</div>
            <div className="text-xl font-mono font-bold text-sky-400 mt-1">
              ₹
              {payrollRecords
                .filter((r) => r.role === "doctor")
                .reduce((acc, r) => acc + r.netSalary, 0)
                .toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Specialist & ER Consultants</div>
          </div>
        </div>
      </section>

      {/* Main Payroll Table Section */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              Staff Compensation Roster ({filteredRecords.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Itemized salary structure with allowances, overtime, TDS tax, and direct NEFT disbursement actions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search physician or staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-200 focus:border-sky-500 focus:outline-none w-52"
              />
            </div>

            {/* Role Filter Pills */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B1120] border border-slate-800">
              <button
                type="button"
                onClick={() => setRoleFilter("all")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  roleFilter === "all"
                    ? "bg-slate-800 text-white font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("doctor")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  roleFilter === "doctor"
                    ? "bg-sky-500 text-slate-950 font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Doctors
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("nurse")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  roleFilter === "nurse"
                    ? "bg-rose-500 text-white font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Nurses
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("ward_staff")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  roleFilter === "ward_staff"
                    ? "bg-amber-500 text-slate-950 font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Wards
              </button>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-300 focus:border-sky-500 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Processing">Processing</option>
              <option value="Paid">Paid</option>
            </select>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No payroll records match your selected search or filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-3 pr-3 font-medium">Employee Details</th>
                  <th className="py-3 px-2 font-medium">Bank Details</th>
                  <th className="py-3 px-2 font-medium text-right">Base Salary</th>
                  <th className="py-3 px-2 font-medium text-right">Allowances & Bonus</th>
                  <th className="py-3 px-2 font-medium text-right">Overtime</th>
                  <th className="py-3 px-2 font-medium text-right">Deductions (TDS/PF)</th>
                  <th className="py-3 px-2 font-medium text-right">Net Take-Home</th>
                  <th className="py-3 px-2 font-medium">Status</th>
                  <th className="py-3 pl-2 font-medium text-right">Payroll Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredRecords.map((rec) => {
                  const roleBadge =
                    rec.role === "doctor"
                      ? "text-sky-300 bg-sky-950/60"
                      : rec.role === "nurse"
                      ? "text-rose-300 bg-rose-950/60"
                      : rec.role === "accountant"
                      ? "text-emerald-300 bg-emerald-950/60"
                      : "text-amber-300 bg-amber-950/60";

                  return (
                    <tr key={rec.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 pr-3 font-sans">
                        <div className="font-bold text-slate-100">{rec.staffName}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">
                          {rec.designation}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${roleBadge}`}>
                            {rec.staffId} · {rec.role.replace("_", " ")}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-2">
                        <div className="text-slate-200 font-sans flex items-center gap-1.5 flex-wrap">
                          <span>{rec.bankName}</span>
                          {(rec.bankAccountNumber === "000000000000" || rec.bankName.includes("Pending")) && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800">
                              Setup Needed
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">{rec.bankAccountNumber}</div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">{rec.ifscOrSwift}</div>
                      </td>

                      <td className="py-3.5 px-2 text-right text-slate-300">
                        ₹{rec.baseSalary.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-2 text-right">
                        <div className="text-slate-200">+₹{(rec.allowances + rec.bonus).toLocaleString()}</div>
                        <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                          Bonus ₹{rec.bonus.toLocaleString()}
                        </div>
                      </td>

                      <td className="py-3.5 px-2 text-right">
                        <div className="text-slate-200">+₹{rec.overtimePay.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                          {rec.overtimeHours} hrs
                        </div>
                      </td>

                      <td className="py-3.5 px-2 text-right text-rose-400">
                        -₹{rec.deductions.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-2 text-right font-bold text-emerald-400 text-sm">
                        ₹{rec.netSalary.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-2 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold inline-block ${
                            rec.status === "Paid"
                              ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/80"
                              : rec.status === "Processing"
                              ? "bg-sky-950/60 text-sky-300 border border-sky-800/80"
                              : "bg-amber-950/60 text-amber-300 border border-amber-800/80"
                          }`}
                        >
                          {rec.status}
                        </span>
                        {rec.disbursementRail && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-sky-950 text-sky-300 border border-sky-800">
                            {rec.disbursementRail}
                          </span>
                        )}
                        {rec.transactionReference && (
                          <div className="text-[10px] font-mono text-slate-500 mt-1 truncate max-w-[120px]">
                            {rec.transactionReference}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 pl-2 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          {rec.status !== "Paid" && (
                            <button
                              type="button"
                              onClick={() => handleOpenDisburse(rec)}
                              className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                            >
                              Pay Salary
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenSpecialModal(rec)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                            title="Issue Special Payment / Incentive"
                          >
                            <Coins className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(rec)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Edit Compensation & Bank Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => exportPayslipToPdf(rec)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                            title="Download Official PDF Payslip"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveSlipRecord(rec)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                            title="View Official Salary Slip"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 1. Edit Compensation Modal */}
      {editingRecord && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
          onClick={() => setEditingRecord(null)}
        >
          <div
            className="bg-[#111827] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-sky-400" />
                  Edit Compensation: {editingRecord.staffName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingRecord.staffId} · {editingRecord.designation} ({editingRecord.department})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCompensation} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-800">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank, SBI"
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Bank Account Number
                  </label>
                  <input
                    type="text"
                    required
                    value={editBankAccountNumber}
                    onChange={(e) => setEditBankAccountNumber(e.target.value)}
                    placeholder="e.g. 5010045678912"
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    required
                    value={editIfsc}
                    onChange={(e) => setEditIfsc(e.target.value.toUpperCase())}
                    placeholder="e.g. HDFC0001234"
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono uppercase text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    required
                    value={editDesignation}
                    onChange={(e) => setEditDesignation(e.target.value)}
                    placeholder="e.g. Senior ER Consultant"
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Base Salary (INR)
                  </label>
                  <input
                    type="number"
                    required
                    value={editBase}
                    onChange={(e) => setEditBase(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Duty / OPD Allowance
                  </label>
                  <input
                    type="number"
                    required
                    value={editAllowances}
                    onChange={(e) => setEditAllowances(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Bonus</label>
                  <input
                    type="number"
                    required
                    value={editBonus}
                    onChange={(e) => setEditBonus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Overtime Pay
                  </label>
                  <input
                    type="number"
                    required
                    value={editOvertimePay}
                    onChange={(e) => setEditOvertimePay(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Deductions (TDS/PF)
                  </label>
                  <input
                    type="number"
                    required
                    value={editDeductions}
                    onChange={(e) => setEditDeductions(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Recalculated Preview */}
              <div className="p-3 rounded-lg bg-[#0B1120] border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Recalculated Net Take-Home:</span>
                <span className="text-base font-mono font-bold text-emerald-400">
                  ₹
                  {Math.max(
                    0,
                    (Number(editBase) || 0) +
                      (Number(editAllowances) || 0) +
                      (Number(editBonus) || 0) +
                      (Number(editOvertimePay) || 0) -
                      (Number(editDeductions) || 0)
                  ).toLocaleString()}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                >
                  {savingEdit ? "Updating..." : "Save Compensation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Official Printable Pay Slip Modal */}
      {activeSlipRecord && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setActiveSlipRecord(null)}
        >
          <div
            className="payslip-printable-card bg-[#111827] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Slip Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold tracking-wider text-sky-400 uppercase font-mono">
                    MedCore AI Hospital
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-xs text-slate-400">Monthly Compensation Voucher</span>
                </div>
                <h3 className="text-xl font-bold text-slate-100 mt-1">Official Salary Pay Slip</h3>
                <p className="text-xs text-slate-400 mt-0.5">Pay Period: {activeSlipRecord.monthYear}</p>
              </div>

              <button
                type="button"
                onClick={() => setActiveSlipRecord(null)}
                className="no-print p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Employee Information Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#0B1120] border border-slate-800/90 text-xs">
              <div>
                <span className="text-slate-500 block">Employee Name</span>
                <span className="font-semibold text-slate-100 mt-0.5 block">{activeSlipRecord.staffName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Staff ID</span>
                <span className="font-mono text-slate-200 mt-0.5 block">{activeSlipRecord.staffId}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Department</span>
                <span className="text-slate-200 mt-0.5 block">{activeSlipRecord.department}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Designation</span>
                <span className="text-slate-200 mt-0.5 block">{activeSlipRecord.designation}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Bank Name</span>
                <span className="text-slate-200 mt-0.5 block">{activeSlipRecord.bankName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Account No.</span>
                <span className="font-mono text-slate-200 mt-0.5 block">{activeSlipRecord.bankAccountNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block">IFSC Code</span>
                <span className="font-mono text-slate-200 mt-0.5 block">{activeSlipRecord.ifscOrSwift}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Payment Status</span>
                <span className={`font-semibold mt-0.5 block ${
                  activeSlipRecord.status === "Paid" ? "text-emerald-400" : "text-amber-400"
                }`}>
                  {activeSlipRecord.status} {activeSlipRecord.disbursementRail ? `(${activeSlipRecord.disbursementRail})` : ""}
                </span>
              </div>
            </div>

            {/* Earnings & Deductions Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Earnings Column */}
              <div className="p-4 rounded-xl bg-[#0B1120] border border-slate-800 space-y-2.5">
                <div className="text-xs font-semibold text-emerald-400 pb-2 border-b border-slate-800/80">
                  Itemized Earnings (INR)
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Basic Pay</span>
                  <span className="font-mono font-medium">₹{activeSlipRecord.baseSalary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Duty & Specialty Allowance</span>
                  <span className="font-mono font-medium">₹{activeSlipRecord.allowances.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Performance Incentive / Bonus</span>
                  <span className="font-mono font-medium">₹{activeSlipRecord.bonus.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Overtime Pay ({activeSlipRecord.overtimeHours}h)</span>
                  <span className="font-mono font-medium">₹{activeSlipRecord.overtimePay.toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t border-slate-800/80 flex justify-between text-xs font-bold text-slate-100">
                  <span>Gross Earnings</span>
                  <span className="font-mono text-emerald-400">
                    ₹{(activeSlipRecord.baseSalary + activeSlipRecord.allowances + activeSlipRecord.bonus + activeSlipRecord.overtimePay).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Deductions Column */}
              <div className="p-4 rounded-xl bg-[#0B1120] border border-slate-800 space-y-2.5">
                <div className="text-xs font-semibold text-rose-400 pb-2 border-b border-slate-800/80">
                  Statutory Deductions (INR)
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Tax Deduction at Source (TDS)</span>
                  <span className="font-mono font-medium">
                    ₹{Math.round(activeSlipRecord.deductions * 0.75).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Provident Fund (PF) Contribution</span>
                  <span className="font-mono font-medium">
                    ₹{Math.round(activeSlipRecord.deductions * 0.25).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-400 pt-4">
                  <span>Total Deductions</span>
                  <span className="font-mono text-rose-400">₹{activeSlipRecord.deductions.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Net Take-Home Salary Banner */}
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Net Disbursed Take-Home Pay
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Direct deposit via RBI NEFT / RTGS settlement system
                </p>
              </div>
              <div className="text-2xl font-mono font-extrabold text-emerald-300">
                ₹{activeSlipRecord.netSalary.toLocaleString()}
              </div>
            </div>

            {/* Transaction Ref & Auth Stamp */}
            {activeSlipRecord.transactionReference && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 px-1 font-mono">
                <div>
                  Bank UTR Ref: <strong className="text-slate-200">{activeSlipRecord.transactionReference}</strong>
                </div>
                <div>
                  Settled: {activeSlipRecord.paidAt} by {activeSlipRecord.paidBy}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="no-print pt-3 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportPayslipToPdf(activeSlipRecord)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF Payslip
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
              </div>

              <button
                type="button"
                onClick={() => setActiveSlipRecord(null)}
                className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Settle & Disburse Salary Modal (Adjust breakdown & Rail selection) */}
      {disbursingRecord && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setDisbursingRecord(null)}
        >
          <div
            className="bg-[#111827] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-400" />
                  Disburse Monthly Salary: {disbursingRecord.staffName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {disbursingRecord.staffId} · {disbursingRecord.designation} ({disbursingRecord.department})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDisbursingRecord(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDisburse} className="space-y-4">
              <div className="p-3 rounded-lg bg-[#0B1120] border border-slate-800 text-xs space-y-1">
                <div className="text-slate-400">
                  Beneficiary Bank: <strong className="text-slate-200">{disbursingRecord.bankName}</strong>
                </div>
                <div className="text-slate-400 font-mono">
                  Account: <strong className="text-slate-200">{disbursingRecord.bankAccountNumber}</strong> · IFSC: <strong className="text-slate-200">{disbursingRecord.ifscOrSwift}</strong>
                </div>
              </div>

              {/* Editable Breakdown prior to disbursement */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Base Salary (INR)
                  </label>
                  <input
                    type="number"
                    required
                    value={disburseBase}
                    onChange={(e) => setDisburseBase(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Duty / Special Allowance
                  </label>
                  <input
                    type="number"
                    required
                    value={disburseAllowances}
                    onChange={(e) => setDisburseAllowances(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Bonus</label>
                  <input
                    type="number"
                    required
                    value={disburseBonus}
                    onChange={(e) => setDisburseBonus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Overtime Pay</label>
                  <input
                    type="number"
                    required
                    value={disburseOvertime}
                    onChange={(e) => setDisburseOvertime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Deductions</label>
                  <input
                    type="number"
                    required
                    value={disburseDeductions}
                    onChange={(e) => setDisburseDeductions(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Settlement Rail Selection: IMPS / NEFT / RTGS */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Select Settlement Rail
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["IMPS", "NEFT", "RTGS"] as DisbursementRail[]).map((rail) => (
                    <button
                      key={rail}
                      type="button"
                      onClick={() => setDisburseRail(rail)}
                      className={`p-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        disburseRail === rail
                          ? "bg-sky-500 text-slate-950 border-sky-400"
                          : "bg-[#0B1120] text-slate-300 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {rail}
                      <span className="block text-[10px] font-normal opacity-80">
                        {rail === "IMPS" ? "Instant (24x7)" : rail === "NEFT" ? "RBI Batch" : "Real-Time Gross"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Disbursement Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={disburseNotes}
                  onChange={(e) => setDisburseNotes(e.target.value)}
                  placeholder="e.g. Approved November Regular Payroll Disbursement"
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>

              {/* Net Payout Banner */}
              <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs text-emerald-300 font-semibold">Net Disbursed Take-Home:</span>
                  <div className="text-[10px] text-slate-400 mt-0.5">Direct deposit via {disburseRail}</div>
                </div>
                <span className="text-xl font-mono font-extrabold text-emerald-300">
                  ₹{Math.max(
                    0,
                    (Number(disburseBase) || 0) +
                      (Number(disburseAllowances) || 0) +
                      (Number(disburseBonus) || 0) +
                      (Number(disburseOvertime) || 0) -
                      (Number(disburseDeductions) || 0)
                  ).toLocaleString()}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDisbursingRecord(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingDisburse}
                  className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                >
                  {processingDisburse ? "Disbursing..." : `Authorize & Disburse (${disburseRail})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Issue Special Payment / Hospital Purchases Modal */}
      {showSpecialModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowSpecialModal(false)}
        >
          <div
            className="bg-[#111827] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  Special Hospital Payment / Vendor Purchase
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Record vendor purchases, oxygen cylinder refills, medical repairs, and duty bonuses.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSpecialModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteSpecialPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payee / Vendor / Recipient Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Medical Gases & Cylinders / Dr. Vikram Shah"
                  value={specialPayeeName}
                  onChange={(e) => setSpecialPayeeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Bank Account Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 918273645120"
                    value={specialAccountNumber}
                    onChange={(e) => setSpecialAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SBIN0001234"
                    value={specialIfsc}
                    onChange={(e) => setSpecialIfsc(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono uppercase text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Amount (INR ₹)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 45000"
                    value={specialAmount}
                    onChange={(e) => setSpecialAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Payment Type
                  </label>
                  <select
                    value={specialPaymentType}
                    onChange={(e) => setSpecialPaymentType(e.target.value as DisbursementRail)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="IMPS">IMPS (Immediate Payment)</option>
                    <option value="NEFT">NEFT (National Electronic Fund Transfer)</option>
                    <option value="RTGS">RTGS (Real Time Gross Settlement)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Remarks & Purpose (Purchases / Expenses)
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Bulk liquid oxygen refills for ICU manifolds / Surgical drape sets"
                  value={specialRemarks}
                  onChange={(e) => setSpecialRemarks(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-400">
                Authorized By:{" "}
                <strong className="text-slate-200">
                  {userProfile?.displayName || (activeRole === "accountant" ? "Vikram Mehta (CPA)" : "Hospital Administrator")}
                </strong>{" "}
                · Settlement Rail: <strong className="text-amber-400">{specialPaymentType}</strong>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSpecialModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSpecial}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                >
                  {savingSpecial ? "Disbursing..." : `Authorize & Transfer via ${specialPaymentType}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Special Hospital Purchases & Vendor Payouts Register */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              Special Hospital Purchases & Vendor Disbursements ({specialPayments.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Purchases for liquid oxygen refills, bio-medical equipment servicing, surgical consumables & special incentives.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleOpenSpecialModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Coins className="w-3.5 h-3.5" />
            + New Special Payment / Purchase
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 pr-3 font-medium">Date & UTR Ref</th>
                <th className="py-2.5 px-3 font-medium">Payee / Vendor</th>
                <th className="py-2.5 px-3 font-medium">Account & IFSC</th>
                <th className="py-2.5 px-3 font-medium">Remarks / Purpose</th>
                <th className="py-2.5 px-3 font-medium">Rail</th>
                <th className="py-2.5 px-3 font-medium">Approved By</th>
                <th className="py-2.5 pl-3 font-medium text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {specialPayments.map((sp) => (
                <tr key={sp.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 pr-3">
                    <div className="text-slate-200">{sp.date}</div>
                    <div className="text-[10px] text-slate-500">{sp.transactionReference || sp.id}</div>
                  </td>
                  <td className="py-3 px-3 font-sans">
                    <span className="font-semibold text-slate-100">{sp.payeeName}</span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-slate-300">{sp.accountNumber}</div>
                    <div className="text-[10px] text-slate-500">{sp.ifsc}</div>
                  </td>
                  <td className="py-3 px-3 font-sans max-w-xs truncate text-slate-300" title={sp.remarks}>
                    {sp.remarks}
                  </td>
                  <td className="py-3 px-3 font-sans">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-800">
                      {sp.paymentType}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-sans text-slate-400">
                    {sp.approvedBy}
                  </td>
                  <td className="py-3 pl-3 text-right font-bold text-amber-400 font-mono">
                    ₹{sp.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
