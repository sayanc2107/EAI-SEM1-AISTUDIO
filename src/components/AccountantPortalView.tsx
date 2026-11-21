import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Edit2,
  Package,
  Plus,
  Receipt,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import type {
  PaymentMethod,
  PrescriptionLineItem,
  SplitPaymentDetail,
  StaffPayrollRecord,
} from "../types/hospital";
import { HospitalFinancialsView } from "./HospitalFinancialsView";
import { PayrollSystemView } from "./PayrollSystemView";
import { StaffDirectoryView } from "./StaffDirectoryView";

interface AccountantPortalProps {
  subTab?: "overview" | "sales" | "payroll" | "staff" | "billing";
}

function AccountantBillingDesk() {
  const { inventory, createPharmacyBill, addHospitalSale, pushToast } = useHospital();

  const [patientName, setPatientName] = useState("");
  const [doctorName, setDoctorName] = useState("Walk-In / OPD");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [billItems, setBillItems] = useState<PrescriptionLineItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");
  const [splitMethod1, setSplitMethod1] = useState<"UPI" | "Card" | "Cash">("Cash");
  const [splitAmount1, setSplitAmount1] = useState("");
  const [splitMethod2, setSplitMethod2] = useState<"UPI" | "Card" | "Cash">("UPI");
  const [splitAmount2, setSplitAmount2] = useState("");
  const [invSearch, setInvSearch] = useState("");
  const [generating, setGenerating] = useState(false);

  const selectedItem = useMemo(
    () => inventory.find((i) => i.id === selectedItemId) || null,
    [inventory, selectedItemId]
  );

  const totalBillAmount = useMemo(
    () => billItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0),
    [billItems]
  );

  function handleAddItem() {
    if (!selectedItem) return;
    const qty = parseInt(itemQuantity, 10);
    if (isNaN(qty) || qty <= 0) return;
    if (qty > selectedItem.stock) {
      pushToast("Insufficient Stock", `Available stock is only ${selectedItem.stock} ${selectedItem.unit}`, "warning");
      return;
    }

    const existingIndex = billItems.findIndex((it) => it.itemId === selectedItem.id);
    if (existingIndex >= 0) {
      setBillItems((prev) =>
        prev.map((it, idx) =>
          idx === existingIndex ? { ...it, quantity: it.quantity + qty } : it
        )
      );
    } else {
      setBillItems((prev) => [
        ...prev,
        {
          itemId: selectedItem.id,
          itemName: selectedItem.name,
          quantity: qty,
          unit: selectedItem.unit,
          unitPrice: selectedItem.unitPrice,
          dosage: "Dispensed per prescription",
        },
      ]);
    }
    setItemQuantity("1");
  }

  function handleRemoveItem(index: number) {
    setBillItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreateBill(e: React.FormEvent) {
    e.preventDefault();
    if (!patientName.trim()) {
      pushToast("Patient Name Required", "Enter the patient or purchaser name.", "warning");
      return;
    }
    if (billItems.length === 0) {
      pushToast("No Items", "Add at least one medicine or medical supply to generate bill.", "warning");
      return;
    }

    let splitDetails: SplitPaymentDetail | undefined = undefined;
    if (paymentMethod === "Split") {
      const a1 = parseFloat(splitAmount1) || 0;
      const a2 = parseFloat(splitAmount2) || 0;
      if (a1 + a2 !== totalBillAmount) {
        pushToast(
          "Split Payment Mismatch",
          `Split amounts (₹${a1} + ₹${a2} = ₹${a1 + a2}) must equal total bill amount (₹${totalBillAmount})`,
          "warning"
        );
        return;
      }
      splitDetails = {
        method1: splitMethod1,
        amount1: a1,
        method2: splitMethod2,
        amount2: a2,
      };
    }

    setGenerating(true);
    try {
      const bill = await createPharmacyBill({
        patientName: patientName.trim(),
        doctorName: doctorName.trim() || "Walk-In / OPD",
        items: billItems,
        paymentMethod,
        splitPayments: splitDetails,
      });

      if (bill) {
        // Also register into hospital sales ledger for hospital accounting
        await addHospitalSale({
          invoiceNumber: bill.billNumber,
          department: "Pharmacy",
          patientName: bill.patientName,
          doctorName: bill.doctorName,
          serviceDescription: bill.items.map((i) => `${i.itemName} x${i.quantity}`).join(", "),
          amount: bill.totalAmount,
          paymentMethod: bill.paymentMethod,
          splitPayments: bill.splitPayments,
          paymentStatus: "Paid",
          date: new Date().toISOString().split("T")[0],
          soldAtLabel: bill.soldAtLabel,
          recordedBy: "Vikram Mehta (Chief Accountant)",
          notes: "Counter pharmacy bill created by Hospital Finance Desk",
        });

        setPatientName("");
        setBillItems([]);
        setSplitAmount1("");
        setSplitAmount2("");
      }
    } finally {
      setGenerating(false);
    }
  }

  const filteredInventory = useMemo(() => {
    if (!invSearch.trim()) return inventory;
    const q = invSearch.toLowerCase();
    return inventory.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    );
  }, [inventory, invSearch]);

  return (
    <div className="space-y-6">
      {/* Read-Only & Privacy Compliance Notice */}
      <div className="p-4 rounded-xl bg-sky-950/40 border border-sky-800/60 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-sky-200">
            Accountant Hospital Finance & Pharmacy Billing Counter
          </p>
          <p className="text-slate-300">
            Compliant with hospital data segregation policy: Stock check is read-only (stock additions/deductions are restricted to registered pharmacists). Patient clinical charts and private medical records are strictly protected.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Pharmacy Bill Creation Desk */}
        <section className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              Generate Pharmacy / Hospital Invoice
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Accountant point-of-sale invoice generation with automatic stock deduction and split payments.
            </p>
          </div>

          <form onSubmit={handleCreateBill} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Customer / Patient Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Prescribing Physician / Unit
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Rajesh Sen (OPD-2)"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Medicine Add Row */}
            <div className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-slate-200 block">Add Medicine to Bill</span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-8">
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-slate-700 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="">Select Medicine from Inventory...</option>
                    {inventory.map((inv) => (
                      <option key={inv.id} value={inv.id} disabled={inv.stock <= 0}>
                        {inv.name} (₹{inv.unitPrice}/{inv.unit}) — Stock: {inv.stock}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="number"
                    min="1"
                    max={selectedItem?.stock || 999}
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-slate-700 text-xs font-mono text-slate-100 text-center focus:border-sky-500 focus:outline-none"
                    placeholder="Qty"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    disabled={!selectedItemId}
                    className="w-full py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Items Table */}
            {billItems.length > 0 && (
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#0B1120] text-slate-400">
                    <tr>
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-2 text-center">Qty</th>
                      <th className="py-2 px-2 text-right">Price</th>
                      <th className="py-2 px-2 text-right">Total</th>
                      <th className="py-2 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {billItems.map((it, idx) => (
                      <tr key={it.itemId}>
                        <td className="py-2 px-3 text-slate-200">{it.itemName}</td>
                        <td className="py-2 px-2 text-center font-mono">{it.quantity}</td>
                        <td className="py-2 px-2 text-right font-mono text-slate-300">₹{it.unitPrice}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-100">
                          ₹{it.quantity * it.unitPrice}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#0B1120] font-bold">
                      <td colSpan={3} className="py-2 px-3 text-slate-300">Total Invoice Amount:</td>
                      <td className="py-2 px-2 text-right text-emerald-400 font-mono text-sm">
                        ₹{totalBillAmount.toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(["UPI", "Card", "Cash", "Insurance", "Split"] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        paymentMethod === m
                          ? "bg-sky-500 text-slate-950"
                          : "bg-[#0B1120] border border-slate-800 text-slate-300 hover:text-white"
                      }`}
                    >
                      {m === "Split" ? "Split Payment" : m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Split Payment inputs if selected */}
              {paymentMethod === "Split" && (
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 space-y-2.5">
                  <span className="text-xs font-semibold text-amber-300 block">
                    Split Mode Breakdown (Sum must equal ₹{totalBillAmount})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="flex gap-2">
                      <select
                        value={splitMethod1}
                        onChange={(e) => setSplitMethod1(e.target.value as any)}
                        className="px-2 py-1.5 rounded-lg bg-[#0B1120] border border-slate-700 text-slate-200"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Card">Card</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Amount 1 (₹)"
                        value={splitAmount1}
                        onChange={(e) => setSplitAmount1(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-[#0B1120] border border-slate-700 text-slate-100 font-mono"
                      />
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={splitMethod2}
                        onChange={(e) => setSplitMethod2(e.target.value as any)}
                        className="px-2 py-1.5 rounded-lg bg-[#0B1120] border border-slate-700 text-slate-200"
                      >
                        <option value="UPI">UPI</option>
                        <option value="Card">Card</option>
                        <option value="Cash">Cash</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Amount 2 (₹)"
                        value={splitAmount2}
                        onChange={(e) => setSplitAmount2(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-[#0B1120] border border-slate-700 text-slate-100 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={generating || billItems.length === 0}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
            >
              {generating ? "Processing Transaction..." : `Issue & Print Pharmacy Bill (₹${totalBillAmount.toLocaleString()})`}
            </button>
          </form>
        </section>

        {/* Right: Read-Only Stock Directory */}
        <section className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-sky-400" />
                Live Stock Check
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Read-only medicine price & inventory register ({filteredInventory.length} items)
              </p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-950 border border-sky-800 text-sky-300">
              Read-Only
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search medicine stock..."
              value={invSearch}
              onChange={(e) => setInvSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="overflow-y-auto max-h-[480px] space-y-2 pr-1">
            {filteredInventory.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-[#0B1120] border border-slate-800 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-100">{item.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {item.category} · Batch Expiry: {item.expiryDate}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-mono font-bold ${
                      item.stock <= item.minThreshold ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {item.stock} {item.unit}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    ₹{item.unitPrice}/{item.unit}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function AccountantStaffAccountsView() {
  const { payrollRecords, updatePayrollCompensation } = useHospital();
  const [editingPayroll, setEditingPayroll] = useState<StaffPayrollRecord | null>(null);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [allowances, setAllowances] = useState("");
  const [bonus, setBonus] = useState("");
  const [overtimePay, setOvertimePay] = useState("");
  const [deductions, setDeductions] = useState("");
  const [designation, setDesignation] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  function handleOpenSetup(rec: StaffPayrollRecord) {
    setEditingPayroll(rec);
    setBankName(rec.bankName || "");
    setAccountNumber(rec.bankAccountNumber || "");
    setIfsc(rec.ifscOrSwift || "");
    setBaseSalary(String(rec.baseSalary));
    setAllowances(String(rec.allowances));
    setBonus(String(rec.bonus));
    setOvertimePay(String(rec.overtimePay));
    setDeductions(String(rec.deductions));
    setDesignation(rec.designation || "");
  }

  async function handleSaveSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPayroll) return;
    setSaving(true);
    try {
      await updatePayrollCompensation(editingPayroll.id, {
        bankName: bankName.trim() || "HDFC Bank",
        bankAccountNumber: accountNumber.trim() || "000000000000",
        ifscOrSwift: ifsc.trim().toUpperCase() || "HDFC0000000",
        designation: designation.trim() || editingPayroll.designation,
        baseSalary: Number(baseSalary) || 0,
        allowances: Number(allowances) || 0,
        bonus: Number(bonus) || 0,
        overtimePay: Number(overtimePay) || 0,
        deductions: Number(deductions) || 0,
      });
      setEditingPayroll(null);
    } finally {
      setSaving(false);
    }
  }

  const combinedStaff = useMemo(() => {
    return payrollRecords.filter((rec) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        rec.staffName.toLowerCase().includes(q) ||
        rec.staffId.toLowerCase().includes(q) ||
        rec.department.toLowerCase().includes(q) ||
        rec.bankAccountNumber.toLowerCase().includes(q)
      );
    });
  }, [payrollRecords, search]);

  return (
    <div className="space-y-6">
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              Employee Bank Account Details & Compensation Setup
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Newly registered employees added by Administrator appear here. Configure their bank name, account number, IFSC code, and salary breakdown.
            </p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employee or account..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-200 focus:border-sky-500 focus:outline-none w-56"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-3 pr-3 font-medium">Employee Name & ID</th>
                <th className="py-3 px-3 font-medium">Role & Department</th>
                <th className="py-3 px-3 font-medium">Bank Name & A/c No</th>
                <th className="py-3 px-3 font-medium">IFSC Code</th>
                <th className="py-3 px-3 font-medium text-right">Base Salary</th>
                <th className="py-3 px-3 font-medium text-right">Net Take-Home</th>
                <th className="py-3 px-3 font-medium">Account Status</th>
                <th className="py-3 pl-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {combinedStaff.map((rec) => {
                const isPending =
                  rec.bankAccountNumber === "000000000000" ||
                  rec.bankName.includes("Pending") ||
                  !rec.bankAccountNumber;
                return (
                  <tr key={rec.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 pr-3 font-sans">
                      <div className="font-bold text-slate-100">{rec.staffName}</div>
                      <div className="text-[11px] font-mono text-slate-400">{rec.staffId}</div>
                    </td>
                    <td className="py-3.5 px-3 font-sans">
                      <span className="capitalize text-slate-300 font-medium">{rec.role.replace("_", " ")}</span>
                      <div className="text-[11px] text-slate-500">{rec.department}</div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="text-slate-200 font-sans">{rec.bankName}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{rec.bankAccountNumber}</div>
                    </td>
                    <td className="py-3.5 px-3 text-slate-300 uppercase">
                      {rec.ifscOrSwift}
                    </td>
                    <td className="py-3.5 px-3 text-right text-slate-300">
                      ₹{rec.baseSalary.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-emerald-400">
                      ₹{rec.netSalary.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 font-sans">
                      {isPending ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800 flex items-center gap-1 w-fit">
                          <AlertCircle className="w-3 h-3" /> Setup Required
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> Configured
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pl-3 text-right font-sans">
                      <button
                        type="button"
                        onClick={() => handleOpenSetup(rec)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        {isPending ? "Setup Account" : "Edit Details"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit / Setup Modal */}
      {editingPayroll && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setEditingPayroll(null)}
        >
          <div
            className="bg-[#111827] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  Bank Account & Salary Setup: {editingPayroll.staffName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingPayroll.staffId} · {editingPayroll.role.replace("_", " ")} ({editingPayroll.department})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPayroll(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSetup} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-800">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank, SBI, ICICI"
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
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
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
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    placeholder="e.g. HDFC0001234"
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono uppercase text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    required
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Senior Medical Officer"
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
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
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
                    value={allowances}
                    onChange={(e) => setAllowances(e.target.value)}
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
                    value={bonus}
                    onChange={(e) => setBonus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Overtime Pay</label>
                  <input
                    type="number"
                    required
                    value={overtimePay}
                    onChange={(e) => setOvertimePay(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Deductions</label>
                  <input
                    type="number"
                    required
                    value={deductions}
                    onChange={(e) => setDeductions(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#0B1120] border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Recalculated Net Take-Home:</span>
                <span className="text-base font-mono font-bold text-emerald-400">
                  ₹
                  {Math.max(
                    0,
                    (Number(baseSalary) || 0) +
                      (Number(allowances) || 0) +
                      (Number(bonus) || 0) +
                      (Number(overtimePay) || 0) -
                      (Number(deductions) || 0)
                  ).toLocaleString()}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingPayroll(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                >
                  {saving ? "Saving Details..." : "Save Account & Salary Breakdown"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function AccountantPortalView({ subTab = "overview" }: AccountantPortalProps) {
  if (subTab === "payroll") {
    return <PayrollSystemView />;
  }

  if (subTab === "staff") {
    return <AccountantStaffAccountsView />;
  }

  if (subTab === "billing") {
    return <AccountantBillingDesk />;
  }

  // overview and sales both use HospitalFinancialsView (which provides comprehensive charts and sales logs)
  return <HospitalFinancialsView />;
}
