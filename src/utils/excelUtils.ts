import * as XLSX from "xlsx";
import type { InventoryCategory, InventoryItem, PharmacySale } from "../types/hospital";

const VALID_CATEGORIES: InventoryCategory[] = [
  "Medication",
  "Critical Care",
  "Diagnostics",
  "PPE",
];

function normalizeCategory(raw: unknown): InventoryCategory {
  const str = String(raw ?? "").trim().toLowerCase();
  const match = VALID_CATEGORIES.find((c) => c.toLowerCase() === str);
  if (match) return match;
  if (str.includes("crit") || str.includes("icu") || str.includes("oxygen")) return "Critical Care";
  if (str.includes("diag") || str.includes("test") || str.includes("kit")) return "Diagnostics";
  if (str.includes("ppe") || str.includes("mask") || str.includes("glove")) return "PPE";
  return "Medication";
}

export interface ParsedStockRow {
  name: string;
  category: InventoryCategory;
  stock: number;
  unit: string;
  unitPrice: number;
  minThreshold: number;
  supplier: string;
  expiryDate: string;
  dailyUsage: number;
}

export async function parseStockExcelFile(file: File): Promise<ParsedStockRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("The uploaded Excel file has no worksheets.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  if (rawRows.length === 0) {
    throw new Error("No rows found in the uploaded Excel sheet.");
  }

  const parsed: ParsedStockRow[] = [];
  for (const row of rawRows) {
    // Support flexible column casing
    const lookup = (keys: string[]): unknown => {
      for (const k of Object.keys(row)) {
        const lower = k.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        if (keys.includes(lower)) return row[k];
      }
      return undefined;
    };

    const name = String(lookup(["name", "medicine", "medicinename", "item", "itemname", "product"]) ?? "").trim();
    if (!name) continue;

    const stock = Math.max(0, Math.round(Number(lookup(["stock", "qty", "quantity", "addstock"])) || 0));
    const unitPrice = Math.max(0, Number(lookup(["unitprice", "price", "rate", "mrp", "cost"])) || 120);
    const minThreshold = Math.max(1, Math.round(Number(lookup(["minthreshold", "minstock", "reorderlevel", "threshold"])) || 20));
    const dailyUsage = Math.max(1, Math.round(Number(lookup(["dailyusage", "usage", "dailyburn"])) || 5));
    const unit = String(lookup(["unit", "units", "pack"]) || "units").trim().slice(0, 30);
    const supplier = String(lookup(["supplier", "vendor", "manufacturer"]) || "Apex Pharma Supply").trim().slice(0, 100);
    const expiryDate = String(lookup(["expirydate", "expiry", "exp"]) || "2027-12-31").trim().slice(0, 20);
    const category = normalizeCategory(lookup(["category", "type", "group"]));

    parsed.push({
      name: name.slice(0, 120),
      category,
      stock,
      unit,
      unitPrice,
      minThreshold,
      supplier,
      expiryDate,
      dailyUsage,
    });
  }

  if (parsed.length === 0) {
    throw new Error(
      "Could not find valid medicine rows. Include columns like Name, Category, Stock, Unit, UnitPrice."
    );
  }

  return parsed;
}

