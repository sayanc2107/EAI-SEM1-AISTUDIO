import React, { useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  FileSpreadsheet,
  Minus,
  PackagePlus,
  PhoneCall,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import { ApiRequestError, runAIPharmacyInsights } from "../services/aiClient";
import type {
  InventoryCategory,
  PaymentMethod,
  PharmacyInsightsAIResult,
  PharmacySale,
  PrescriptionLineItem,
  PrescriptionRequest,
  SplitPaymentDetail,
} from "../types/hospital";
import {
  downloadStockTemplateExcel,
  exportCurrentStockToExcel,
  exportSalesToExcel,
  parseStockExcelFile,
  type ParsedStockRow,
} from "../utils/excelUtils";
import { exportPharmacyBillToPdf } from "../utils/pdfBillUtils";
import { CallDoctorModal } from "./CallDoctorModal";

type PharmacyTab = "queue_billing" | "stock_excel" | "sales_ledger" | "ai_insights" | "add_stock";

const CATEGORIES: InventoryCategory[] = [
  "Medication",
  "Critical Care",
  "Diagnostics",
  "PPE",
];

const PAYMENT_METHODS: PaymentMethod[] = ["UPI", "Card", "Cash", "Insurance", "Split"];

function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function PharmacistPortalView({
  activeSubTab,
}: {
  activeSubTab?: "overview" | "prescriptions" | "inventory" | "billing" | "add_stock";
} = {}) {
  const {
    myShift,
    inventory,
    prescriptions,
    pharmacySales,
    adjustInventoryStock,
    addInventoryItem,
    importStockFromExcelRows,
    applyRestockBatch,
    updatePrescriptionStatus,
    createPharmacyBill,
    seedSamplePharmacyData,
    pushToast,
  } = useHospital();

  const initialTab: PharmacyTab =
    activeSubTab === "overview"
      ? "ai_insights"
      : activeSubTab === "inventory"
        ? "stock_excel"
        : activeSubTab === "billing"
          ? "sales_ledger"
          : activeSubTab === "add_stock"
            ? "add_stock"
            : "queue_billing";

  const [tab, setTab] = useState<PharmacyTab>(initialTab);

  React.useEffect(() => {
    if (activeSubTab === "overview") setTab("ai_insights");
    else if (activeSubTab === "inventory") setTab("stock_excel");
    else if (activeSubTab === "billing") setTab("sales_ledger");
    else if (activeSubTab === "prescriptions") setTab("queue_billing");
    else if (activeSubTab === "add_stock") setTab("add_stock");
  }, [activeSubTab]);

  const [showCallDoctor, setShowCallDoctor] = useState(false);

  // Billing Desk state
  const [activeRxId, setActiveRxId] = useState<string | null>(null);
  const [billPatientName, setBillPatientName] = useState("");
  const [billDoctorName, setBillDoctorName] = useState("Walk-In");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("UPI");
  const [splitMethod1, setSplitMethod1] = useState<"UPI" | "Card" | "Cash">("Cash");
  const [splitAmount1, setSplitAmount1] = useState("");
  const [splitMethod2, setSplitMethod2] = useState<"UPI" | "Card" | "Cash">("UPI");
  const [splitAmount2, setSplitAmount2] = useState("");
  const [billItems, setBillItems] = useState<PrescriptionLineItem[]>([]);
  const [selectedAddItemId, setSelectedAddItemId] = useState("");
  const [selectedAddQty, setSelectedAddQty] = useState("1");
  const [submittingBill, setSubmittingBill] = useState(false);
  const [autoExportPdf, setAutoExportPdf] = useState(true);
  const [lastGeneratedSale, setLastGeneratedSale] = useState<PharmacySale | null>(null);
  const [seedingPharmacy, setSeedingPharmacy] = useState(false);

  // Stock management & Excel import state
  const [stockSearch, setStockSearch] = useState("");
  const [showAddStockForm, setShowAddStockForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<InventoryCategory>("Medication");
  const [newStock, setNewStock] = useState("50");
  const [newUnit, setNewUnit] = useState("strips");
  const [newPrice, setNewPrice] = useState("120");
  const [newThreshold, setNewThreshold] = useState("20");
  const [newSupplier, setNewSupplier] = useState("Apex Pharma Supply");
  const [newExpiry, setNewExpiry] = useState("2027-12-31");
  const [newDailyUsage, setNewDailyUsage] = useState("8");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsedExcelRows, setParsedExcelRows] = useState<ParsedStockRow[]>([]);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [importingExcel, setImportingExcel] = useState(false);

  // AI Sales & Restock Insights state
  const [insights, setInsights] = useState<PharmacyInsightsAIResult | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<{
    message: string;
    hint?: string;
  } | null>(null);
  const [restockedIds, setRestockedIds] = useState<string[]>([]);

  const pendingOrPreparingRx = useMemo(
    () => prescriptions.filter((rx) => rx.status !== "Dispensed"),
    [prescriptions]
  );

  const readyCount = useMemo(
    () => prescriptions.filter((rx) => rx.status === "Ready").length,
    [prescriptions]
  );

  const lowStockCount = useMemo(
    () => inventory.filter((i) => i.stock <= i.minThreshold).length,
    [inventory]
  );

  const totalRevenue = useMemo(
    () => pharmacySales.reduce((sum, s) => sum + s.totalAmount, 0),
    [pharmacySales]
  );

  const filteredInventory = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.supplier.toLowerCase().includes(q)
    );
  }, [inventory, stockSearch]);

  const billTotal = useMemo(
    () => billItems.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    [billItems]
  );

  function loadPrescriptionIntoBilling(rx: PrescriptionRequest) {
    setActiveRxId(rx.id);
    setBillPatientName(rx.patientName);
    setBillDoctorName(rx.doctorName);
    setBillItems(rx.items.map((i) => ({ ...i })));
    setTab("queue_billing");
    pushToast(
      `Loaded ${rx.id} into Billing Desk`,
      `Pre-packed for ${rx.patientName} — ready for instant checkout`,
      "info"
    );
  }

  function handleAddLineToBill() {
    const targetId = selectedAddItemId || inventory[0]?.id;
    const item = inventory.find((i) => i.id === targetId);
    if (!item) return;
    const qty = Math.max(1, Math.round(Number(selectedAddQty) || 1));

    setBillItems((prev) => {
      const existing = prev.find((p) => p.itemId === item.id);
      if (existing) {
        return prev.map((p) =>
          p.itemId === item.id ? { ...p, quantity: p.quantity + qty } : p
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          itemName: item.name,
          quantity: qty,
          unitPrice: item.unitPrice,
          dosage: "As prescribed",
        },
      ];
    });
    setSelectedAddQty("1");
  }

  function handleRemoveBillLine(itemId: string) {
    setBillItems((prev) => prev.filter((i) => i.itemId !== itemId));
  }

  async function handleCompleteBill(e: React.FormEvent) {
    e.preventDefault();
    if (!billPatientName.trim() || billItems.length === 0) {
      pushToast(
        "Incomplete bill",
        "Enter patient/customer name and add at least one medicine.",
        "warning"
      );
      return;
    }

    let splitDetails: SplitPaymentDetail | undefined = undefined;
    if (paymentMethod === "Split") {
      const a1 = parseFloat(splitAmount1) || 0;
      const a2 = parseFloat(splitAmount2) || 0;
      const totalAmount = billItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
      if (a1 + a2 !== totalAmount) {
        pushToast(
          "Split Payment Mismatch",
          `Split amounts (₹${a1} + ₹${a2} = ₹${a1 + a2}) must equal total bill amount (₹${totalAmount})`,
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

    setSubmittingBill(true);
    try {
      const sale = await createPharmacyBill({
        prescriptionId: activeRxId,
        patientName: billPatientName.trim(),
        doctorName: billDoctorName.trim() || "Walk-In",
        items: billItems,
        paymentMethod,
        splitPayments: splitDetails,
      });
      if (sale) {
        setLastGeneratedSale(sale);
        if (autoExportPdf) {
          exportPharmacyBillToPdf(sale);
          pushToast(
            `Printable PDF exported (${sale.billNumber})`,
            `Saved A4 pharmacy invoice for ${sale.patientName}`,
            "success"
          );
        }
        setActiveRxId(null);
        setBillPatientName("");
        setBillDoctorName("Walk-In");
        setBillItems([]);
      }
    } finally {
      setSubmittingBill(false);
    }
  }

  async function handleLoadSamplePharmacy() {
    setSeedingPharmacy(true);
    try {
      await seedSamplePharmacyData();
    } finally {
      setSeedingPharmacy(false);
    }
  }

  async function handleManualAddStock(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await addInventoryItem({
      name: newName.trim(),
      category: newCategory,
      stock: Math.max(0, Number(newStock) || 0),
      unit: newUnit.trim() || "units",
      unitPrice: Math.max(0, Number(newPrice) || 0),
      minThreshold: Math.max(1, Number(newThreshold) || 10),
      supplier: newSupplier.trim() || "Apex Pharma Supply",
      expiryDate: newExpiry || "2027-12-31",
      dailyUsage: Math.max(1, Number(newDailyUsage) || 5),
    });
    setNewName("");
    setShowAddStockForm(false);
  }

  async function handleExcelFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelError(null);
    try {
      const rows = await parseStockExcelFile(file);
      setParsedExcelRows(rows);
    } catch (err) {
      setParsedExcelRows([]);
      setExcelError(
        err instanceof Error ? err.message : "Could not read the uploaded Excel file."
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleCommitExcelRows() {
    if (parsedExcelRows.length === 0) return;
    setImportingExcel(true);
    try {
      await importStockFromExcelRows(parsedExcelRows);
      setParsedExcelRows([]);
    } finally {
      setImportingExcel(false);
    }
  }

  async function handleRunPharmacyAI() {
    setLoadingInsights(true);
    setInsightsError(null);
    setRestockedIds([]);
    try {
      const result = await runAIPharmacyInsights({
        sales: pharmacySales,
        inventory,
        pendingPrescriptions: pendingOrPreparingRx,
      });
      setInsights(result);
      setTab("ai_insights");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setInsightsError({ message: err.message, hint: err.hint });
      } else {
        setInsightsError({ message: "Could not generate AI pharmacy sales insights." });
      }
    } finally {
      setLoadingInsights(false);
    }
  }

  async function handleApproveRestock(itemId: string, qty: number) {
    await applyRestockBatch([{ itemId, quantity: qty }]);
    setRestockedIds((prev) => [...prev, itemId]);
  }

  return (
    <div className="space-y-6">
      {/* Top KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-400">Doctor Rx Queue</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-50">
            {pendingOrPreparingRx.length}
          </div>
          <div className="mt-1 text-xs text-sky-400 font-mono tabular-nums">
            {readyCount} packed & ready for pickup
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-400">Total Pharmacy Sales</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-emerald-400">
            {formatINR(totalRevenue)}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
            {pharmacySales.length} bills generated
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-400">Low-Stock Medicines</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-amber-400">
            {lowStockCount}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Out of {inventory.length} tracked SKUs
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-400">Active Pharmacy Desk</div>
          <div className="mt-1.5 text-base font-semibold text-slate-100 truncate">
            {myShift?.location || "Central Pharmacy Desk"}
          </div>
          <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
            {myShift ? `${myShift.shiftStart} – ${myShift.shiftEnd} (${myShift.shiftName})` : "Shift Active"}
          </div>
        </div>
      </div>

      {/* Sub-Navigation & Primary Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#111827] border border-slate-800 overflow-x-auto">
          <button
            type="button"
            onClick={() => setTab("queue_billing")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === "queue_billing"
                ? "bg-slate-800 text-sky-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Pre-Pack Queue & Billing
          </button>
          <button
            type="button"
            onClick={() => setTab("stock_excel")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === "stock_excel"
                ? "bg-slate-800 text-sky-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Stock & Excel Import
          </button>
          <button
            type="button"
            onClick={() => setTab("sales_ledger")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === "sales_ledger"
                ? "bg-slate-800 text-sky-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Sales Ledger ({pharmacySales.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("ai_insights")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === "ai_insights"
                ? "bg-slate-800 text-sky-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Sales & Restock
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowCallDoctor(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            Call Doctor
          </button>
          {inventory.length < 16 && (
            <button
              type="button"
              onClick={handleLoadSamplePharmacy}
              disabled={seedingPharmacy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-sky-500/50 bg-sky-500/10 hover:bg-sky-500/20 disabled:opacity-60 text-xs font-medium text-sky-300 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              {seedingPharmacy ? "Loading Sample Data..." : "Load Sample Stock & Bills"}
            </button>
          )}
          <button
            type="button"
            onClick={() => exportSalesToExcel(pharmacySales, inventory)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 hover:border-slate-500 hover:bg-slate-800/70 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            Export Sales (.xlsx)
          </button>
          <button
            type="button"
            onClick={handleRunPharmacyAI}
            disabled={loadingInsights}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            {loadingInsights ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {loadingInsights ? "Analyzing Sales..." : "AI Stock Advisor"}
          </button>
        </div>
      </div>

      {/* TAB 1: Doctor Prescriptions Pre-Pack Queue + Billing Desk */}
      {tab === "queue_billing" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Incoming Doctor Prescriptions (Pre-Pack Queue) */}
          <section className="xl:col-span-6 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="pb-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-slate-100">
                Doctor Prescription Requests
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Pack doctor prescriptions early so patients simply pay and collect medicines without waiting.
              </p>
            </div>

            {pendingOrPreparingRx.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                All doctor prescription requests have been dispensed.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingOrPreparingRx.map((rx) => {
                  const priorityColor =
                    rx.priority === "Stat"
                      ? "text-red-400"
                      : rx.priority === "Urgent"
                        ? "text-amber-400"
                        : "text-sky-400";
                  const statusColor =
                    rx.status === "Ready"
                      ? "text-emerald-400"
                      : rx.status === "Preparing"
                        ? "text-sky-400"
                        : "text-amber-400";

                  return (
                    <div
                      key={rx.id}
                      className={`p-4 rounded-lg bg-[#0B1120] border transition-colors space-y-3 ${
                        activeRxId === rx.id
                          ? "border-sky-500/70"
                          : "border-slate-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                            <span>{rx.patientName}</span>
                            <span className="text-xs font-mono text-slate-500">{rx.id}</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Prescribed by {rx.doctorName} ·{" "}
                            <span className={`font-semibold ${priorityColor}`}>
                              {rx.priority}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xs font-semibold ${statusColor}`}>
                            {rx.status === "Ready" ? "Ready for Pickup" : rx.status}
                          </div>
                          <div className="text-xs font-mono tabular-nums text-slate-300 mt-0.5">
                            Est. {formatINR(rx.estimatedTotal)}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-slate-300 border-t border-slate-800/80 pt-2.5">
                        {rx.items.map((line, idx) => (
                          <div
                            key={`${rx.id}-${idx}`}
                            className="flex items-baseline justify-between gap-2"
                          >
                            <span>
                              {line.itemName}{" "}
                              <span className="text-slate-500">({line.dosage})</span>
                            </span>
                            <span className="font-mono tabular-nums text-slate-200 shrink-0">
                              x{line.quantity} · {formatINR(line.quantity * line.unitPrice)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {rx.notes && (
                        <p className="text-xs text-slate-400 italic">Note: {rx.notes}</p>
                      )}

                      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-end gap-2">
                        {rx.status === "Pending" && (
                          <button
                            type="button"
                            onClick={() => updatePrescriptionStatus(rx.id, "Preparing")}
                            className="px-3 py-1.5 rounded-md border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                          >
                            Start Packing
                          </button>
                        )}
                        {rx.status !== "Ready" && (
                          <button
                            type="button"
                            onClick={() => updatePrescriptionStatus(rx.id, "Ready")}
                            className="px-3 py-1.5 rounded-md border border-emerald-700/70 bg-emerald-950/30 hover:bg-emerald-900/40 text-xs font-medium text-emerald-300 transition-colors cursor-pointer"
                          >
                            Mark Ready for Pickup
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => loadPrescriptionIntoBilling(rx)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          Bill & Dispense
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Fast Pharmacy Billing Desk */}
          <section className="xl:col-span-6 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  Pharmacy Billing & Checkout
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeRxId
                    ? `Billed against pre-packed prescription ${activeRxId}`
                    : "Select a pre-packed prescription or create a walk-in pharmacy bill."}
                </p>
              </div>
              {activeRxId && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveRxId(null);
                    setBillPatientName("");
                    setBillDoctorName("Walk-In");
                    setBillItems([]);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Clear Rx
                </button>
              )}
            </div>

            <form onSubmit={handleCompleteBill} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Patient / Customer Name
                  </label>
                  <input
                    type="text"
                    required
                    value={billPatientName}
                    onChange={(e) => setBillPatientName(e.target.value)}
                    placeholder="e.g., Ramesh Iyer"
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 focus:border-sky-500 focus:outline-none text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Prescribing Doctor
                  </label>
                  <input
                    type="text"
                    value={billDoctorName}
                    onChange={(e) => setBillDoctorName(e.target.value)}
                    placeholder="Walk-In or Doctor Name"
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 focus:border-sky-500 focus:outline-none text-sm text-slate-100"
                  />
                </div>
              </div>

              {/* Add Medicine Line Control */}
              <div className="p-3.5 rounded-lg bg-[#0B1120] border border-slate-800 space-y-2.5">
                <div className="text-xs font-medium text-slate-400">Add Medicine to Bill</div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <select
                    value={selectedAddItemId || inventory[0]?.id || ""}
                    onChange={(e) => setSelectedAddItemId(e.target.value)}
                    className="sm:col-span-7 px-3 py-2 rounded-lg bg-[#111827] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  >
                    {inventory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — {formatINR(item.unitPrice)} ({item.stock} in stock)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={selectedAddQty}
                    onChange={(e) => setSelectedAddQty(e.target.value)}
                    className="sm:col-span-2 px-3 py-2 rounded-lg bg-[#111827] border border-slate-800 text-xs font-mono tabular-nums text-slate-100 focus:border-sky-500 focus:outline-none"
                    aria-label="Quantity"
                  />
                  <button
                    type="button"
                    onClick={handleAddLineToBill}
                    className="sm:col-span-3 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>

              {/* Bill Line Items */}
              <div className="border border-slate-800 rounded-lg divide-y divide-slate-800/80 bg-[#0B1120]">
                {billItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No medicines added to bill yet.
                  </div>
                ) : (
                  billItems.map((line) => (
                    <div
                      key={line.itemId}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-100 truncate">
                          {line.itemName}
                        </div>
                        <div className="text-slate-500 font-mono tabular-nums">
                          {line.quantity} × {formatINR(line.unitPrice)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono font-semibold text-slate-100 tabular-nums">
                          {formatINR(line.quantity * line.unitPrice)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveBillLine(line.itemId)}
                          className="text-slate-500 hover:text-red-400 cursor-pointer"
                          aria-label={`Remove ${line.itemName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Payment Method & Final Checkout */}
              <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-400 mb-1.5">Payment Method</div>
                  <div className="flex items-center gap-1.5">
                    {PAYMENT_METHODS.map((pm) => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setPaymentMethod(pm)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                          paymentMethod === pm
                            ? "border-sky-500/70 bg-sky-500/15 text-sky-300"
                            : "border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {pm === "Split" ? "Split Payment" : pm}
                      </button>
                    ))}
                  </div>

                  {paymentMethod === "Split" && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40 space-y-2">
                      <span className="text-[11px] font-semibold text-amber-300 block">
                        Split Payment Breakdown (Total: {formatINR(billTotal)})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="flex gap-1.5">
                          <select
                            value={splitMethod1}
                            onChange={(e) => setSplitMethod1(e.target.value as any)}
                            className="px-2 py-1 rounded bg-[#0B1120] border border-slate-700 text-slate-200 text-xs"
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
                            className="w-full px-2 py-1 rounded bg-[#0B1120] border border-slate-700 text-slate-100 font-mono text-xs"
                          />
                        </div>
                        <div className="flex gap-1.5">
                          <select
                            value={splitMethod2}
                            onChange={(e) => setSplitMethod2(e.target.value as any)}
                            className="px-2 py-1 rounded bg-[#0B1120] border border-slate-700 text-slate-200 text-xs"
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
                            className="w-full px-2 py-1 rounded bg-[#0B1120] border border-slate-700 text-slate-100 font-mono text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-xs text-slate-400">Grand Total</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-emerald-400">
                    {formatINR(billTotal)}
                  </div>
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-800 cursor-pointer select-none">
                <span className="flex items-center gap-2 text-xs text-slate-300">
                  <Printer className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  Directly export printable A4 PDF invoice when bill is generated
                </span>
                <input
                  type="checkbox"
                  checked={autoExportPdf}
                  onChange={(e) => setAutoExportPdf(e.target.checked)}
                  className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
                />
              </label>

              <button
                type="submit"
                disabled={submittingBill || billItems.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-semibold transition-colors cursor-pointer"
              >
                {autoExportPdf ? (
                  <Printer className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {submittingBill
                  ? "Processing Bill & Exporting PDF..."
                  : autoExportPdf
                    ? "Generate Bill & Export Printable PDF"
                    : "Generate Bill & Deduct Stock"}
              </button>
            </form>

            {lastGeneratedSale && (
              <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Invoice Ready · {lastGeneratedSale.billNumber}</span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1 truncate">
                    {lastGeneratedSale.patientName} ·{" "}
                    <span className="font-mono tabular-nums font-semibold text-emerald-400">
                      {formatINR(lastGeneratedSale.totalAmount)}
                    </span>{" "}
                    ({lastGeneratedSale.paymentMethod})
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => exportPharmacyBillToPdf(lastGeneratedSale)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Download PDF Again
                  </button>
                  <button
                    type="button"
                    onClick={() => setLastGeneratedSale(null)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 cursor-pointer"
                    aria-label="Dismiss invoice banner"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: Stock Management & Excel Upload */}
      {tab === "stock_excel" && (
        <div className="space-y-6">
          {/* Excel Bulk Stock Import Bar */}
          <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  Bulk Add Stock from Excel (.xlsx / .xls / .csv)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload a supplier stock sheet to automatically add new medicines or increment stock quantities of existing medicines.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => exportCurrentStockToExcel(inventory)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                  title="Export live inventory register as Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Export Live Stock (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={downloadStockTemplateExcel}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  Download Template (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Excel Stock File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {excelError && (
              <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-900/70 text-xs text-red-300">
                {excelError}
              </div>
            )}

            {parsedExcelRows.length > 0 && (
              <div className="p-4 rounded-lg bg-[#0B1120] border border-sky-500/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-sky-300">
                    Preview: {parsedExcelRows.length} medicines parsed from Excel
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setParsedExcelRows([])}
                      className="px-3 py-1.5 rounded-md border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={importingExcel}
                      onClick={handleCommitExcelRows}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 text-xs font-semibold cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {importingExcel
                        ? "Importing to Database..."
                        : `Import ${parsedExcelRows.length} Items to Stock`}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2 pr-3 font-medium">Medicine Name</th>
                        <th className="py-2 px-2 font-medium">Category</th>
                        <th className="py-2 px-2 font-medium text-right">Qty Added</th>
                        <th className="py-2 px-2 font-medium text-right">Unit Price</th>
                        <th className="py-2 pl-2 font-medium">Supplier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {parsedExcelRows.slice(0, 10).map((row, idx) => (
                        <tr key={idx}>
                          <td className="py-2 pr-3 font-medium">{row.name}</td>
                          <td className="py-2 px-2 text-slate-400">{row.category}</td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums text-emerald-400">
                            +{row.stock} {row.unit}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums">
                            {formatINR(row.unitPrice)}
                          </td>
                          <td className="py-2 pl-2 text-slate-400">{row.supplier}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Live Stock Table + Manual Add */}
          <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  Live Pharmacy Stock
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Adjust quantities inline or manually add individual medicines.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    placeholder="Search stock..."
                    className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 focus:border-sky-500 focus:outline-none text-xs text-slate-200 w-44"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddStockForm((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-200 whitespace-nowrap cursor-pointer"
                >
                  <PackagePlus className="w-3.5 h-3.5 text-sky-400" />
                  {showAddStockForm ? "Close Form" : "Add Medicine"}
                </button>
              </div>
            </div>

            {showAddStockForm && (
              <form
                onSubmit={handleManualAddStock}
                className="p-4 rounded-lg bg-[#0B1120] border border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
              >
                <div className="lg:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">Medicine Name</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., Amoxicillin 500mg Capsules"
                    className="w-full px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as InventoryCategory)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-800 text-xs text-slate-100"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Unit Price (INR)</label>
                  <input
                    type="number"
                    min={0}
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Opening Stock</label>
                  <input
                    type="number"
                    min={0}
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Unit Label</label>
                  <input
                    type="text"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Min Reorder Level</label>
                  <input
                    type="number"
                    min={1}
                    value={newThreshold}
                    onChange={(e) => setNewThreshold(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Supplier</label>
                  <input
                    type="text"
                    value={newSupplier}
                    onChange={(e) => setNewSupplier(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={newExpiry}
                    onChange={(e) => setNewExpiry(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Est. Daily Usage</label>
                  <input
                    type="number"
                    min={1}
                    value={newDailyUsage}
                    onChange={(e) => setNewDailyUsage(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>
                <div className="sm:col-span-2 flex items-end justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold cursor-pointer"
                  >
                    Save to Pharmacy Stock
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400">
                    <th className="py-3 pr-4 font-medium">Medicine & Supplier</th>
                    <th className="py-3 px-3 font-medium">Category</th>
                    <th className="py-3 px-3 font-medium text-right">Unit Price</th>
                    <th className="py-3 px-3 font-medium text-right">Stock / Threshold</th>
                    <th className="py-3 pl-3 font-medium text-right">Adjust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-sm">
                  {filteredInventory.map((item) => {
                    const isLow = item.stock <= item.minThreshold;
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 pr-4">
                          <div className="font-medium text-slate-100">{item.name}</div>
                          <div className="text-xs text-slate-500">
                            {item.supplier} · Exp {item.expiryDate}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-400">{item.category}</td>
                        <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-slate-200">
                          {formatINR(item.unitPrice)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-xs tabular-nums">
                          <span className={isLow ? "text-amber-400 font-semibold" : "text-slate-100"}>
                            {item.stock} {item.unit}
                          </span>
                          <div className="text-slate-500">Min {item.minThreshold}</div>
                        </td>
                        <td className="py-3 pl-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => adjustInventoryStock(item.id, -5)}
                              className="p-1.5 rounded-md border border-slate-700 hover:bg-slate-800 text-slate-300 cursor-pointer"
                              aria-label={`Decrease ${item.name} by 5`}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustInventoryStock(item.id, 10)}
                              className="p-1.5 rounded-md border border-slate-700 hover:bg-slate-800 text-emerald-400 cursor-pointer"
                              aria-label={`Increase ${item.name} by 10`}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: Total Sales Ledger & Excel Export */}
      {tab === "sales_ledger" && (
        <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Total Pharmacy Sales Ledger
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every completed bill is saved to Firestore — download any individual bill as a printable A4 PDF or export all sales to Excel.
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportSalesToExcel(pharmacySales, inventory)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Total Sales to Excel (.xlsx)
            </button>
          </div>

          {pharmacySales.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <div className="text-sm text-slate-400">No sales bills recorded yet.</div>
              <button
                type="button"
                onClick={handleLoadSamplePharmacy}
                disabled={seedingPharmacy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-sky-500/50 bg-sky-500/10 hover:bg-sky-500/20 text-xs font-medium text-sky-300 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                {seedingPharmacy ? "Loading Sample Bills..." : "Load Sample Medicines & Bills"}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400">
                    <th className="py-3 pr-4 font-medium">Bill & Time</th>
                    <th className="py-3 px-3 font-medium">Patient / Doctor</th>
                    <th className="py-3 px-3 font-medium">Medicines Dispensed</th>
                    <th className="py-3 px-3 font-medium">Payment</th>
                    <th className="py-3 px-3 font-medium text-right">Amount</th>
                    <th className="py-3 pl-3 font-medium text-right">Print Bill</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-sm">
                  {pharmacySales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-800/30">
                      <td className="py-3.5 pr-4">
                        <div className="font-mono text-xs font-semibold text-slate-100">
                          {sale.billNumber}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{sale.soldAtLabel}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="text-slate-100 font-medium">{sale.patientName}</div>
                        <div className="text-xs text-slate-400">{sale.doctorName}</div>
                      </td>
                      <td className="py-3.5 px-3 text-xs text-slate-300">
                        {sale.items.map((i) => `${i.itemName} (×${i.quantity})`).join(", ")}
                      </td>
                      <td className="py-3.5 px-3 text-xs text-slate-400">
                        {sale.paymentMethod}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-semibold text-emerald-400 tabular-nums">
                        {formatINR(sale.totalAmount)}
                      </td>
                      <td className="py-3.5 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => exportPharmacyBillToPdf(sale)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-700 hover:border-sky-500/60 hover:bg-sky-500/10 text-xs font-medium text-sky-300 transition-colors whitespace-nowrap cursor-pointer"
                          title={`Download printable PDF for ${sale.billNumber}`}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 4: AI Sales Velocity & Restock Advisor */}
      {tab === "ai_insights" && (
        <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                AI Top-Selling & Restock Advisor
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Analyzes live pharmacy sales, daily consumption, and pending doctor prescriptions to recommend what sells fastest and what to restock next.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunPharmacyAI}
              disabled={loadingInsights}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              {loadingInsights ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {loadingInsights ? "Running AI Analysis..." : "Refresh AI Suggestions"}
            </button>
          </div>

          {insightsError && (
            <div className="p-4 rounded-lg bg-red-950/40 border border-red-900/70 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-red-300">{insightsError.message}</p>
                {insightsError.hint && (
                  <p className="text-xs text-red-400 mt-0.5">{insightsError.hint}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleRunPharmacyAI}
                className="px-3 py-1.5 rounded-md border border-red-700 text-xs font-medium text-red-200 hover:bg-red-900/40 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {loadingInsights && (
            <div className="space-y-3 animate-pulse">
              <div className="h-5 w-1/2 bg-slate-800 rounded" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-44 bg-slate-800/70 rounded-lg" />
                <div className="h-44 bg-slate-800/70 rounded-lg" />
              </div>
            </div>
          )}

          {!loadingInsights && !insights && !insightsError && (
            <div className="py-10 text-center space-y-3">
              <Sparkles className="w-7 h-7 text-sky-400 mx-auto" />
              <p className="text-sm text-slate-300">
                Click <span className="font-semibold text-slate-100">Refresh AI Suggestions</span>{" "}
                to see which medicines are selling fastest and which stock needs replenishment first.
              </p>
            </div>
          )}

          {!loadingInsights && insights && (
            <div className="space-y-6">
              <p className="text-sm text-slate-200 font-medium">{insights.headline}</p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Fast-Moving / Top Selling */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Fastest-Selling Medicines
                  </h3>
                  <div className="space-y-2.5">
                    {insights.topSellingItems.map((top, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-lg bg-[#0B1120] border border-slate-800 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-slate-100">
                            {i + 1}. {top.itemName}
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {top.trendNote}
                          </p>
                        </div>
                        <div className="text-right shrink-0 font-mono tabular-nums">
                          <div className="text-xs font-semibold text-emerald-400">
                            {top.unitsSold} units
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {formatINR(top.revenue)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Priority Restock Suggestions */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    Recommended Stock Additions
                  </h3>
                  <div className="space-y-2.5">
                    {insights.restockSuggestions.map((sug) => {
                      const done = restockedIds.includes(sug.itemId);
                      const urgencyColor =
                        sug.urgency === "Immediate"
                          ? "text-red-400"
                          : sug.urgency === "High"
                            ? "text-amber-400"
                            : "text-sky-400";
                      return (
                        <div
                          key={sug.itemId}
                          className="p-4 rounded-lg bg-[#0B1120] border border-slate-800 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-slate-100">
                                {sug.itemName}
                              </div>
                              <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                                Current: {sug.currentStock} · Add +{sug.recommendedAddQty}
                              </div>
                            </div>
                            <span className={`text-xs font-semibold ${urgencyColor}`}>
                              {sug.urgency}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{sug.reason}</p>
                          <button
                            type="button"
                            disabled={done}
                            onClick={() =>
                              handleApproveRestock(sug.itemId, sug.recommendedAddQty)
                            }
                            className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                              done
                                ? "bg-emerald-950/60 border border-emerald-800/70 text-emerald-300"
                                : "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100"
                            }`}
                          >
                            {done ? (
                              <>
                                <Check className="w-3.5 h-3.5" /> Added +{sug.recommendedAddQty} to
                                Stock
                              </>
                            ) : (
                              `Approve Restock (+${sug.recommendedAddQty})`
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      <CallDoctorModal
        isOpen={showCallDoctor}
        onClose={() => setShowCallDoctor(false)}
        callerRole="pharmacist"
      />
    </div>
  );
}
