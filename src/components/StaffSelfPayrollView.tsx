import React, { useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileText,
  Printer,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import type { StaffPayrollRecord } from "../types/hospital";
import { exportPayslipToPdf } from "../utils/pdfPayslipUtils";

function formatINR(val: number): string {
  return `₹${Math.round(val).toLocaleString("en-IN")}`;
}

export function StaffSelfPayrollView() {
  const { payrollRecords, userProfile, activeStaffId } = useHospital();
  const [selectedSlip, setSelectedSlip] = useState<StaffPayrollRecord | null>(null);

  const staffId = userProfile?.linkedStaffId || activeStaffId || "DOC-01";

  // Filter records belonging to THIS staff member
  const myPayrollList = useMemo(() => {
    return payrollRecords.filter((p) => p.staffId === staffId);
  }, [payrollRecords, staffId]);

  const latestRecord = myPayrollList[0] || payrollRecords[0];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-sky-400">
            Employee Self-Service Desk
          </div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mt-0.5">
            <Wallet className="w-5 h-5 text-sky-400" />
            My Salary, Allowances & Official Payslips
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Review disbursed compensation, monthly breakdown, and download verified electronic PDF payslips.
          </p>
        </div>

        {latestRecord && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportPayslipToPdf(latestRecord)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download Latest Slip ({latestRecord.monthYear})
            </button>
          </div>
        )}
      </div>

      {/* Salary Overview Cards */}
      {latestRecord && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
            <div className="text-xs text-slate-400">Monthly Net Salary</div>
            <div className="mt-1.5 text-2xl font-bold font-mono text-emerald-400">
              {formatINR(latestRecord.netSalary)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Base: {formatINR(latestRecord.baseSalary)}
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
            <div className="text-xs text-slate-400">Allowances & Overtime</div>
            <div className="mt-1.5 text-2xl font-bold font-mono text-sky-400">
              {formatINR(latestRecord.allowances + latestRecord.overtimePay)}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {latestRecord.overtimeHours > 0
                ? `${latestRecord.overtimeHours} hrs logged overtime`
                : "Standard clinical duty"}
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
            <div className="text-xs text-slate-400">Bonuses & Special Pay</div>
            <div className="mt-1.5 text-2xl font-bold font-mono text-amber-400">
              {formatINR(
                latestRecord.bonus +
                  (latestRecord.specialPayments?.reduce((s, p) => s + p.amount, 0) || 0)
              )}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              On-call & performance incentives
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
            <div className="text-xs text-slate-400">Registered Bank Account</div>
            <div className="mt-1.5 text-base font-semibold text-slate-100 truncate">
              {latestRecord.bankName}
            </div>
            <div className="mt-1 text-xs text-slate-400 font-mono">
              {latestRecord.bankAccountNumber} · {latestRecord.ifscOrSwift}
            </div>
          </div>
        </div>
      )}

      {/* Historical Monthly Payslips Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Recent Monthly Salary Transactions & Payslip History
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Verified salary credits directly processed by Hospital Finance & Accounts.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-[#0B1120] text-slate-400 font-medium">
                <th className="py-3 px-4">Pay Period</th>
                <th className="py-3 px-4">Designation</th>
                <th className="py-3 px-4">Base & Allowances</th>
                <th className="py-3 px-4">Deductions</th>
                <th className="py-3 px-4 font-bold text-slate-200">Net Take-Home</th>
                <th className="py-3 px-4">Disbursal Ref</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {myPayrollList.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-100">
                    {rec.monthYear}
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">
                    {rec.designation}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">
                    {formatINR(rec.baseSalary + rec.allowances + rec.bonus + rec.overtimePay)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-red-400">
                    -{formatINR(rec.deductions)}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-sm">
                    {formatINR(rec.netSalary)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">
                    {rec.transactionReference || "Pending Payout"}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        rec.status === "Paid"
                          ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/80"
                          : "bg-amber-950/60 text-amber-300 border border-amber-800/80"
                      }`}
                    >
                      {rec.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSlip(rec)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs cursor-pointer transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                      <button
                        type="button"
                        onClick={() => exportPayslipToPdf(rec)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payslip Modal View */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="payslip-printable-card bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  Salary Pay Slip — {selectedSlip.monthYear}
                </h3>
                <p className="text-xs text-slate-400">{selectedSlip.staffName} ({selectedSlip.designation})</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlip(null)}
                className="no-print text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs bg-[#0B1120] p-4 rounded-xl border border-slate-800">
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Basic Monthly Salary</span>
                <span className="font-mono text-slate-200">{formatINR(selectedSlip.baseSalary)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Clinical & Housing Allowances</span>
                <span className="font-mono text-slate-200">{formatINR(selectedSlip.allowances)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Performance & On-Call Bonuses</span>
                <span className="font-mono text-slate-200">{formatINR(selectedSlip.bonus)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Overtime Hours ({selectedSlip.overtimeHours} hrs)</span>
                <span className="font-mono text-slate-200">{formatINR(selectedSlip.overtimePay)}</span>
              </div>
              {selectedSlip.specialPayments && selectedSlip.specialPayments.length > 0 && (
                selectedSlip.specialPayments.map((sp) => (
                  <div key={sp.id} className="flex justify-between py-1 border-b border-slate-800/80 text-sky-400">
                    <span>Special: {sp.title || sp.remarks}</span>
                    <span className="font-mono">+{formatINR(sp.amount)}</span>
                  </div>
                ))
              )}
              <div className="flex justify-between py-1 border-b border-slate-800/80 text-red-400">
                <span>Tax & PF Deductions</span>
                <span className="font-mono">-{formatINR(selectedSlip.deductions)}</span>
              </div>
              <div className="flex justify-between pt-2 text-sm font-bold text-slate-100">
                <span>Net Salary Disbursed</span>
                <span className="text-emerald-400 font-mono text-base">{formatINR(selectedSlip.netSalary)}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono">{selectedSlip.bankName} · {selectedSlip.bankAccountNumber}</span>
              <div className="no-print flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportPayslipToPdf(selectedSlip);
                    setSelectedSlip(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
