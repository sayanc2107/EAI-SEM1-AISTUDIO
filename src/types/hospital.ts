export type UserRole = "admin" | "doctor" | "pharmacist" | "ward_staff" | "nurse" | "accountant";

export type SeverityLevel = "Critical" | "Urgent" | "Moderate" | "Routine";
export type WardType = "ICU" | "Emergency" | "Cardiology" | "General";
export type BedStatus = "Available" | "Occupied" | "Cleaning";
export type DoctorStatus = "On Duty" | "In Surgery" | "On Call" | "Off Duty";
export type ShiftType = "Morning" | "Evening" | "Night";
export type InventoryCategory = "Medication" | "Critical Care" | "Diagnostics" | "PPE";
export type PrescriptionStatus = "Pending" | "Preparing" | "Ready" | "Dispensed";
export type PaymentMethod = "UPI" | "Card" | "Cash" | "Insurance";

export type WorkspaceTab =
  | "overview"
  | "triage"
  | "wards"
  | "pharmacy"
  | "finance"
  | "payroll"
  | "duty_roster"
  | "copilot"
  | "staff_admin"
  | "doctor_portal"
  | "doctor_shift"
  | "doctor_patients"
  | "doctor_prescriptions"
  | "doctor_library"
  | "pharmacist_portal"
  | "pharma_overview"
  | "pharma_prescriptions"
  | "pharma_inventory"
  | "pharma_billing"
  | "ward_portal"
  | "ward_shift"
  | "ward_beds"
  | "ward_doctors"
  | "ward_ai"
  | "nurse_portal"
  | "nurse_station"
  | "nurse_patients"
  | "nurse_doctors"
  | "nurse_prescriptions"
  | "acc_overview"
  | "acc_sales"
  | "acc_payroll"
  | "acc_staff";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  linkedStaffId: string;
}

export interface StaffDirectoryEntry {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  linkedStaffId: string;
  department: string;
}

export interface StaffShift {
  staffId: string;
  ownerEmail: string;
  name: string;
  role: UserRole;
  specialty: string;
  location: string;
  status: DoctorStatus;
  shiftName: ShiftType;
  shiftStart: string;
  shiftEnd: string;
  breakWindow?: string;
  assignedWard: string;
  assignedDoctorIds?: string[];
  activePatientsCount: number;
  maxCapacity: number;
  avatarUrl?: string;
  initials: string;
}

export interface DoctorLocation {
  doctorId: string;
  name: string;
  specialty: string;
  location: string;
  status: DoctorStatus;
  shiftEnd: string;
  activePatientsCount: number;
  maxCapacity: number;
  avatarUrl?: string;
  initials: string;
}

export interface PatientVitals {
  heartRate: number;
  bloodPressure: string;
  spo2: number;
  temperature: number;
}

export interface PatientVitalsRecord {
  id: string;
  timestamp: string;
  timeLabel: string;
  heartRate: number;
  systolic: number;
  diastolic: number;
  bloodPressure: string;
  spo2: number;
  temperature: number;
  loggedBy: string;
  notes?: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: "Female" | "Male" | "Other";
  symptoms: string;
  vitals: PatientVitals;
  vitalsHistory?: PatientVitalsRecord[];
  severity: SeverityLevel;
  department: string;
  assignedBedId: string;
  assignedDoctorId: string;
  assignedNurseId: string;
  status: "Admitted" | "Discharged";
  aiSummary: string;
  recommendedActions: string[];
  admittedAt: string;
  createdByUid: string;
}

export interface StaffDuty {
  id: string;
  staffId: string;
  staffName: string;
  role: UserRole;
  dutyTitle: string;
  category: "Emergency" | "ICU" | "OPD" | "Wards" | "OT" | "General";
  wardOrLocation: string;
  shiftName: ShiftType;
  shiftStart: string;
  shiftEnd: string;
  date: string;
  priority: "Routine" | "Moderate" | "Urgent" | "Critical";
  assignedBy: string;
  status: "Assigned" | "In Progress" | "Completed";
  notes?: string;
  createdAt: string;
}

export type FinancialDepartment =
  | "Pharmacy"
  | "OPD"
  | "ICU"
  | "Emergency"
  | "Surgery"
  | "Laboratory"
  | "Radiology";

export interface HospitalSale {
  id: string;
  invoiceNumber: string;
  department: FinancialDepartment;
  patientId?: string;
  patientName: string;
  doctorName?: string;
  serviceDescription: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: "Paid" | "Pending" | "Partially Paid";
  date: string;
  soldAtLabel: string;
  recordedBy: string;
  notes?: string;
}

