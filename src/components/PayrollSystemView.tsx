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
import type { StaffPayrollRecord, UserRole } from "../types/hospital";

export function PayrollSystemView() {
  const {
    payrollRecords,
    paySalary,
    payAllPendingSalaries,
    updatePayrollCompensation,
    userProfile,
    activeRole,
  } = useHospital();

  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "Paid" | "Pending" | "Processing">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Pay Slip Modal State
  const [activeSlipRecord, setActiveSlipRecord] = useState<StaffPayrollRecord | null>(null);

  // Edit Compensation Modal State
  const [editingRecord, setEditingRecord] = useState<StaffPayrollRecord | null>(null);
  const [editBase, setEditBase] = useState("");
  const [editAllowances, setEditAllowances] = useState("");
  const [editBonus, setEditBonus] = useState("");
  const [editOvertimePay, setEditOvertimePay] = useState("");
  const [editDeductions, setEditDeductions] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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

  function handleOpenEdit(rec: StaffPayrollRecord) {
    setEditingRecord(rec);
    setEditBase(String(rec.baseSalary));
    setEditAllowances(String(rec.allowances));
    setEditBonus(String(rec.bonus));
    setEditOvertimePay(String(rec.overtimePay));
    setEditDeductions(String(rec.deductions));
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
      });
      setEditingRecord(null);
    } finally {
      setSavingEdit(false);
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

          <div className="flex items-center gap-3 shrink-0">
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
                        <div className="text-slate-200 font-sans">{rec.bankName}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{rec.bankAccountNumber}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{rec.ifscOrSwift}</div>
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
                              onClick={() => paySalary(rec.id)}
                              className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                            >
                              Pay Salary
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(rec)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Edit Compensation & Deductions"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
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
            className="bg-[#111827] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 my-auto"
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
                className="p-1 rounded-lg text-slate-400 hover:text-white"
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
                  {activeSlipRecord.status}
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
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Pay Slip
              </button>

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
    </div>
  );
}