export function downloadStockTemplateExcel(): void {
  const sampleRows = [
    {
      Name: "Paracetamol 650mg IV Infusion",
      Category: "Medication",
      Stock: 60,
      Unit: "bottles",
      UnitPrice: 145,
      MinThreshold: 25,
      Supplier: "MedBridge Labs",
      ExpiryDate: "2027-10-15",
      DailyUsage: 12,
    },
    {
      Name: "Epinephrine 1mg Auto-Injectors",
      Category: "Critical Care",
      Stock: 35,
      Unit: "vials",
      UnitPrice: 480,
      MinThreshold: 25,
      Supplier: "Apex Pharma Supply",
      ExpiryDate: "2027-08-20",
      DailyUsage: 6,
    },
    {
      Name: "Azithromycin 500mg Tablets (Strip of 5)",
      Category: "Medication",
      Stock: 80,
      Unit: "strips",
      UnitPrice: 115,
      MinThreshold: 30,
      Supplier: "BioCare Therapeutics",
      ExpiryDate: "2027-09-01",
      DailyUsage: 14,
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  XLSX.utils.book_append_sheet(wb, ws, "StockImport");
  XLSX.writeFile(wb, "MedCore_Stock_Import_Template.xlsx");
}

export function exportSalesToExcel(
  sales: PharmacySale[],
  inventory?: InventoryItem[]
): void {
  const ledgerRows = sales.map((s) => ({
    "Bill Number": s.billNumber,
    "Date & Time": s.soldAtLabel,
    "Patient / Customer": s.patientName,
    "Prescribing Doctor": s.doctorName || "Walk-In",
    "Billed By": s.pharmacistName,
    "Payment Method": s.paymentMethod,
    "Medicines Sold": s.items
      .map((i) => `${i.itemName} (x${i.quantity})`)
      .join("; "),
    "Total Units": s.items.reduce((acc, i) => acc + i.quantity, 0),
    "Total Amount (INR)": s.totalAmount,
  }));

  // Aggregate per-medicine sales summary
  const summaryMap = new Map<
    string,
    { name: string; unitsSold: number; revenue: number; currentStock: number | string }
  >();

  for (const s of sales) {
    for (const item of s.items) {
      const existing = summaryMap.get(item.itemName);
      const lineRev = item.quantity * item.unitPrice;
      if (existing) {
        existing.unitsSold += item.quantity;
        existing.revenue += lineRev;
      } else {
        const invMatch = inventory?.find(
          (inv) => inv.id === item.itemId || inv.name.toLowerCase() === item.itemName.toLowerCase()
        );
        summaryMap.set(item.itemName, {
          name: item.itemName,
          unitsSold: item.quantity,
          revenue: lineRev,
          currentStock: invMatch ? invMatch.stock : "N/A",
        });
      }
    }
  }

  const summaryRows = Array.from(summaryMap.values())
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .map((entry) => ({
      "Medicine Name": entry.name,
      "Total Units Sold": entry.unitsSold,
      "Total Revenue (INR)": entry.revenue,
      "Current Stock Left": entry.currentStock,
    }));

  const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  summaryRows.push({
    "Medicine Name": "GRAND TOTAL",
    "Total Units Sold": summaryRows.reduce(
      (sum, r) => sum + Number(r["Total Units Sold"] || 0),
      0
    ),
    "Total Revenue (INR)": totalRevenue,
    "Current Stock Left": "-",
  });

  const wb = XLSX.utils.book_new();
  const wsLedger = XLSX.utils.json_to_sheet(
    ledgerRows.length > 0
      ? ledgerRows
      : [{ Notice: "No sales recorded yet." }]
  );
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);

  XLSX.utils.book_append_sheet(wb, wsLedger, "Total Sales Ledger");
  XLSX.utils.book_append_sheet(wb, wsSummary, "Medicine Sales Summary");
  XLSX.writeFile(wb, "MedCore_Pharmacy_Total_Sales.xlsx");
}

export function exportCurrentStockToExcel(inventory: InventoryItem[]): void {
  const stockRows: Record<string, unknown>[] = inventory.map((item) => ({
    "Item ID": item.id,
    "Medicine / Supply Name": item.name,
    "Category": item.category,
    "Current Stock": item.stock,
    "Unit": item.unit,
    "Unit Price (INR)": item.unitPrice,
    "Total Valuation (INR)": item.stock * item.unitPrice,
    "Reorder Threshold": item.minThreshold,
    "Stock Status":
      item.stock <= item.minThreshold
        ? "CRITICAL RESTOCK"
        : item.stock <= item.minThreshold * 1.5
        ? "Low Stock Warning"
        : "Adequate",
    "Expiry Date": item.expiryDate,
    "Supplier": item.supplier,
    "Daily Usage": item.dailyUsage,
  }));

  const totalValuation = inventory.reduce((acc, i) => acc + i.stock * i.unitPrice, 0);
  const totalUnits = inventory.reduce((acc, i) => acc + i.stock, 0);

  stockRows.push({
    "Item ID": "TOTALS",
    "Medicine / Supply Name": `Total Live Inventory (${inventory.length} SKUs)`,
    "Category": "-",
    "Current Stock": totalUnits,
    "Unit": "Units",
    "Unit Price (INR)": 0,
    "Total Valuation (INR)": totalValuation,
    "Reorder Threshold": 0,
    "Stock Status": "-",
    "Expiry Date": "-",
    "Supplier": "-",
    "Daily Usage": inventory.reduce((acc, i) => acc + i.dailyUsage, 0),
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(stockRows);
  XLSX.utils.book_append_sheet(wb, ws, "Current Medicine Stock");
  XLSX.writeFile(wb, `MedCore_Pharmacy_Live_Stock_${new Date().toISOString().split("T")[0]}.xlsx`);
}
