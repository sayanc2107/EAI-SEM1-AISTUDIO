import React, { useMemo, useState } from "react";
import {
  Banknote,
  Building2,
  Calendar,
  CreditCard,
  Download,
  Filter,
  Plus,
  Receipt,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useHospital } from "../context/HospitalContext";
import type { FinancialDepartment, HospitalSale, PaymentMethod } from "../types/hospital";

const DEPARTMENT_COLORS: Record<FinancialDepartment, string> = {
  Pharmacy: "#38bdf8",
  OPD: "#818cf8",
  ICU: "#f43f5e",
  Emergency: "#fb923c",
  Surgery: "#ec4899",
  Laboratory: "#10b981",
  Radiology: "#a855f7",
};

const PAYMENT_METHOD_COLORS: Record<PaymentMethod, string> = {
  Insurance: "#38bdf8",
  UPI: "#10b981",
  Card: "#818cf8",
  Cash: "#f59e0b",
};

const DEPARTMENTS: FinancialDepartment[] = [
  "Pharmacy",
  "OPD",
  "ICU",
  "Emergency",
  "Surgery",
  "Laboratory",
  "Radiology",
];

export function HospitalFinancialsView() {
  const { hospitalSales, addHospitalSale, userProfile } = useHospital();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<"All" | FinancialDepartment>("All");
  const [selectedMethod, setSelectedMethod] = useState<"All" | PaymentMethod>("All");
  const [showAddModal, setShowAddModal] = useState(false);

  // New Sale Form State
  const [newDept, setNewDept] = useState<FinancialDepartment>("OPD");
  const [patientName, setPatientName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");
  const [paymentStatus, setPaymentStatus] = useState<"Paid" | "Pending">("Paid");
  const [notes, setNotes] = useState("");
  const [savingSale, setSavingSale] = useState(false);

  // Financial aggregates
  const totalHospitalRevenue = useMemo(
    () => hospitalSales.reduce((acc, s) => acc + s.amount, 0),
    [hospitalSales]
  );

  const deptAggregates = useMemo(() => {
    return DEPARTMENTS.map((dept) => {
      const salesInDept = hospitalSales.filter((s) => s.department === dept);
      const total = salesInDept.reduce((acc, s) => acc + s.amount, 0);
      const count = salesInDept.length;
      const pct = totalHospitalRevenue > 0 ? (total / totalHospitalRevenue) * 100 : 0;
      return {
        name: dept,
        total,
        count,
        pct: Number(pct.toFixed(1)),
        color: DEPARTMENT_COLORS[dept],
      };
    });
  }, [hospitalSales, totalHospitalRevenue]);

  const paymentMethodData = useMemo(() => {
    const map: Record<PaymentMethod, number> = {
      Insurance: 0,
      UPI: 0,
      Card: 0,
      Cash: 0,
    };
    hospitalSales.forEach((s) => {
      if (map[s.paymentMethod] !== undefined) {
        map[s.paymentMethod] += s.amount;
      }
    });
    return (Object.keys(map) as PaymentMethod[]).map((m) => ({
      name: m,
      value: map[m],
      color: PAYMENT_METHOD_COLORS[m],
    }));
  }, [hospitalSales]);

  const filteredSales = useMemo(() => {
    return hospitalSales.filter((sale) => {
      if (selectedDept !== "All" && sale.department !== selectedDept) return false;
      if (selectedMethod !== "All" && sale.paymentMethod !== selectedMethod) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          sale.patientName.toLowerCase().includes(q) ||
          sale.invoiceNumber.toLowerCase().includes(q) ||
          (sale.doctorName && sale.doctorName.toLowerCase().includes(q)) ||
          sale.serviceDescription.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [hospitalSales, selectedDept, selectedMethod, searchQuery]);

  async function handleRecordSale(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!patientName.trim() || !serviceDescription.trim() || isNaN(numAmount) || numAmount <= 0) {
      return;
    }

    setSavingSale(true);
    try {
      const now = new Date();
      const invoiceNumber = `INV-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
      const date = now.toISOString().split("T")[0];
      const soldAtLabel = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      await addHospitalSale({
        invoiceNumber,
        department: newDept,
        patientName: patientName.trim(),
        doctorName: doctorName.trim() || undefined,
        serviceDescription: serviceDescription.trim(),
        amount: numAmount,
        paymentMethod,
        paymentStatus,
        date,
        soldAtLabel,
        recordedBy: userProfile?.displayName || "Hospital Staff",
        notes: notes.trim() || undefined,
      });

      setShowAddModal(false);
      setPatientName("");
      setDoctorName("");
      setServiceDescription("");
      setAmount("");
      setNotes("");
    } finally {
      setSavingSale(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Overview Banner */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold uppercase tracking-wider">
              <Building2 className="w-4 h-4" />
              Comprehensive Hospital Sales & Financial Accounting
            </div>
            <h2 className="text-xl font-bold text-slate-100 mt-1">
              Hospital Sales & Multi-Department Revenue Desk
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Centralized financial tracking across Pharmacy, OPD, ICU, Emergency, Surgery, Lab & Radiology.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Record Hospital Sale / Invoice
          </button>
        </div>

        {/* 6 Key Financial Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-5">
          <div className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium">Total Gross Sales</div>
            <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
              ₹{totalHospitalRevenue.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {hospitalSales.length} Total Invoices
            </div>
          </div>

          {deptAggregates.slice(0, 5).map((dept) => (
            <div key={dept.name} className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">{dept.name}</span>
                <span className="text-[10px] font-mono text-slate-500">{dept.pct}%</span>
              </div>
              <div className="text-base font-mono font-bold text-slate-100 mt-1">
                ₹{dept.total.toLocaleString()}
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${dept.pct}%`, backgroundColor: dept.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Visual Revenue Analytics: Bar Chart & Payment Method Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Department Revenue Bar Chart */}
        <div className="lg:col-span-8 bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-400" />
                Hospital Sales by Clinical Department
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Total revenue in INR across all hospital cost centers.
              </p>
            </div>
          </div>

          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptAggregates} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0B1120",
                    borderColor: "#334155",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                    color: "#f8fafc",
                  }}
                  formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, "Revenue"]}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {deptAggregates.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Donut / Breakdown */}
        <div className="lg:col-span-4 bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div className="pb-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              Settlement Channels
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Distribution of Insurance vs UPI vs Card vs Cash.
            </p>
          </div>

          <div className="h-44 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0B1120",
                    borderColor: "#334155",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                    color: "#f8fafc",
                  }}
                  formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, "Amount"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            {paymentMethodData.map((item) => {
              const pct = totalHospitalRevenue > 0 ? (item.value / totalHospitalRevenue) * 100 : 0;
              return (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-300">{item.name}</span>
                  </div>
                  <div className="font-mono text-slate-200 tabular-nums">
                    ₹{item.value.toLocaleString()} <span className="text-slate-500">({pct.toFixed(0)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Transactions Data Table */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-sky-400" />
              Detailed Hospital Sales Transactions ({filteredSales.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live ledger of all admissions, pharmacy dispatches, outpatient visits, and critical care procedures.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search patient, invoice, doctor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-200 focus:border-sky-500 focus:outline-none w-52"
              />
            </div>

            {/* Department Filter */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-300 focus:border-sky-500 focus:outline-none"
            >
              <option value="All">All Departments</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            {/* Payment Method Filter */}
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-300 focus:border-sky-500 focus:outline-none"
            >
              <option value="All">All Methods</option>
              <option value="Insurance">Insurance</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="Cash">Cash</option>
            </select>
          </div>
        </div>

        {filteredSales.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No transaction records match your search or filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-3 pr-4 font-medium">Invoice # & Date</th>
                  <th className="py-3 px-3 font-medium">Department</th>
                  <th className="py-3 px-3 font-medium">Patient & Attending</th>
                  <th className="py-3 px-3 font-medium">Service / Clinical Item</th>
                  <th className="py-3 px-3 font-medium text-right">Amount (INR)</th>
                  <th className="py-3 px-3 font-medium">Method</th>
                  <th className="py-3 pl-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredSales.map((sale) => {
                  const deptColor = DEPARTMENT_COLORS[sale.department] || "#38bdf8";
                  return (
                    <tr key={sale.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="font-semibold text-sky-400">{sale.invoiceNumber}</div>
                        <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                          {sale.date} · {sale.soldAtLabel}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className="px-2 py-0.5 rounded text-[11px] font-sans font-semibold inline-block"
                          style={{
                            color: deptColor,
                            backgroundColor: `${deptColor}15`,
                            border: `1px solid ${deptColor}30`,
                          }}
                        >
                          {sale.department}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <div className="font-semibold text-slate-100">{sale.patientName}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {sale.doctorName || "General Care Team"}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-300 max-w-sm truncate">
                        {sale.serviceDescription}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-100 text-sm">
                        ₹{sale.amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <span className="text-slate-300">{sale.paymentMethod}</span>
                      </td>
                      <td className="py-3 pl-3 text-right font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            sale.paymentStatus === "Paid"
                              ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/70"
                              : "bg-amber-950/60 text-amber-300 border border-amber-800/70"
                          }`}
                        >
                          {sale.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Record New Sale / Invoice Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-[#111827] border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                  Record New Hospital Sale / Invoice
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Generate hospital billing records across OPD, Pharmacy, ICU, and Surgery.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordSale} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Department
                  </label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value as FinancialDepartment)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Amount (INR)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g., 4500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Patient Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Rohit Verma"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Attending Physician
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Dr. Arjun Rao"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Service / Procedure Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Cardiac Telemetry Monitoring (2 Days) & Troponin-I"
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Card">Debit / Credit Card</option>
                    <option value="Insurance">Health Insurance TPA</option>
                    <option value="Cash">Cash Settlement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="Paid">Paid in Full</option>
                    <option value="Pending">Pending Insurance Claim</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Billing Notes / Transaction Ref
                </label>
                <input
                  type="text"
                  placeholder="Optional policy number, transaction ID or receipt remark..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSale}
                  className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                >
                  {savingSale ? "Saving..." : "Save Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