export type PayrollStatus = "Paid" | "Pending" | "Processing";

export interface StaffPayrollRecord {
  id: string;
  staffId: string;
  staffName: string;
  role: UserRole;
  department: string;
  designation: string;
  bankName: string;
  bankAccountNumber: string;
  ifscOrSwift: string;
  monthYear: string;
  baseSalary: number;
  allowances: number;
  bonus: number;
  overtimeHours: number;
  overtimePay: number;
  deductions: number;
  netSalary: number;
  status: PayrollStatus;
  paidAt?: string;
  paidBy?: string;
  transactionReference?: string;
  notes?: string;
}

export interface Bed {
  id: string;
  ward: WardType;
  status: BedStatus;
  patientId: string | null;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  shift: ShiftType;
  shiftStart: string;
  shiftEnd: string;
  location: string;
  status: DoctorStatus;
  activePatientsCount: number;
  maxCapacity: number;
  avatarUrl?: string;
  initials: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  stock: number;
  unit: string;
  unitPrice: number;
  minThreshold: number;
  expiryDate: string;
  supplier: string;
  dailyUsage: number;
}

export interface PrescriptionLineItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  dosage: string;
}

export interface PrescriptionRequest {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  doctorUid: string;
  items: PrescriptionLineItem[];
  notes: string;
  priority: "Stat" | "Urgent" | "Standard";
  status: PrescriptionStatus;
  estimatedTotal: number;
  createdAtLabel?: string;
}

export interface PharmacySale {
  id: string;
  billNumber: string;
  prescriptionId?: string | null;
  patientName: string;
  doctorName: string;
  pharmacistUid: string;
  pharmacistName: string;
  items: PrescriptionLineItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  soldAtLabel: string;
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  actor:
    | "AI Triage"
    | "AI Optimizer"
    | "AI Forecast"
    | "Doctor"
    | "Pharmacist"
    | "Ward Staff"
    | "Nurse"
    | "Staff";
  message: string;
  category: "triage" | "wards" | "pharmacy" | "nursing" | "system";
  createdByUid?: string;
}

export interface TriageAIResult {
  severity: SeverityLevel;
  department: string;
  recommendedWard: WardType;
  suggestedBedId: string;
  suggestedDoctorId: string;
  clinicalSummary: string;
  immediateActions: string[];
  estimatedWaitMinutes: number;
}

export interface OptimizationRecommendation {
  id: string;
  title: string;
  detail: string;
  impact: string;
  actionType: "clear_cleaning_beds" | "activate_oncall_doctor" | "advisory";
  targetId: string;
}

export interface OptimizationAIResult {
  overallStatus: string;
  riskSummary: string;
  bottlenecks: string[];
  recommendations: OptimizationRecommendation[];
}

export interface ForecastProjectedItem {
  itemId: string;
  itemName: string;
  daysRemaining: number;
  recommendedOrderQty: number;
  priority: "Immediate" | "Soon" | "Routine";
  rationale: string;
}

export interface ForecastAIResult {
  forecastHeadline: string;
  urgentRiskCount: number;
  projectedItems: ForecastProjectedItem[];
}

export interface PharmacyInsightsAIResult {
  headline: string;
  topSellingItems: {
    itemName: string;
    unitsSold: number;
    revenue: number;
    trendNote: string;
  }[];
  restockSuggestions: {
    itemId: string;
    itemName: string;
    currentStock: number;
    recommendedAddQty: number;
    urgency: "Immediate" | "High" | "Watch";
    reason: string;
  }[];
}

export interface WardCallPrediction {
  id: string;
  targetZone: string;
  bedOrRoom: string;
  urgency: "Immediate" | "Soon" | "Watch";
  etaMinutes: number;
  reason: string;
  recommendedPrep: string;
}

export interface WardCallPredictAIResult {
  summary: string;
  predictions: WardCallPrediction[];
}

export interface NurseNextAction {
  id: string;
  priorityRank: number;
  patientName: string;
  bedId: string;
  actionTitle: string;
  clinicalReason: string;
  doctorToCall: string;
  dueWindow: string;
}

export interface NurseNextActionAIResult {
  shiftFocusSummary: string;
  nextActions: NurseNextAction[];
}

export interface BriefingAIResult {
  headline: string;
  operationalMood: string;
  keyHighlights: string[];
  immediatePriorities: string[];
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  referencedFacts?: string[];
  suggestedFollowUps?: string[];
}

export interface ToastNotice {
  id: string;
  title: string;
  detail?: string;
  tone: "info" | "success" | "warning";
}
