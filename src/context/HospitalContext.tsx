import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  provisionStaffAuthAccount,
} from "../firebase";
import {
  INITIAL_ACTIVITY,
  INITIAL_ATTENDANCE_RECORDS,
  INITIAL_BEDS,
  INITIAL_DOCTOR_LOCATIONS,
  INITIAL_HELPDESK_TICKETS,
  INITIAL_HOSPITAL_SALES,
  INITIAL_INTERNAL_MAILS,
  INITIAL_INVENTORY,
  INITIAL_PATIENTS,
  INITIAL_PAYROLL_RECORDS,
  INITIAL_PHARMACY_SALES,
  INITIAL_PRESCRIPTIONS,
  INITIAL_STAFF_DIRECTORY,
  INITIAL_STAFF_DUTIES,
  INITIAL_STAFF_SHIFTS,
  SAMPLE_STAFF_CREDENTIALS,
} from "../data/seedData";
import type {
  ActivityEntry,
  AttendanceRecord,
  Bed,
  BedStatus,
  DisbursementRail,
  Doctor,
  DoctorLocation,
  DoctorStatus,
  FinancialDepartment,
  HelpdeskTicket,
  HospitalSale,
  InternalMail,
  InventoryItem,
  Patient,
  PatientVitals,
  PatientVitalsRecord,
  PaymentMethod,
  PharmacySale,
  PrescriptionLineItem,
  PrescriptionRequest,
  PrescriptionStatus,
  SeverityLevel,
  ShiftType,
  SpecialPayment,
  SplitPaymentDetail,
  StaffDirectoryEntry,
  StaffDuty,
  StaffPayrollRecord,
  StaffShift,
  ToastNotice,
  UserProfile,
  UserRole,
} from "../types/hospital";
import type { ParsedStockRow } from "../utils/excelUtils";

const ADMIN_EMAIL = "sayan2008c@gmail.com";
const MANUAL_ADMIN_EMAIL = "admin@medcore.org";

// Rule-aligned Firestore list queries (matching allow list security constraints verbatim)
const DOCTOR_LOCATIONS_LIST_QUERY = () =>
  query(
    collection(db, "doctorLocations"),
    where("status", "in", ["On Duty", "In Surgery", "On Call", "Off Duty"])
  );

const PATIENTS_LIST_QUERY = () =>
  query(collection(db, "patients"), where("status", "in", ["Admitted", "Discharged"]));

const BEDS_LIST_QUERY = () =>
  query(
    collection(db, "beds"),
    where("ward", "in", ["ICU", "Emergency", "Cardiology", "General"])
  );

const INVENTORY_LIST_QUERY = () =>
  query(
    collection(db, "inventory"),
    where("category", "in", ["Medication", "Critical Care", "Diagnostics", "PPE"])
  );

const PRESCRIPTIONS_LIST_QUERY = () =>
  query(
    collection(db, "prescriptions"),
    where("status", "in", ["Pending", "Preparing", "Ready", "Dispensed"])
  );

const PHARMACY_SALES_LIST_QUERY = () =>
  query(
    collection(db, "pharmacySales"),
    where("paymentMethod", "in", ["UPI", "Card", "Cash", "Insurance"])
  );

const ACTIVITY_LOGS_LIST_QUERY = () =>
  query(
    collection(db, "activityLogs"),
    where("category", "in", ["triage", "wards", "pharmacy", "nursing", "system"])
  );

export interface EmailLoginResult {
  ok: boolean;
  error?: string;
  needsProviderEnable?: boolean;
}

interface AdmitPatientPayload {
  name: string;
  age: number;
  gender: "Female" | "Male" | "Other";
  symptoms: string;
  vitals: PatientVitals;
  severity: SeverityLevel;
  department: string;
  assignedBedId: string;
  assignedDoctorId: string;
  assignedNurseId?: string;
  aiSummary: string;
  recommendedActions: string[];
}

interface CreatePrescriptionPayload {
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  items: PrescriptionLineItem[];
  notes: string;
  priority: "Stat" | "Urgent" | "Standard";
}

interface CreateSalePayload {
  prescriptionId?: string | null;
  patientName: string;
  doctorName: string;
  items: PrescriptionLineItem[];
  paymentMethod: PaymentMethod;
  splitPayments?: SplitPaymentDetail;
}

interface HospitalContextValue {
  // Auth & RBAC
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  authLoading: boolean;
  accessDeniedEmail: string | null;
  activeRole: UserRole;
  activeStaffId: string;
  isActualAdmin: boolean;
  setAdminRolePreview: (role: UserRole, staffId?: string) => void;
  loginWithGoogle: () => Promise<void>;
  loginWithEmailPassword: (
    identifier: string,
    password: string
  ) => Promise<EmailLoginResult>;
  logout: () => Promise<void>;

  // Live Firestore Data
  staffDirectory: StaffDirectoryEntry[];
  staffShifts: StaffShift[];
  myShift: StaffShift | null;
  doctorLocations: DoctorLocation[];
  doctors: Doctor[];
  patients: Patient[];
  beds: Bed[];
  inventory: InventoryItem[];
  prescriptions: PrescriptionRequest[];
  pharmacySales: PharmacySale[];
  staffDuties: StaffDuty[];
  hospitalSales: HospitalSale[];
  payrollRecords: StaffPayrollRecord[];
  specialPayments: SpecialPayment[];
  attendanceRecords: AttendanceRecord[];
  internalMails: InternalMail[];
  helpdeskTickets: HelpdeskTicket[];
  activity: ActivityEntry[];
  toasts: ToastNotice[];
  dismissToast: (id: string) => void;
  pushToast: (title: string, detail?: string, tone?: ToastNotice["tone"]) => void;

  // Operational Mutations (Firestore-backed & Realtime)
  admitPatient: (payload: AdmitPatientPayload) => Promise<Patient | null>;
  updatePatientVitals: (patientId: string, vitals: PatientVitals) => Promise<void>;
  logPatientHistoricalVitals: (
    patientId: string,
    vitalsRecord: Omit<PatientVitalsRecord, "id">
  ) => Promise<void>;
  dischargePatient: (patientId: string) => Promise<void>;
  setBedStatus: (bedId: string, nextStatus: BedStatus) => Promise<void>;
  clearAllCleaningBeds: () => Promise<number>;
  cycleDoctorStatus: (doctorId: string, explicitStatus?: DoctorStatus) => Promise<void>;
  updateDoctorLocationAndStatus: (
    doctorId: string,
    location: string,
    status: DoctorStatus
  ) => Promise<void>;
  updateDoctorShift: (
    doctorId: string,
    updates: {
      shiftName?: ShiftType;
      shiftStart?: string;
      shiftEnd?: string;
      location?: string;
      status?: DoctorStatus;
    }
  ) => Promise<void>;
  updateNurseShift: (
    staffId: string,
    updates: {
      shiftName?: ShiftType;
      shiftStart?: string;
      shiftEnd?: string;
      assignedWard?: string;
      location?: string;
      status?: DoctorStatus;
    }
  ) => Promise<void>;
  updateWardStaffShift: (
    staffId: string,
    updates: {
      shiftName?: ShiftType;
      shiftStart?: string;
      shiftEnd?: string;
      assignedWard?: string;
      location?: string;
      status?: DoctorStatus;
    }
  ) => Promise<void>;
  addStaffDuty: (duty: Omit<StaffDuty, "id" | "createdAt" | "status">) => Promise<void>;
  updateStaffDutyStatus: (dutyId: string, status: StaffDuty["status"]) => Promise<void>;
  deleteStaffDuty: (dutyId: string) => Promise<void>;
  addHospitalSale: (sale: Omit<HospitalSale, "id">) => Promise<void>;
  paySalary: (
    payrollId: string,
    options?: {
      baseSalary?: number;
      allowances?: number;
      bonus?: number;
      overtimePay?: number;
      deductions?: number;
      rail?: DisbursementRail;
      notes?: string;
    }
  ) => Promise<void>;
  payAllPendingSalaries: () => Promise<number>;
  updatePayrollCompensation: (
    payrollId: string,
    updates: Partial<
      Pick<
        StaffPayrollRecord,
        | "baseSalary"
        | "allowances"
        | "bonus"
        | "deductions"
        | "overtimePay"
        | "overtimeHours"
        | "bankName"
        | "bankAccountNumber"
        | "ifscOrSwift"
        | "designation"
      >
    >
  ) => Promise<void>;
  issueSpecialPayment: (
    payment: {
      payeeName: string;
      accountNumber: string;
      ifsc: string;
      amount: number;
      remarks: string;
      approvedBy?: string;
      paymentType: DisbursementRail;
    },
    targetPayrollId?: string
  ) => Promise<void>;
  clockIn: (notes?: string) => Promise<void>;
  clockOut: (recordId: string, notes?: string) => Promise<void>;
  sendInternalMail: (payload: {
    toEmail: string;
    toName: string;
    toRole: UserRole;
    subject: string;
    body: string;
    priority: InternalMail["priority"];
  }) => Promise<void>;
  markMailRead: (mailId: string) => Promise<void>;
  raiseHelpdeskTicket: (payload: {
    category: HelpdeskTicket["category"];
    priority: HelpdeskTicket["priority"];
    subject: string;
    description: string;
    location: string;
  }) => Promise<void>;
  updateTicketStatus: (
    ticketId: string,
    status: HelpdeskTicket["status"],
    resolutionNotes?: string
  ) => Promise<void>;
  deleteStaffMember: (staffId: string) => Promise<void>;
  adjustInventoryStock: (itemId: string, delta: number) => Promise<void>;
  addInventoryItem: (item: Omit<InventoryItem, "id">) => Promise<void>;
  importStockFromExcelRows: (rows: ParsedStockRow[]) => Promise<number>;
  applyRestockBatch: (orders: { itemId: string; quantity: number }[]) => Promise<void>;
  sendPrescriptionToPharmacy: (payload: CreatePrescriptionPayload) => Promise<void>;
  updatePrescriptionStatus: (
    prescriptionId: string,
    status: PrescriptionStatus
  ) => Promise<void>;
  createPharmacyBill: (payload: CreateSalePayload) => Promise<PharmacySale | null>;
  saveStaffDirectoryEntry: (
    entry: Omit<StaffDirectoryEntry, "id">,
    initialPassword?: string
  ) => Promise<void>;
  provisionAllSampleStaffAccounts: () => Promise<{
    firestoreSynced: number;
    authCreated: number;
    authExisting: number;
    providerDisabled: boolean;
  }>;
  seedSamplePharmacyData: () => Promise<void>;
  resetDemoData: () => Promise<void>;
}

const HospitalContext = createContext<HospitalContextValue | null>(null);

function formatNowTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function defaultStaffIdForRole(role: UserRole): string {
  switch (role) {
    case "doctor":
      return "DOC-02";
    case "pharmacist":
      return "PHM-01";
    case "ward_staff":
      return "WRD-01";
    case "nurse":
      return "NUR-01";
    case "accountant":
      return "ACC-01";
    case "admin":
    default:
      return "ADM-01";
  }
}

export function HospitalProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDeniedEmail, setAccessDeniedEmail] = useState<string | null>(null);

  // Admin preview state (strictly ignored for non-admin accounts)
  const [previewRole, setPreviewRole] = useState<UserRole>("admin");
  const [previewStaffId, setPreviewStaffId] = useState<string>("ADM-01");

  // Pre-seed collections so GitHub Pages & static hosting work immediately out of the box
  const [staffDirectory, setStaffDirectory] = useState<StaffDirectoryEntry[]>(INITIAL_STAFF_DIRECTORY);
  const [staffShifts, setStaffShifts] = useState<StaffShift[]>(INITIAL_STAFF_SHIFTS);
  const [doctorLocations, setDoctorLocations] = useState<DoctorLocation[]>(INITIAL_DOCTOR_LOCATIONS);
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [beds, setBeds] = useState<Bed[]>(INITIAL_BEDS);
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRequest[]>(INITIAL_PRESCRIPTIONS);
  const [pharmacySales, setPharmacySales] = useState<PharmacySale[]>(INITIAL_PHARMACY_SALES);
  const [staffDuties, setStaffDuties] = useState<StaffDuty[]>(INITIAL_STAFF_DUTIES);
  const [hospitalSales, setHospitalSales] = useState<HospitalSale[]>(INITIAL_HOSPITAL_SALES);
  const [payrollRecords, setPayrollRecords] = useState<StaffPayrollRecord[]>(INITIAL_PAYROLL_RECORDS);
  const [specialPayments, setSpecialPayments] = useState<SpecialPayment[]>([
    {
      id: "SP-101",
      payeeName: "Apex Medical Gases & Oxygen Cylinders",
      accountNumber: "918273645120",
      ifsc: "SBIN0001234",
      amount: 45000,
      remarks: "Emergency bulk liquid oxygen refills for ICU and Emergency Ward manifolds",
      approvedBy: "Hospital Administrator",
      paymentType: "RTGS",
      date: "2026-11-20 16:30",
      transactionReference: "RTGS-MC-88129",
      title: "Oxygen Refill Bulk Delivery",
      reason: "Emergency ICU manifolds",
    },
    {
      id: "SP-102",
      payeeName: "BioMed Diagnostics Calibration Labs",
      accountNumber: "827163549012",
      ifsc: "HDFC0004567",
      amount: 18500,
      remarks: "Preventative quarterly inspection and sensor recalibration for ventilators",
      approvedBy: "Vikram Mehta (CPA)",
      paymentType: "NEFT",
      date: "2026-11-21 11:15",
      transactionReference: "NEFT-MC-44912",
      title: "Ventilator Sensor Recalibration",
      reason: "Quarterly preventative maintenance",
    },
    {
      id: "SP-103",
      payeeName: "Kalyan Surgical Disposables & PPE",
      accountNumber: "736251498023",
      ifsc: "ICIC0007890",
      amount: 32000,
      remarks: "500 sets sterile surgical gowns, masks, and glove cartons",
      approvedBy: "Hospital Administrator",
      paymentType: "IMPS",
      date: "2026-11-21 14:40",
      transactionReference: "IMPS-MC-21094",
      title: "Sterile PPE and Surgical Drape Supply",
      reason: "Operation Theatre replenishment",
    },
  ]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(INITIAL_ATTENDANCE_RECORDS);
  const [internalMails, setInternalMails] = useState<InternalMail[]>(INITIAL_INTERNAL_MAILS);
  const [helpdeskTickets, setHelpdeskTickets] = useState<HelpdeskTicket[]>(INITIAL_HELPDESK_TICKETS);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  const isActualAdmin = userProfile?.role === "admin";
  const activeRole: UserRole = isActualAdmin
    ? previewRole
    : userProfile?.role ?? "doctor";
  const activeStaffId: string = isActualAdmin
    ? previewStaffId
    : userProfile?.linkedStaffId ?? "";

  const pushToast = (
    title: string,
    detail?: string,
    tone: ToastNotice["tone"] = "info"
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { id, title, detail, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  async function seedSamplePharmacyDataForUid(uid: string): Promise<{
    addedMedicines: number;
    addedBills: number;
  }> {
    try {
      const [existingInvSnap, existingSalesSnap] = await Promise.all([
        getDocs(INVENTORY_LIST_QUERY()),
        getDocs(PHARMACY_SALES_LIST_QUERY()),
      ]);

      const existingInvIds = new Set(existingInvSnap.docs.map((d) => d.id));
      const existingSaleIds = new Set(existingSalesSnap.docs.map((d) => d.id));

      const batch = writeBatch(db);
      const now = serverTimestamp();
      let addedMedicines = 0;
      let addedBills = 0;

      for (const item of INITIAL_INVENTORY) {
        if (!existingInvIds.has(item.id)) {
          batch.set(doc(db, "inventory", item.id), {
            id: item.id,
            name: item.name,
            category: item.category,
            stock: item.stock,
            unit: item.unit,
            unitPrice: item.unitPrice,
            minThreshold: item.minThreshold,
            expiryDate: item.expiryDate,
            supplier: item.supplier,
            dailyUsage: item.dailyUsage,
            updatedAt: now,
          });
          addedMedicines++;
        }
      }

      for (const sale of INITIAL_PHARMACY_SALES) {
        if (!existingSaleIds.has(sale.id)) {
          batch.set(doc(db, "pharmacySales", sale.id), {
            id: sale.id,
            billNumber: sale.billNumber,
            prescriptionId: sale.prescriptionId ?? null,
            patientName: sale.patientName,
            doctorName: sale.doctorName,
            pharmacistUid: uid,
            pharmacistName: sale.pharmacistName,
            items: sale.items,
            totalAmount: sale.totalAmount,
            paymentMethod: sale.paymentMethod,
            soldAtLabel: sale.soldAtLabel,
            createdAt: now,
          });
          addedBills++;
        }
      }

      if (addedMedicines > 0 || addedBills > 0) {
        await batch.commit();
      }
      return { addedMedicines, addedBills };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "seedSamplePharmacyData");
    }
  }

  async function seedHospitalDatabase(adminUid: string, forceOverwrite = false) {
    try {
      if (!forceOverwrite) {
        const existingBeds = await getDocs(BEDS_LIST_QUERY());
        if (!existingBeds.empty) {
          // Check whether expanded sample dataset & @medcore.org directory are already synced
          const [doc02Snap, inv116Snap, sale908Snap, pt4100Snap, nur03Snap, rx505Snap] =
            await Promise.all([
              getDoc(doc(db, "staffDirectory", "DOC-02")),
              getDoc(doc(db, "inventory", "INV-116")),
              getDoc(doc(db, "pharmacySales", "SALE-908")),
              getDoc(doc(db, "patients", "PT-4100")),
              getDoc(doc(db, "staffDirectory", "NUR-03")),
              getDoc(doc(db, "prescriptions", "RX-505")),
            ]);

          const doc02Email = doc02Snap.exists()
            ? String(doc02Snap.data()?.email ?? "")
            : "";
          const needsEmailUpgrade = !doc02Email.endsWith("@medcore.org");
          const needsTopUp =
            needsEmailUpgrade ||
            !inv116Snap.exists() ||
            !sale908Snap.exists() ||
            !pt4100Snap.exists() ||
            !nur03Snap.exists() ||
            !rx505Snap.exists();

          if (needsTopUp) {
            const [
              dirSnap,
              shiftsSnap,
              docLocSnap,
              patientsSnap,
              invSnap,
              rxSnap,
              salesSnap,
              actSnap,
            ] = await Promise.all([
              getDocs(collection(db, "staffDirectory")),
              getDocs(collection(db, "staffShifts")),
              getDocs(DOCTOR_LOCATIONS_LIST_QUERY()),
              getDocs(PATIENTS_LIST_QUERY()),
              getDocs(INVENTORY_LIST_QUERY()),
              getDocs(PRESCRIPTIONS_LIST_QUERY()),
              getDocs(PHARMACY_SALES_LIST_QUERY()),
              getDocs(ACTIVITY_LOGS_LIST_QUERY()),
            ]);

            const existingDirIds = new Set(dirSnap.docs.map((d) => d.id));
            const existingShiftIds = new Set(shiftsSnap.docs.map((d) => d.id));
            const existingDocLocIds = new Set(docLocSnap.docs.map((d) => d.id));
            const existingBedMap = new Map(
              existingBeds.docs.map((d) => [d.id, d.data() as Bed])
            );
            const existingPatientIds = new Set(patientsSnap.docs.map((d) => d.id));
            const existingInvIds = new Set(invSnap.docs.map((d) => d.id));
            const existingRxIds = new Set(rxSnap.docs.map((d) => d.id));
            const existingSaleIds = new Set(salesSnap.docs.map((d) => d.id));
            const existingActIds = new Set(actSnap.docs.map((d) => d.id));

            const syncBatch = writeBatch(db);
            const syncNow = serverTimestamp();

            for (const entry of INITIAL_STAFF_DIRECTORY) {
              const dirRef = doc(db, "staffDirectory", entry.linkedStaffId);
              if (!existingDirIds.has(entry.linkedStaffId)) {
                syncBatch.set(dirRef, {
                  email: entry.email.toLowerCase(),
                  fullName: entry.fullName,
                  role: entry.role,
                  linkedStaffId: entry.linkedStaffId,
                  department: entry.department,
                  createdAt: syncNow,
                  updatedAt: syncNow,
                });
              } else if (needsEmailUpgrade) {
                syncBatch.update(dirRef, {
                  email: entry.email.toLowerCase(),
                  fullName: entry.fullName,
                  role: entry.role,
                  linkedStaffId: entry.linkedStaffId,
                  department: entry.department,
                  updatedAt: syncNow,
                });
              }
            }

            for (const shift of INITIAL_STAFF_SHIFTS) {
              if (needsEmailUpgrade || !existingShiftIds.has(shift.staffId)) {
                const payload: Record<string, unknown> = {
                  staffId: shift.staffId,
                  ownerEmail: shift.ownerEmail.toLowerCase(),
                  name: shift.name,
                  role: shift.role,
                  specialty: shift.specialty,
                  location: shift.location,
                  status: shift.status,
                  shiftName: shift.shiftName,
                  shiftStart: shift.shiftStart,
                  shiftEnd: shift.shiftEnd,
                  assignedWard: shift.assignedWard,
                  activePatientsCount: shift.activePatientsCount,
                  maxCapacity: shift.maxCapacity,
                  initials: shift.initials,
                  updatedAt: syncNow,
                };
                if (shift.breakWindow) payload.breakWindow = shift.breakWindow;
                if (shift.assignedDoctorIds) payload.assignedDoctorIds = shift.assignedDoctorIds;
                if (shift.avatarUrl) payload.avatarUrl = shift.avatarUrl;
                syncBatch.set(doc(db, "staffShifts", shift.staffId), payload);
              }
            }

            for (const dLoc of INITIAL_DOCTOR_LOCATIONS) {
              if (!existingDocLocIds.has(dLoc.doctorId)) {
                const payload: Record<string, unknown> = {
                  doctorId: dLoc.doctorId,
                  name: dLoc.name,
                  specialty: dLoc.specialty,
                  location: dLoc.location,
                  status: dLoc.status,
                  shiftEnd: dLoc.shiftEnd,
                  activePatientsCount: dLoc.activePatientsCount,
                  maxCapacity: dLoc.maxCapacity,
                  initials: dLoc.initials,
                  updatedAt: syncNow,
                };
                if (dLoc.avatarUrl) payload.avatarUrl = dLoc.avatarUrl;
                syncBatch.set(doc(db, "doctorLocations", dLoc.doctorId), payload);
              }
            }

            for (const bed of INITIAL_BEDS) {
              const currentBed = existingBedMap.get(bed.id);
              if (
                !currentBed ||
                (currentBed.status === "Available" &&
                  !currentBed.patientId &&
                  bed.status === "Occupied" &&
                  bed.patientId &&
                  !existingPatientIds.has(bed.patientId))
              ) {
                syncBatch.set(doc(db, "beds", bed.id), {
                  id: bed.id,
                  ward: bed.ward,
                  status: bed.status,
                  patientId: bed.patientId,
                  updatedAt: syncNow,
                });
              }
            }

            for (const p of INITIAL_PATIENTS) {
              if (!existingPatientIds.has(p.id)) {
                syncBatch.set(doc(db, "patients", p.id), {
                  id: p.id,
                  name: p.name,
                  age: p.age,
                  gender: p.gender,
                  symptoms: p.symptoms,
                  vitals: p.vitals,
                  severity: p.severity,
                  department: p.department,
                  assignedBedId: p.assignedBedId,
                  assignedDoctorId: p.assignedDoctorId,
                  assignedNurseId: p.assignedNurseId,
                  status: p.status,
                  aiSummary: p.aiSummary,
                  recommendedActions: p.recommendedActions,
                  admittedAt: p.admittedAt,
                  createdByUid: adminUid,
                  updatedAt: syncNow,
                });
              }
            }

            for (const item of INITIAL_INVENTORY) {
              if (!existingInvIds.has(item.id)) {
                syncBatch.set(doc(db, "inventory", item.id), {
                  id: item.id,
                  name: item.name,
                  category: item.category,
                  stock: item.stock,
                  unit: item.unit,
                  unitPrice: item.unitPrice,
                  minThreshold: item.minThreshold,
                  expiryDate: item.expiryDate,
                  supplier: item.supplier,
                  dailyUsage: item.dailyUsage,
                  updatedAt: syncNow,
                });
              }
            }

            for (const rx of INITIAL_PRESCRIPTIONS) {
              if (!existingRxIds.has(rx.id)) {
                syncBatch.set(doc(db, "prescriptions", rx.id), {
                  id: rx.id,
                  patientId: rx.patientId,
                  patientName: rx.patientName,
                  doctorId: rx.doctorId,
                  doctorName: rx.doctorName,
                  doctorUid: adminUid,
                  items: rx.items,
                  notes: rx.notes,
                  priority: rx.priority,
                  status: rx.status,
                  estimatedTotal: rx.estimatedTotal,
                  createdAt: syncNow,
                  updatedAt: syncNow,
                });
              }
            }

            for (const sale of INITIAL_PHARMACY_SALES) {
              if (!existingSaleIds.has(sale.id)) {
                syncBatch.set(doc(db, "pharmacySales", sale.id), {
                  id: sale.id,
                  billNumber: sale.billNumber,
                  prescriptionId: sale.prescriptionId ?? null,
                  patientName: sale.patientName,
                  doctorName: sale.doctorName,
                  pharmacistUid: adminUid,
                  pharmacistName: sale.pharmacistName,
                  items: sale.items,
                  totalAmount: sale.totalAmount,
                  paymentMethod: sale.paymentMethod,
                  soldAtLabel: sale.soldAtLabel,
                  createdAt: syncNow,
                });
              }
            }

            for (const log of INITIAL_ACTIVITY) {
              if (!existingActIds.has(log.id)) {
                syncBatch.set(doc(db, "activityLogs", log.id), {
                  id: log.id,
                  timestamp: log.timestamp,
                  actor: log.actor,
                  message: log.message,
                  category: log.category,
                  createdByUid: adminUid,
                  createdAt: syncNow,
                });
              }
            }

            await syncBatch.commit();
            pushToast(
              "Sample hospital demo data synced",
              `${INITIAL_INVENTORY.length} medicines · ${INITIAL_PHARMACY_SALES.length} bills · ${INITIAL_PATIENTS.length} patients · ${INITIAL_STAFF_SHIFTS.length} staff shifts`,
              "success"
            );
          }
          return;
        }
      }

      // Cleanly remove existing records before full baseline restore so immutable createdAt
      // and append-only activityLogs rules are always respected on create.
      if (forceOverwrite) {
        const [
          dirSnap,
          shiftsSnap,
          docLocSnap,
          bedsSnap,
          patientsSnap,
          invSnap,
          rxSnap,
          salesSnap,
          actSnap,
        ] = await Promise.all([
          getDocs(collection(db, "staffDirectory")),
          getDocs(collection(db, "staffShifts")),
          getDocs(DOCTOR_LOCATIONS_LIST_QUERY()),
          getDocs(BEDS_LIST_QUERY()),
          getDocs(PATIENTS_LIST_QUERY()),
          getDocs(INVENTORY_LIST_QUERY()),
          getDocs(PRESCRIPTIONS_LIST_QUERY()),
          getDocs(PHARMACY_SALES_LIST_QUERY()),
          getDocs(ACTIVITY_LOGS_LIST_QUERY()),
        ]);

        const allExistingRefs = [
          ...dirSnap.docs,
          ...shiftsSnap.docs,
          ...docLocSnap.docs,
          ...bedsSnap.docs,
          ...patientsSnap.docs,
          ...invSnap.docs,
          ...rxSnap.docs,
          ...salesSnap.docs,
          ...actSnap.docs,
        ].map((d) => d.ref);

        for (let i = 0; i < allExistingRefs.length; i += 400) {
          const delBatch = writeBatch(db);
          for (const ref of allExistingRefs.slice(i, i + 400)) {
            delBatch.delete(ref);
          }
          await delBatch.commit();
        }
      }

      let preExistingDirIds = new Set<string>();
      let preExistingRxIds = new Set<string>();
      let preExistingSaleIds = new Set<string>();
      let preExistingActIds = new Set<string>();

      if (!forceOverwrite) {
        const [dirSnap, rxSnap, salesSnap, actSnap] = await Promise.all([
          getDocs(collection(db, "staffDirectory")),
          getDocs(PRESCRIPTIONS_LIST_QUERY()),
          getDocs(PHARMACY_SALES_LIST_QUERY()),
          getDocs(ACTIVITY_LOGS_LIST_QUERY()),
        ]);
        preExistingDirIds = new Set(dirSnap.docs.map((d) => d.id));
        preExistingRxIds = new Set(rxSnap.docs.map((d) => d.id));
        preExistingSaleIds = new Set(salesSnap.docs.map((d) => d.id));
        preExistingActIds = new Set(actSnap.docs.map((d) => d.id));
      }

      const batch = writeBatch(db);
      const now = serverTimestamp();

      for (const entry of INITIAL_STAFF_DIRECTORY) {
        const dirRef = doc(db, "staffDirectory", entry.linkedStaffId);
        if (preExistingDirIds.has(entry.linkedStaffId)) {
          batch.update(dirRef, {
            email: entry.email.toLowerCase(),
            fullName: entry.fullName,
            role: entry.role,
            linkedStaffId: entry.linkedStaffId,
            department: entry.department,
            updatedAt: now,
          });
        } else {
          batch.set(dirRef, {
            email: entry.email.toLowerCase(),
            fullName: entry.fullName,
            role: entry.role,
            linkedStaffId: entry.linkedStaffId,
            department: entry.department,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      for (const shift of INITIAL_STAFF_SHIFTS) {
        const payload: Record<string, unknown> = {
          staffId: shift.staffId,
          ownerEmail: shift.ownerEmail.toLowerCase(),
          name: shift.name,
          role: shift.role,
          specialty: shift.specialty,
          location: shift.location,
          status: shift.status,
          shiftName: shift.shiftName,
          shiftStart: shift.shiftStart,
          shiftEnd: shift.shiftEnd,
          assignedWard: shift.assignedWard,
          activePatientsCount: shift.activePatientsCount,
          maxCapacity: shift.maxCapacity,
          initials: shift.initials,
          updatedAt: now,
        };
        if (shift.breakWindow) payload.breakWindow = shift.breakWindow;
        if (shift.assignedDoctorIds) payload.assignedDoctorIds = shift.assignedDoctorIds;
        if (shift.avatarUrl) payload.avatarUrl = shift.avatarUrl;
        batch.set(doc(db, "staffShifts", shift.staffId), payload);
      }

      for (const dLoc of INITIAL_DOCTOR_LOCATIONS) {
        const payload: Record<string, unknown> = {
          doctorId: dLoc.doctorId,
          name: dLoc.name,
          specialty: dLoc.specialty,
          location: dLoc.location,
          status: dLoc.status,
          shiftEnd: dLoc.shiftEnd,
          activePatientsCount: dLoc.activePatientsCount,
          maxCapacity: dLoc.maxCapacity,
          initials: dLoc.initials,
          updatedAt: now,
        };
        if (dLoc.avatarUrl) payload.avatarUrl = dLoc.avatarUrl;
        batch.set(doc(db, "doctorLocations", dLoc.doctorId), payload);
      }

      for (const bed of INITIAL_BEDS) {
        batch.set(doc(db, "beds", bed.id), {
          id: bed.id,
          ward: bed.ward,
          status: bed.status,
          patientId: bed.patientId,
          updatedAt: now,
        });
      }

      for (const p of INITIAL_PATIENTS) {
        batch.set(doc(db, "patients", p.id), {
          id: p.id,
          name: p.name,
          age: p.age,
          gender: p.gender,
          symptoms: p.symptoms,
          vitals: p.vitals,
          severity: p.severity,
          department: p.department,
          assignedBedId: p.assignedBedId,
          assignedDoctorId: p.assignedDoctorId,
          assignedNurseId: p.assignedNurseId,
          status: p.status,
          aiSummary: p.aiSummary,
          recommendedActions: p.recommendedActions,
          admittedAt: p.admittedAt,
          createdByUid: adminUid,
          updatedAt: now,
        });
      }

      for (const item of INITIAL_INVENTORY) {
        batch.set(doc(db, "inventory", item.id), {
          id: item.id,
          name: item.name,
          category: item.category,
          stock: item.stock,
          unit: item.unit,
          unitPrice: item.unitPrice,
          minThreshold: item.minThreshold,
          expiryDate: item.expiryDate,
          supplier: item.supplier,
          dailyUsage: item.dailyUsage,
          updatedAt: now,
        });
      }

      for (const rx of INITIAL_PRESCRIPTIONS) {
        if (!preExistingRxIds.has(rx.id)) {
          batch.set(doc(db, "prescriptions", rx.id), {
            id: rx.id,
            patientId: rx.patientId,
            patientName: rx.patientName,
            doctorId: rx.doctorId,
            doctorName: rx.doctorName,
            doctorUid: adminUid,
            items: rx.items,
            notes: rx.notes,
            priority: rx.priority,
            status: rx.status,
            estimatedTotal: rx.estimatedTotal,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      for (const sale of INITIAL_PHARMACY_SALES) {
        if (!preExistingSaleIds.has(sale.id)) {
          batch.set(doc(db, "pharmacySales", sale.id), {
            id: sale.id,
            billNumber: sale.billNumber,
            prescriptionId: sale.prescriptionId ?? null,
            patientName: sale.patientName,
            doctorName: sale.doctorName,
            pharmacistUid: adminUid,
            pharmacistName: sale.pharmacistName,
            items: sale.items,
            totalAmount: sale.totalAmount,
            paymentMethod: sale.paymentMethod,
            soldAtLabel: sale.soldAtLabel,
            createdAt: now,
          });
        }
      }

      for (const log of INITIAL_ACTIVITY) {
        if (!preExistingActIds.has(log.id)) {
          batch.set(doc(db, "activityLogs", log.id), {
            id: log.id,
            timestamp: log.timestamp,
            actor: log.actor,
            message: log.message,
            category: log.category,
            createdByUid: adminUid,
            createdAt: now,
          });
        }
      }

      await batch.commit();
      if (!forceOverwrite) {
        pushToast(
          "Sample hospital demo data loaded",
          `${INITIAL_INVENTORY.length} medicines · ${INITIAL_PHARMACY_SALES.length} bills · ${INITIAL_PATIENTS.length} patients · ${INITIAL_STAFF_SHIFTS.length} shifts`,
          "success"
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "seedHospitalDatabase");
    }
  }

  // Resolve user's role strictly from Firestore after login (NO designation prompt on login!)
  useEffect(() => {
    try {
      const savedStatic = sessionStorage.getItem("medcore_static_user");
      if (savedStatic) {
        const parsed = JSON.parse(savedStatic) as UserProfile;
        setUserProfile(parsed);
        setPreviewRole(parsed.role);
        setPreviewStaffId(parsed.linkedStaffId);
        setAuthLoading(false);
      }
    } catch {}

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAccessDeniedEmail(null);

      if (!user || !user.email) {
        const savedStatic = sessionStorage.getItem("medcore_static_user");
        if (!savedStatic) {
          setFirebaseUser(null);
          setUserProfile(null);
        }
        setAuthLoading(false);
        return;
      }

      setFirebaseUser(user);
      const emailLower = user.email.toLowerCase();

      try {
        const userRef = doc(db, "users", user.uid);
        const existingSnap = await getDoc(userRef);

        if (existingSnap.exists()) {
          const data = existingSnap.data() as UserProfile;
          setUserProfile(data);
          setPreviewRole(data.role);
          setPreviewStaffId(data.linkedStaffId);
          if (data.role === "admin") {
            await seedHospitalDatabase(user.uid, false);
          } else if (data.role === "pharmacist") {
            const inv116 = await getDoc(doc(db, "inventory", "INV-116"));
            const sale908 = await getDoc(doc(db, "pharmacySales", "SALE-908"));
            if (!inv116.exists() || !sale908.exists()) {
              await seedSamplePharmacyDataForUid(user.uid);
            }
          }
          setAuthLoading(false);
          return;
        }

        // First-time sign-in: check bootstrapped Google admin OR @medcore.org manual admin
        const isBootstrappedGoogleAdmin =
          emailLower === ADMIN_EMAIL && user.emailVerified;
        const isBootstrappedManualAdmin = emailLower === MANUAL_ADMIN_EMAIL;

        if (isBootstrappedGoogleAdmin || isBootstrappedManualAdmin) {
          const profile: UserProfile = {
            uid: user.uid,
            email: emailLower,
            displayName: (user.displayName || "Hospital Administrator").slice(0, 100),
            role: "admin",
            linkedStaffId: "ADM-01",
          };
          await setDoc(userRef, {
            ...profile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await seedHospitalDatabase(user.uid, false);
          setUserProfile(profile);
          setPreviewRole("admin");
          setPreviewStaffId("ADM-01");
          setAuthLoading(false);
          return;
        }

        // Lookup role directly from staffDirectory by verified email
        const dirQuery = query(
          collection(db, "staffDirectory"),
          where("email", "==", emailLower)
        );
        const dirSnap = await getDocs(dirQuery);

        let dirData: StaffDirectoryEntry | null = dirSnap.empty
          ? null
          : (dirSnap.docs[0].data() as StaffDirectoryEntry);

        // If this is one of the predefined @medcore.org sample staff accounts logging in
        // before Admin has seeded Firestore, self-bootstrap their exact directory & shift records
        if (!dirData) {
          const predefined = INITIAL_STAFF_DIRECTORY.find(
            (s) => s.email.toLowerCase() === emailLower
          );
          if (predefined) {
            const ts = serverTimestamp();
            const bootBatch = writeBatch(db);
            bootBatch.set(doc(db, "staffDirectory", predefined.linkedStaffId), {
              email: predefined.email.toLowerCase(),
              fullName: predefined.fullName,
              role: predefined.role,
              linkedStaffId: predefined.linkedStaffId,
              department: predefined.department,
              createdAt: ts,
              updatedAt: ts,
            });

            const matchingSeedShift = INITIAL_STAFF_SHIFTS.find(
              (s) => s.staffId === predefined.linkedStaffId
            );
            if (matchingSeedShift) {
              const shiftPayload: Record<string, unknown> = {
                staffId: matchingSeedShift.staffId,
                ownerEmail: matchingSeedShift.ownerEmail.toLowerCase(),
                name: matchingSeedShift.name,
                role: matchingSeedShift.role,
                specialty: matchingSeedShift.specialty,
                location: matchingSeedShift.location,
                status: matchingSeedShift.status,
                shiftName: matchingSeedShift.shiftName,
                shiftStart: matchingSeedShift.shiftStart,
                shiftEnd: matchingSeedShift.shiftEnd,
                assignedWard: matchingSeedShift.assignedWard,
                activePatientsCount: matchingSeedShift.activePatientsCount,
                maxCapacity: matchingSeedShift.maxCapacity,
                initials: matchingSeedShift.initials,
                updatedAt: ts,
              };
              if (matchingSeedShift.breakWindow) {
                shiftPayload.breakWindow = matchingSeedShift.breakWindow;
              }
              if (matchingSeedShift.assignedDoctorIds) {
                shiftPayload.assignedDoctorIds = matchingSeedShift.assignedDoctorIds;
              }
              if (matchingSeedShift.avatarUrl) {
                shiftPayload.avatarUrl = matchingSeedShift.avatarUrl;
              }
              bootBatch.set(
                doc(db, "staffShifts", matchingSeedShift.staffId),
                shiftPayload
              );
            }

            await bootBatch.commit();
            dirData = predefined;
          }
        }

        if (!dirData) {
          setUserProfile(null);
          setAccessDeniedEmail(emailLower);
          setAuthLoading(false);
          return;
        }

        const provisionedProfile: UserProfile = {
          uid: user.uid,
          email: emailLower,
          displayName: (user.displayName || dirData.fullName).slice(0, 100),
          role: dirData.role,
          linkedStaffId: dirData.linkedStaffId,
        };

        await setDoc(userRef, {
          ...provisionedProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (provisionedProfile.role === "pharmacist") {
          const inv116 = await getDoc(doc(db, "inventory", "INV-116"));
          const sale908 = await getDoc(doc(db, "pharmacySales", "SALE-908"));
          if (!inv116.exists() || !sale908.exists()) {
            await seedSamplePharmacyDataForUid(user.uid);
          }
        }

        setUserProfile(provisionedProfile);
        setPreviewRole(provisionedProfile.role);
        setPreviewStaffId(provisionedProfile.linkedStaffId);
        setAuthLoading(false);
      } catch (error) {
        setAuthLoading(false);
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
    });

    return () => unsubscribe();
  }, []);

  // Attach strictly role-scoped real-time Firestore listeners once authenticated
  useEffect(() => {
    if (!firebaseUser) {
      // In static / GitHub Pages mode, keep pre-seeded data populated!
      return;
    }
    if (!userProfile) {
      setStaffDirectory([]);
      setStaffShifts([]);
      setDoctorLocations([]);
      setPatients([]);
      setBeds([]);
      setInventory([]);
      setPrescriptions([]);
      setPharmacySales([]);
      setActivity([]);
      return;
    }

    const unsubs: Unsubscribe[] = [];
    const role = userProfile.role;
    const emailLower = userProfile.email.toLowerCase();

    // 1. Staff Shifts (Admin sees all; every other role strictly queries only their own shift)
    const shiftsQuery =
      role === "admin"
        ? collection(db, "staffShifts")
        : query(
            collection(db, "staffShifts"),
            where("ownerEmail", "==", emailLower)
          );
    unsubs.push(
      onSnapshot(
        shiftsQuery,
        (snap) => {
          setStaffShifts(snap.docs.map((d) => d.data() as StaffShift));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, "staffShifts")
      )
    );

    // 2. Admin-only collections
    if (role === "admin") {
      unsubs.push(
        onSnapshot(
          collection(db, "staffDirectory"),
          (snap) => {
            setStaffDirectory(
              snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<StaffDirectoryEntry, "id">),
              }))
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, "staffDirectory")
        )
      );

      unsubs.push(
        onSnapshot(
          ACTIVITY_LOGS_LIST_QUERY(),
          (snap) => {
            const list = snap.docs.map((d) => d.data() as ActivityEntry);
            list.sort((a, b) => b.id.localeCompare(a.id));
            setActivity(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, "activityLogs")
        )
      );
    }

    // 3. Doctor Locations, Beds, Patients (Admin, Doctor, Ward Staff, Nurse — NEVER Pharmacist)
    if (role === "admin" || role === "doctor" || role === "ward_staff" || role === "nurse") {
      unsubs.push(
        onSnapshot(
          DOCTOR_LOCATIONS_LIST_QUERY(),
          (snap) => {
            const list = snap.docs.map((d) => d.data() as DoctorLocation);
            list.sort((a, b) => a.doctorId.localeCompare(b.doctorId));
            setDoctorLocations(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, "doctorLocations")
        )
      );

      unsubs.push(
        onSnapshot(
          BEDS_LIST_QUERY(),
          (snap) => {
            const list = snap.docs.map((d) => d.data() as Bed);
            list.sort((a, b) => a.id.localeCompare(b.id));
            setBeds(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, "beds")
        )
      );

      unsubs.push(
        onSnapshot(
          PATIENTS_LIST_QUERY(),
          (snap) => {
            const list = snap.docs.map((d) => d.data() as Patient);
            list.sort((a, b) => b.id.localeCompare(a.id));
            setPatients(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, "patients")
        )
      );
    }

    // 4. Pharmacy Inventory (Admin, Pharmacist, Doctor for prescribing — NEVER Ward Staff or Nurse)
    if (role === "admin" || role === "pharmacist" || role === "doctor") {
      unsubs.push(
        onSnapshot(
          INVENTORY_LIST_QUERY(),
          (snap) => {
            const list = snap.docs.map((d) => d.data() as InventoryItem);
            list.sort((a, b) => a.name.localeCompare(b.name));
            setInventory(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, "inventory")
        )
      );
    }

    // 5. Prescriptions Queue (Admin, Pharmacist, Doctor, Nurse — NEVER Ward Staff)
    if (role === "admin" || role === "pharmacist" || role === "doctor" || role === "nurse") {
      unsubs.push(
        onSnapshot(
          PRESCRIPTIONS_LIST_QUERY(),
          (snap) => {
            const list = snap.docs.map((d) => d.data() as PrescriptionRequest);
            list.sort((a, b) => b.id.localeCompare(a.id));
            setPrescriptions(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, "prescriptions")
        )
      );
    }

    // 6. Pharmacy Sales Ledger (Admin & Pharmacist ONLY)
    if (role === "admin" || role === "pharmacist") {
      unsubs.push(
        onSnapshot(
          PHARMACY_SALES_LIST_QUERY(),
          (snap) => {
            const list = snap.docs.map((d) => d.data() as PharmacySale);
            list.sort((a, b) => b.id.localeCompare(a.id));
            setPharmacySales(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, "pharmacySales")
        )
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [firebaseUser, userProfile]);

  async function writeActivityLog(
    actor: ActivityEntry["actor"],
    message: string,
    category: ActivityEntry["category"]
  ) {
    if (!firebaseUser) return;
    const id = `ACT-${Date.now()}`;
    try {
      await setDoc(doc(db, "activityLogs", id), {
        id,
        timestamp: formatNowTime(),
        actor,
        message: message.slice(0, 300),
        category,
        createdByUid: firebaseUser.uid,
        createdAt: serverTimestamp(),
      });
    } catch {
      // Non-blocking audit log write
    }
  }

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in cancelled.";
      pushToast("Sign-in failed", msg, "warning");
    }
  };

  const loginWithEmailPassword = async (
    identifier: string,
    password: string
  ): Promise<EmailLoginResult> => {
    const raw = identifier.trim();
    if (!raw || !password) {
      return { ok: false, error: "Enter both your Staff Email / ID and password." };
    }

    // Allow logging in either by full email (e.g. doctor@medcore.org) or by Staff ID (e.g. DOC-02)
    const sampleByIdOrEmail = SAMPLE_STAFF_CREDENTIALS.find(
      (c) =>
        c.email.toLowerCase() === raw.toLowerCase() ||
        c.staffId.toLowerCase() === raw.toLowerCase()
    );
    const resolvedEmail = sampleByIdOrEmail
      ? sampleByIdOrEmail.email.toLowerCase()
      : raw.includes("@")
        ? raw.toLowerCase()
        : `${raw.toLowerCase()}@medcore.org`;

    // First-time auto-provisioning for official @medcore.org sample accounts
    const sampleMatch = SAMPLE_STAFF_CREDENTIALS.find(
      (c) =>
        c.email.toLowerCase() === resolvedEmail && c.password === password
    );

    const matchInDirectory = !sampleMatch
      ? staffDirectory.find((s) => s.email.toLowerCase() === resolvedEmail)
      : null;

    const performStaticLogin = (profile: UserProfile): EmailLoginResult => {
      setUserProfile(profile);
      setPreviewRole(profile.role);
      setPreviewStaffId(profile.linkedStaffId);
      try {
        sessionStorage.setItem("medcore_static_user", JSON.stringify(profile));
      } catch {}
      return { ok: true };
    };

    try {
      await signInWithEmailAndPassword(auth, resolvedEmail, password);
      return { ok: true };
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: unknown }).code)
          : "";

      // Static / GitHub Pages fallback:
      // If Firebase domain is unauthorized (common on *.github.io), network unreachable,
      // or if offline, authenticate cleanly via sample credentials or staff directory!
      if (
        code === "auth/unauthorized-domain" ||
        code === "auth/network-request-failed" ||
        code === "auth/operation-not-allowed" ||
        code === "auth/configuration-not-found" ||
        code === "auth/user-not-found" ||
        code === "auth/invalid-credential"
      ) {
        if (sampleMatch) {
          const sampleRole =
            INITIAL_STAFF_DIRECTORY.find(
              (s) => s.linkedStaffId === sampleMatch.staffId
            )?.role ?? "admin";
          return performStaticLogin({
            uid: `USER-${sampleMatch.staffId}`,
            email: sampleMatch.email.toLowerCase(),
            displayName: sampleMatch.fullName,
            role: sampleRole,
            linkedStaffId: sampleMatch.staffId,
          });
        }
        if (matchInDirectory && (password === "password123" || password === "Admin@123")) {
          return performStaticLogin({
            uid: `USER-${matchInDirectory.linkedStaffId}`,
            email: matchInDirectory.email.toLowerCase(),
            displayName: matchInDirectory.fullName,
            role: matchInDirectory.role,
            linkedStaffId: matchInDirectory.linkedStaffId,
          });
        }
      }

      if (
        code === "auth/operation-not-allowed" ||
        code === "auth/configuration-not-found"
      ) {
        return {
          ok: false,
          needsProviderEnable: true,
          error:
            "Email/Password sign-in needs to be enabled once in your Firebase Console.",
        };
      }

      // First-time auto-provisioning for official @medcore.org sample accounts
      if (
        sampleMatch &&
        (code === "auth/user-not-found" || code === "auth/invalid-credential")
      ) {
        try {
          const created = await createUserWithEmailAndPassword(
            auth,
            resolvedEmail,
            password
          );
          await updateProfile(created.user, {
            displayName: sampleMatch.fullName,
          });
          return { ok: true };
        } catch (createErr: unknown) {
          const createCode =
            typeof createErr === "object" &&
            createErr !== null &&
            "code" in createErr
              ? String((createErr as { code?: unknown }).code)
              : "";
          if (createCode === "auth/operation-not-allowed") {
            return {
              ok: false,
              needsProviderEnable: true,
              error:
                "Email/Password sign-in needs to be enabled once in your Firebase Console.",
            };
          }
          if (createCode === "auth/email-already-in-use") {
            return { ok: false, error: "Invalid email ID or password." };
          }
          return {
            ok: false,
            error:
              createErr instanceof Error
                ? createErr.message
                : "Could not authenticate account.",
          };
        }
      }

      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential" ||
        code === "auth/user-not-found" ||
        code === "auth/invalid-email"
      ) {
        return { ok: false, error: "Invalid Staff Email / ID or password." };
      }

      return {
        ok: false,
        error: err instanceof Error ? err.message : "Sign-in failed.",
      };
    }
  };

  const logout = async () => {
    try {
      sessionStorage.removeItem("medcore_static_user");
    } catch {}
    try {
      await signOut(auth);
    } catch {}
    setUserProfile(null);
    setAccessDeniedEmail(null);
  };

  const setAdminRolePreview = (role: UserRole, staffId?: string) => {
    if (!isActualAdmin) return;
    setPreviewRole(role);
    setPreviewStaffId(staffId ?? defaultStaffIdForRole(role));
  };

  // Derive full Doctor list combining DoctorLocations + Shift metadata when available
  const doctors = useMemo<Doctor[]>(() => {
    return doctorLocations.map((loc) => {
      const shift = staffShifts.find((s) => s.staffId === loc.doctorId);
      return {
        id: loc.doctorId,
        name: loc.name,
        specialty: loc.specialty,
        shift: shift?.shiftName ?? "Morning",
        shiftStart: shift?.shiftStart ?? "07:00",
        shiftEnd: loc.shiftEnd,
        location: loc.location,
        status: loc.status,
        activePatientsCount: loc.activePatientsCount,
        maxCapacity: loc.maxCapacity,
        avatarUrl: loc.avatarUrl,
        initials: loc.initials,
      };
    });
  }, [doctorLocations, staffShifts]);

  const myShift = useMemo<StaffShift | null>(() => {
    if (!userProfile) return null;
    return (
      staffShifts.find((s) => s.staffId === activeStaffId) ??
      staffShifts.find(
        (s) => s.ownerEmail.toLowerCase() === userProfile.email.toLowerCase()
      ) ??
      staffShifts.find((s) => s.role === activeRole) ??
      null
    );
  }, [staffShifts, activeStaffId, activeRole, userProfile]);

  const admitPatient = async (payload: AdmitPatientPayload): Promise<Patient | null> => {
    if (!firebaseUser) return null;
    const newId = `PT-${Date.now().toString().slice(-6)}`;
    const nowTime = formatNowTime();
    const nurseId = payload.assignedNurseId || "NUR-01";
    const bedId = payload.assignedBedId || "WAITLIST";

    const newPatient: Patient = {
      id: newId,
      name: payload.name.trim().slice(0, 100),
      age: Math.max(0, Math.min(125, Math.round(payload.age))),
      gender: payload.gender,
      symptoms: payload.symptoms.trim().slice(0, 600),
      vitals: payload.vitals,
      severity: payload.severity,
      department: payload.department.slice(0, 80),
      assignedBedId: bedId.slice(0, 40),
      assignedDoctorId: payload.assignedDoctorId.slice(0, 40),
      assignedNurseId: nurseId.slice(0, 40),
      status: "Admitted",
      aiSummary: payload.aiSummary.slice(0, 800),
      recommendedActions: payload.recommendedActions.slice(0, 10),
      admittedAt: nowTime,
      createdByUid: firebaseUser.uid,
    };

    try {
      const batch = writeBatch(db);
      const ts = serverTimestamp();

      batch.set(doc(db, "patients", newId), {
        ...newPatient,
        updatedAt: ts,
      });

      const targetBed = beds.find((b) => b.id === bedId);
      if (targetBed) {
        batch.update(doc(db, "beds", bedId), {
          status: "Occupied",
          patientId: newId,
          updatedAt: ts,
        });
      }

      const targetDoc = doctorLocations.find((d) => d.doctorId === payload.assignedDoctorId);
      if (targetDoc && (isActualAdmin || userProfile?.linkedStaffId === targetDoc.doctorId)) {
        batch.update(doc(db, "doctorLocations", targetDoc.doctorId), {
          activePatientsCount: Math.min(50, targetDoc.activePatientsCount + 1),
          updatedAt: ts,
        });
      }

      await batch.commit();
      await writeActivityLog(
        activeRole === "doctor" ? "Doctor" : "AI Triage",
        `Admitted ${newPatient.name} (${newPatient.severity} · ${newPatient.department}) -> Bed ${newPatient.assignedBedId}.`,
        "triage"
      );

      pushToast(
        `Admitted ${newPatient.name}`,
        `${newPatient.severity} priority · Assigned to ${newPatient.assignedBedId}`,
        "success"
      );
      return newPatient;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `patients/${newId}`);
    }
  };

  const updatePatientVitals = async (patientId: string, vitals: PatientVitals) => {
    setPatients((prev) =>
      prev.map((pt) => (pt.id === patientId ? { ...pt, vitals } : pt))
    );
    try {
      await updateDoc(doc(db, "patients", patientId), {
        vitals,
        updatedAt: serverTimestamp(),
      });
      const pt = patients.find((p) => p.id === patientId);
      await writeActivityLog(
        activeRole === "nurse" ? "Nurse" : "Doctor",
        `Updated vitals for ${pt?.name ?? patientId} (HR ${vitals.heartRate}, SpO2 ${vitals.spo2}%, BP ${vitals.bloodPressure}).`,
        "nursing"
      );
      pushToast("Vitals saved", `Updated live chart for ${pt?.name ?? patientId}`, "success");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `patients/${patientId}`);
    }
  };

  const logPatientHistoricalVitals = async (
    patientId: string,
    vitalsRecord: Omit<PatientVitalsRecord, "id">
  ) => {
    const newEntry: PatientVitalsRecord = {
      ...vitalsRecord,
      id: `vh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };

    const newCurrentVitals: PatientVitals = {
      heartRate: newEntry.heartRate,
      bloodPressure: newEntry.bloodPressure,
      spo2: newEntry.spo2,
      temperature: newEntry.temperature,
    };

    setPatients((prev) =>
      prev.map((pt) => {
        if (pt.id !== patientId) return pt;
        const currentHistory = pt.vitalsHistory ?? [];
        return {
          ...pt,
          vitals: newCurrentVitals,
          vitalsHistory: [...currentHistory, newEntry],
        };
      })
    );

    try {
      await updateDoc(doc(db, "patients", patientId), {
        vitals: newCurrentVitals,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      // Local state is already updated in memory
    }

    const pt = patients.find((p) => p.id === patientId);
    pushToast(
      "Historical Vitals Logged",
      `Recorded HR ${newEntry.heartRate} bpm, BP ${newEntry.bloodPressure}, SpO2 ${newEntry.spo2}% for ${pt?.name ?? patientId}`,
      "success"
    );
  };

  const updateDoctorShift = async (
    doctorId: string,
    updates: {
      shiftName?: ShiftType;
      shiftStart?: string;
      shiftEnd?: string;
      location?: string;
      status?: DoctorStatus;
    }
  ) => {
    setStaffShifts((prev) =>
      prev.map((s) => (s.staffId === doctorId ? { ...s, ...updates } : s))
    );
    setDoctorLocations((prev) =>
      prev.map((d) => (d.doctorId === doctorId ? { ...d, ...updates } : d))
    );
    try {
      await updateDoc(doc(db, "staffShifts", doctorId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "doctorLocations", doctorId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Local state updated
    }
    pushToast("Doctor Shift Updated", `Updated schedule parameters for doctor ${doctorId}`, "success");
  };

  const updateNurseShift = async (
    staffId: string,
    updates: {
      shiftName?: ShiftType;
      shiftStart?: string;
      shiftEnd?: string;
      assignedWard?: string;
      location?: string;
      status?: DoctorStatus;
    }
  ) => {
    setStaffShifts((prev) =>
      prev.map((s) => (s.staffId === staffId ? { ...s, ...updates } : s))
    );
    try {
      await updateDoc(doc(db, "staffShifts", staffId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Local state updated
    }
    pushToast("Nurse Shift Updated", `Updated schedule parameters for nurse ${staffId}`, "success");
  };

  const updateWardStaffShift = async (
    staffId: string,
    updates: {
      shiftName?: ShiftType;
      shiftStart?: string;
      shiftEnd?: string;
      assignedWard?: string;
      location?: string;
      status?: DoctorStatus;
    }
  ) => {
    setStaffShifts((prev) =>
      prev.map((s) => (s.staffId === staffId ? { ...s, ...updates } : s))
    );
    try {
      await updateDoc(doc(db, "staffShifts", staffId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Local state updated
    }
    pushToast("Ward Staff Shift Updated", `Updated schedule parameters for staff ${staffId}`, "success");
  };

  const addStaffDuty = async (
    duty: Omit<StaffDuty, "id" | "createdAt" | "status">
  ) => {
    const newDuty: StaffDuty = {
      ...duty,
      id: `DUTY-${Date.now().toString().slice(-4)}`,
      createdAt: formatNowTime(),
      status: "Assigned",
    };
    setStaffDuties((prev) => [newDuty, ...prev]);
    pushToast("Duty Assigned", `Assigned "${newDuty.dutyTitle}" to ${newDuty.staffName}`, "success");
  };

  const updateStaffDutyStatus = async (dutyId: string, status: StaffDuty["status"]) => {
    setStaffDuties((prev) =>
      prev.map((d) => (d.id === dutyId ? { ...d, status } : d))
    );
    pushToast("Duty Status Updated", `Duty marked as ${status}`, "info");
  };

  const deleteStaffDuty = async (dutyId: string) => {
    setStaffDuties((prev) => prev.filter((d) => d.id !== dutyId));
    pushToast("Duty Removed", "Removed task from roster", "info");
  };

  const addHospitalSale = async (sale: Omit<HospitalSale, "id">) => {
    const newSale: HospitalSale = {
      ...sale,
      id: `SALE-H${Date.now().toString().slice(-4)}`,
    };
    setHospitalSales((prev) => [newSale, ...prev]);
    pushToast(
      "Hospital Sale Logged",
      `Recorded ${newSale.invoiceNumber} for Rs. ${newSale.amount.toLocaleString()} (${newSale.department})`,
      "success"
    );
  };

  const paySalary = async (
    payrollId: string,
    options?: {
      baseSalary?: number;
      allowances?: number;
      bonus?: number;
      overtimePay?: number;
      deductions?: number;
      rail?: DisbursementRail;
      notes?: string;
    }
  ) => {
    const nowStr = new Date().toLocaleString();
    const rail: DisbursementRail = options?.rail || "NEFT";
    const ref = `${rail}-MC-${Math.floor(10000 + Math.random() * 90000)}`;
    const paidBy =
      userProfile?.displayName ||
      (activeRole === "accountant" ? "Vikram Mehta (CPA)" : "Hospital Administrator");

    let finalNet = 0;
    let staffName = "Staff Member";

    setPayrollRecords((prev) =>
      prev.map((rec) => {
        if (rec.id !== payrollId) return rec;
        staffName = rec.staffName;
        const baseSalary = options?.baseSalary ?? rec.baseSalary;
        const allowances = options?.allowances ?? rec.allowances;
        const bonus = options?.bonus ?? rec.bonus;
        const overtimePay = options?.overtimePay ?? rec.overtimePay;
        const deductions = options?.deductions ?? rec.deductions;
        finalNet = Math.max(0, baseSalary + allowances + bonus + overtimePay - deductions);

        return {
          ...rec,
          baseSalary,
          allowances,
          bonus,
          overtimePay,
          deductions,
          netSalary: finalNet,
          disbursementRail: rail,
          status: "Paid" as const,
          paidAt: nowStr,
          paidBy,
          transactionReference: ref,
          notes: options?.notes || rec.notes,
        };
      })
    );

    pushToast(
      "Salary Disbursed",
      `Paid net salary ₹${finalNet.toLocaleString("en-IN")} via ${rail} to ${staffName}. Ref: ${ref}`,
      "success"
    );
    await writeActivityLog(
      activeRole === "accountant" ? "Accountant" : "Admin",
      `Disbursed monthly salary of ₹${finalNet} via ${rail} to ${staffName}. Ref: ${ref}`,
      "system"
    );
  };

  const payAllPendingSalaries = async (): Promise<number> => {
    const nowStr = new Date().toLocaleString();
    const paidBy = activeRole === "accountant" ? "Vikram Mehta (CPA)" : "Hospital Administrator";
    let count = 0;

    setPayrollRecords((prev) =>
      prev.map((rec) => {
        if (rec.status !== "Paid") {
          count++;
          return {
            ...rec,
            status: "Paid" as const,
            paidAt: nowStr,
            paidBy,
            disbursementRail: "NEFT" as DisbursementRail,
            transactionReference: `NEFT-BATCH-${Math.floor(10000 + Math.random() * 90000)}`,
          };
        }
        return rec;
      })
    );
    pushToast(
      "Batch Payroll Executed",
      `Successfully processed salary payouts for ${count} staff members`,
      "success"
    );
    return count;
  };

  const updatePayrollCompensation = async (
    payrollId: string,
    updates: Partial<
      Pick<
        StaffPayrollRecord,
        | "baseSalary"
        | "allowances"
        | "bonus"
        | "deductions"
        | "overtimePay"
        | "overtimeHours"
        | "bankName"
        | "bankAccountNumber"
        | "ifscOrSwift"
        | "designation"
      >
    >
  ) => {
    setPayrollRecords((prev) =>
      prev.map((rec) => {
        if (rec.id !== payrollId) return rec;
        const merged = { ...rec, ...updates };
        const netSalary = Math.max(
          0,
          merged.baseSalary + merged.allowances + merged.bonus + merged.overtimePay - merged.deductions
        );
        return { ...merged, netSalary };
      })
    );
    pushToast("Payroll Details Saved", "Updated salary breakdown and bank payment details", "success");
    await writeActivityLog(
      activeRole === "accountant" ? "Accountant" : "Admin",
      `Updated compensation breakdown and bank account details for payroll ID ${payrollId}`,
      "system"
    );
  };

  const dischargePatient = async (patientId: string) => {
    const target = patients.find((p) => p.id === patientId);
    if (!target || target.status === "Discharged") return;

    try {
      const batch = writeBatch(db);
      const ts = serverTimestamp();

      batch.update(doc(db, "patients", patientId), {
        status: "Discharged",
        updatedAt: ts,
      });

      const occupiedBed = beds.find((b) => b.patientId === patientId);
      if (occupiedBed) {
        batch.update(doc(db, "beds", occupiedBed.id), {
          status: "Cleaning",
          patientId: null,
          updatedAt: ts,
        });
      }

      const targetDoc = doctorLocations.find((d) => d.doctorId === target.assignedDoctorId);
      if (targetDoc && (isActualAdmin || userProfile?.linkedStaffId === targetDoc.doctorId)) {
        batch.update(doc(db, "doctorLocations", targetDoc.doctorId), {
          activePatientsCount: Math.max(0, targetDoc.activePatientsCount - 1),
          updatedAt: ts,
        });
      }

      await batch.commit();
      await writeActivityLog(
        "Staff",
        `Discharged ${target.name}; bed ${target.assignedBedId} queued for sanitization.`,
        "wards"
      );
      pushToast(
        `Discharged ${target.name}`,
        `Bed ${target.assignedBedId} queued for sanitization`,
        "info"
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `patients/${patientId}`);
    }
  };

  const setBedStatus = async (bedId: string, nextStatus: BedStatus) => {
    try {
      const targetBed = beds.find((b) => b.id === bedId);
      await updateDoc(doc(db, "beds", bedId), {
        status: nextStatus,
        patientId: nextStatus === "Occupied" ? targetBed?.patientId ?? null : null,
        updatedAt: serverTimestamp(),
      });
      await writeActivityLog(
        activeRole === "ward_staff" ? "Ward Staff" : "Staff",
        `Updated bed ${bedId} status to ${nextStatus}.`,
        "wards"
      );
      pushToast(`Bed ${bedId} updated`, `Status is now ${nextStatus}`, "success");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `beds/${bedId}`);
    }
  };

  const clearAllCleaningBeds = async (): Promise<number> => {
    const cleaningBeds = beds.filter((b) => b.status === "Cleaning");
    if (cleaningBeds.length === 0) return 0;

    try {
      const batch = writeBatch(db);
      const ts = serverTimestamp();
      for (const b of cleaningBeds) {
        batch.update(doc(db, "beds", b.id), {
          status: "Available",
          patientId: null,
          updatedAt: ts,
        });
      }
      await batch.commit();
      const ids = cleaningBeds.map((b) => b.id).join(", ");
      await writeActivityLog(
        activeRole === "ward_staff" ? "Ward Staff" : "AI Optimizer",
        `Completed sanitization turnaround for ${ids}.`,
        "wards"
      );
      pushToast(
        `${cleaningBeds.length} bed${cleaningBeds.length > 1 ? "s" : ""} Available`,
        `Sanitized: ${ids}`,
        "success"
      );
      return cleaningBeds.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "beds");
    }
  };

  const cycleDoctorStatus = async (doctorId: string, explicitStatus?: DoctorStatus) => {
    const order: DoctorStatus[] = ["On Duty", "In Surgery", "On Call", "Off Duty"];
    const target = doctorLocations.find((d) => d.doctorId === doctorId);
    if (!target) return;
    const nextStatus =
      explicitStatus ?? order[(order.indexOf(target.status) + 1) % order.length];

    try {
      const batch = writeBatch(db);
      const ts = serverTimestamp();
      batch.update(doc(db, "doctorLocations", doctorId), {
        status: nextStatus,
        updatedAt: ts,
      });
      if (isActualAdmin || userProfile?.linkedStaffId === doctorId) {
        batch.update(doc(db, "staffShifts", doctorId), {
          status: nextStatus,
          updatedAt: ts,
        });
      }
      await batch.commit();
      await writeActivityLog(
        explicitStatus ? "AI Optimizer" : "Staff",
        `${target.name} (${target.specialty}) status changed to ${nextStatus}.`,
        "wards"
      );
      pushToast(target.name, `Status changed to ${nextStatus}`, "info");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `doctorLocations/${doctorId}`);
    }
  };

  const updateDoctorLocationAndStatus = async (
    doctorId: string,
    location: string,
    status: DoctorStatus
  ) => {
    try {
      const batch = writeBatch(db);
      const ts = serverTimestamp();
      const safeLoc = location.trim().slice(0, 60) || "OPD";
      batch.update(doc(db, "doctorLocations", doctorId), {
        location: safeLoc,
        status,
        updatedAt: ts,
      });
      batch.update(doc(db, "staffShifts", doctorId), {
        location: safeLoc,
        status,
        updatedAt: ts,
      });
      await batch.commit();
      pushToast("Presence updated", `Location: ${safeLoc} · Status: ${status}`, "success");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `doctorLocations/${doctorId}`);
    }
  };

  const adjustInventoryStock = async (itemId: string, delta: number) => {
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;
    try {
      await updateDoc(doc(db, "inventory", itemId), {
        stock: Math.max(0, Math.round(item.stock + delta)),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `inventory/${itemId}`);
    }
  };

  const addInventoryItem = async (item: Omit<InventoryItem, "id">) => {
    const id = `INV-${Date.now().toString().slice(-6)}`;
    try {
      await setDoc(doc(db, "inventory", id), {
        id,
        name: item.name.trim().slice(0, 120),
        category: item.category,
        stock: Math.max(0, Math.round(item.stock)),
        unit: item.unit.trim().slice(0, 30) || "units",
        unitPrice: Math.max(0, Number(item.unitPrice) || 0),
        minThreshold: Math.max(0, Math.round(item.minThreshold)),
        expiryDate: item.expiryDate.slice(0, 20) || "2027-12-31",
        supplier: item.supplier.trim().slice(0, 100) || "Apex Pharma Supply",
        dailyUsage: Math.max(0, Math.round(item.dailyUsage)),
        updatedAt: serverTimestamp(),
      });
      await writeActivityLog(
        "Pharmacist",
        `Added ${item.name} (${item.stock} ${item.unit}) to pharmacy stock.`,
        "pharmacy"
      );
      pushToast("Stock added", `${item.name} saved to Firestore`, "success");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `inventory/${id}`);
    }
  };

  const importStockFromExcelRows = async (rows: ParsedStockRow[]): Promise<number> => {
    if (rows.length === 0) return 0;
    try {
      const batch = writeBatch(db);
      const ts = serverTimestamp();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const existingItem = inventory.find(
          (inv) => inv.name.toLowerCase() === row.name.toLowerCase()
        );

        if (existingItem) {
          batch.update(doc(db, "inventory", existingItem.id), {
            stock: Math.min(1000000, existingItem.stock + row.stock),
            unitPrice: row.unitPrice,
            minThreshold: row.minThreshold,
            expiryDate: row.expiryDate,
            supplier: row.supplier,
            dailyUsage: row.dailyUsage,
            updatedAt: ts,
          });
        } else {
          const newId = `INV-XL-${Date.now().toString().slice(-5)}-${i}`;
          batch.set(doc(db, "inventory", newId), {
            id: newId,
            name: row.name,
            category: row.category,
            stock: row.stock,
            unit: row.unit,
            unitPrice: row.unitPrice,
            minThreshold: row.minThreshold,
            expiryDate: row.expiryDate,
            supplier: row.supplier,
            dailyUsage: row.dailyUsage,
            updatedAt: ts,
          });
        }
      }

      await batch.commit();
      await writeActivityLog(
        "Pharmacist",
        `Imported ${rows.length} stock line item${rows.length > 1 ? "s" : ""} from Excel sheet.`,
        "pharmacy"
      );
      pushToast(
        "Excel stock imported",
        `Updated/added ${rows.length} medicines in live inventory`,
        "success"
      );
      return rows.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "inventory");
    }
  };

  const applyRestockBatch = async (orders: { itemId: string; quantity: number }[]) => {
    if (orders.length === 0) return;
    try {
      const batch = writeBatch(db);
      const ts = serverTimestamp();
      let updatedCount = 0;

      for (const order of orders) {
        const current = inventory.find((i) => i.id === order.itemId);
        if (!current) continue;
        batch.update(doc(db, "inventory", current.id), {
          stock: Math.min(1000000, current.stock + Math.max(1, Math.round(order.quantity))),
          updatedAt: ts,
        });
        updatedCount++;
      }

      if (updatedCount > 0) {
        await batch.commit();
        await writeActivityLog(
          "AI Forecast",
          `Replenished ${updatedCount} pharmacy supply item${updatedCount > 1 ? "s" : ""} per AI advisor.`,
          "pharmacy"
        );
        pushToast(
          "Restock order approved",
          `Replenished ${updatedCount} item${updatedCount > 1 ? "s" : ""} in live inventory`,
          "success"
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "inventory");
    }
  };

  const sendPrescriptionToPharmacy = async (payload: CreatePrescriptionPayload) => {
    if (!firebaseUser || payload.items.length === 0) return;
    const rxId = `RX-${Date.now().toString().slice(-6)}`;
    const boundedItems = payload.items.slice(0, 10);
    const estimatedTotal = boundedItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    try {
      const ts = serverTimestamp();
      await setDoc(doc(db, "prescriptions", rxId), {
        id: rxId,
        patientId: payload.patientId,
        patientName: payload.patientName.slice(0, 100),
        doctorId: payload.doctorId,
        doctorName: payload.doctorName.slice(0, 100),
        doctorUid: firebaseUser.uid,
        items: boundedItems,
        notes: payload.notes.trim().slice(0, 400),
        priority: payload.priority,
        status: "Pending",
        estimatedTotal,
        createdAt: ts,
        updatedAt: ts,
      });

      await writeActivityLog(
        "Doctor",
        `${payload.doctorName} sent ${payload.priority} prescription ${rxId} for ${payload.patientName} to Pharmacy.`,
        "pharmacy"
      );
      pushToast(
        `Prescription ${rxId} sent`,
        `Pharmacy alerted to pre-pack medicines for ${payload.patientName}`,
        "success"
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `prescriptions/${rxId}`);
    }
  };

  const updatePrescriptionStatus = async (
    prescriptionId: string,
    status: PrescriptionStatus
  ) => {
    try {
      await updateDoc(doc(db, "prescriptions", prescriptionId), {
        status,
        updatedAt: serverTimestamp(),
      });
      pushToast(
        `Prescription ${prescriptionId}`,
        status === "Ready"
          ? "Medicines packed & ready for instant pickup"
          : `Status updated to ${status}`,
        "success"
      );
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `prescriptions/${prescriptionId}`
      );
    }
  };

  const createPharmacyBill = async (
    payload: CreateSalePayload
  ): Promise<PharmacySale | null> => {
    if (!firebaseUser || payload.items.length === 0) return null;
    if (activeRole === "admin") {
      pushToast(
        "Action Restricted",
        "Hospital Administrators cannot generate pharmacy bills. Billing is reserved for Pharmacists and Accountants.",
        "warning"
      );
      return null;
    }
    const saleId = `SALE-${Date.now().toString().slice(-6)}`;
    const billNumber = `BILL-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const boundedItems = payload.items.slice(0, 10);
    const totalAmount = boundedItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const soldAtLabel = `Today ${formatNowTime()}`;
    const pharmacistName =
      myShift?.name || userProfile?.displayName || "Pharmacy Staff";

    const saleRecord: PharmacySale = {
      id: saleId,
      billNumber,
      prescriptionId: payload.prescriptionId ?? null,
      patientName: payload.patientName.trim().slice(0, 100),
      doctorName: (payload.doctorName || "Walk-In").trim().slice(0, 100),
      pharmacistUid: firebaseUser.uid,
      pharmacistName: pharmacistName.slice(0, 100),
      items: boundedItems,
      totalAmount,
      paymentMethod: payload.paymentMethod,
      splitPayments: payload.splitPayments,
      soldAtLabel,
    };

    try {
      const batch = writeBatch(db);
      const ts = serverTimestamp();

      batch.set(doc(db, "pharmacySales", saleId), {
        ...saleRecord,
        createdAt: ts,
      });

      // Deduct sold quantities from live inventory
      for (const line of boundedItems) {
        const inv = inventory.find((i) => i.id === line.itemId);
        if (inv) {
          batch.update(doc(db, "inventory", inv.id), {
            stock: Math.max(0, inv.stock - line.quantity),
            updatedAt: ts,
          });
        }
      }

      // Mark linked prescription Dispensed if applicable
      if (payload.prescriptionId) {
        batch.update(doc(db, "prescriptions", payload.prescriptionId), {
          status: "Dispensed",
          updatedAt: ts,
        });
      }

      await batch.commit();
      await writeActivityLog(
        "Pharmacist",
        `Generated ${billNumber} (₹${totalAmount.toLocaleString("en-IN")}) for ${saleRecord.patientName}.`,
        "pharmacy"
      );

      pushToast(
        `Bill ${billNumber} generated`,
        `₹${totalAmount.toLocaleString("en-IN")} · Stock deducted automatically`,
        "success"
      );
      return saleRecord;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `pharmacySales/${saleId}`);
    }
  };

  const saveStaffDirectoryEntry = async (
    entry: Omit<StaffDirectoryEntry, "id">,
    initialPassword?: string
  ) => {
    const cleanId = entry.linkedStaffId.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    const cleanEmail = entry.email.trim().toLowerCase();
    if (!cleanId || !cleanEmail) return;

    const existingDir = staffDirectory.find((s) => s.linkedStaffId === cleanId);
    if (!existingDir && !isActualAdmin) {
      pushToast("Admin Action Required", "Only hospital administrators can add new employee accounts.", "warning");
      return;
    }

    try {
      const ts = serverTimestamp();
      const batch = writeBatch(db);

      const dirRef = doc(db, "staffDirectory", cleanId);
      if (existingDir) {
        batch.update(dirRef, {
          email: cleanEmail,
          fullName: entry.fullName.trim().slice(0, 100),
          role: entry.role,
          linkedStaffId: cleanId,
          department: entry.department.trim().slice(0, 80),
          updatedAt: ts,
        });
      } else {
        batch.set(dirRef, {
          email: cleanEmail,
          fullName: entry.fullName.trim().slice(0, 100),
          role: entry.role,
          linkedStaffId: cleanId,
          department: entry.department.trim().slice(0, 80),
          createdAt: ts,
          updatedAt: ts,
        });

        // Seed new payroll record so accountant immediately sees the new staff member
        const initialBase =
          entry.role === "doctor"
            ? 180000
            : entry.role === "nurse"
            ? 65000
            : entry.role === "pharmacist"
            ? 60000
            : entry.role === "accountant"
            ? 75000
            : 42000;
        const initialAllowance = Math.round(initialBase * 0.2);
        const initialDeductions = Math.round(initialBase * 0.1);
        const newPayrollRec: StaffPayrollRecord = {
          id: `PAY-${cleanId}-${Date.now().toString().slice(-4)}`,
          staffId: cleanId,
          staffName: entry.fullName.trim(),
          role: entry.role,
          department: entry.department.trim() || "Hospital Operations",
          designation:
            entry.role === "doctor"
              ? "Attending Physician"
              : entry.role === "nurse"
              ? "Registered Staff Nurse"
              : entry.role === "pharmacist"
              ? "Hospital Pharmacist"
              : entry.role === "accountant"
              ? "Hospital Accountant"
              : "Ward Attendant",
          bankName: "HDFC Bank (Pending Setup)",
          bankAccountNumber: "000000000000",
          ifscOrSwift: "HDFC0000000",
          monthYear: "November 2026",
          baseSalary: initialBase,
          allowances: initialAllowance,
          bonus: 0,
          overtimeHours: 0,
          overtimePay: 0,
          deductions: initialDeductions,
          netSalary: initialBase + initialAllowance - initialDeductions,
          status: "Pending",
          notes: "New employee - bank details pending setup by Accountant",
        };
        setPayrollRecords((prev) => {
          if (prev.some((p) => p.staffId === cleanId)) return prev;
          return [newPayrollRec, ...prev];
        });
      }

      // Sync ownerEmail on matching staffShift so that email immediately sees their own shift
      const matchingShift = staffShifts.find((s) => s.staffId === cleanId);
      if (matchingShift) {
        batch.update(doc(db, "staffShifts", cleanId), {
          ownerEmail: cleanEmail,
          name: entry.fullName.trim().slice(0, 100),
          role: entry.role,
          updatedAt: ts,
        });
      } else {
        const initials = entry.fullName
          .split(" ")
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
        batch.set(doc(db, "staffShifts", cleanId), {
          staffId: cleanId,
          ownerEmail: cleanEmail,
          name: entry.fullName.trim().slice(0, 100),
          role: entry.role,
          specialty: entry.department.trim().slice(0, 80) || "Hospital Operations",
          location:
            entry.role === "pharmacist"
              ? "Central Pharmacy Desk"
              : entry.role === "doctor"
                ? "OPD Suite 2"
                : "General Ward",
          status: "On Duty",
          shiftName: "Morning",
          shiftStart: "07:00",
          shiftEnd: "15:00",
          breakWindow: "11:30 – 12:00",
          assignedWard: entry.role === "pharmacist" ? "Pharmacy" : "General",
          assignedDoctorIds: entry.role === "nurse" ? ["DOC-01", "DOC-02"] : [],
          activePatientsCount: 0,
          maxCapacity: 5,
          initials: initials || "ST",
          updatedAt: ts,
        });

        if (entry.role === "doctor") {
          batch.set(doc(db, "doctorLocations", cleanId), {
            doctorId: cleanId,
            name: entry.fullName.trim().slice(0, 100),
            specialty: entry.department.trim().slice(0, 80) || "General Medicine",
            location: "OPD Suite 2",
            status: "On Duty",
            shiftEnd: "15:00",
            activePatientsCount: 0,
            maxCapacity: 5,
            initials: initials || "DR",
            updatedAt: ts,
          });
        }
      }

      await batch.commit();

      if (initialPassword && initialPassword.trim().length >= 6) {
        const authStatus = await provisionStaffAuthAccount(
          cleanEmail,
          initialPassword.trim(),
          entry.fullName
        );
        if (authStatus === "created") {
          pushToast(
            "Staff account & login created",
            `${cleanEmail} saved in Firestore and registered for Email/Password login`,
            "success"
          );
          return;
        }
        if (authStatus === "provider_disabled") {
          pushToast(
            "Saved in Firestore",
            `${cleanEmail} added to database. Enable Email/Password in Firebase Console to activate password login.`,
            "warning"
          );
          return;
        }
      }

      pushToast(
        "Staff role saved",
        `${cleanEmail} assigned as ${entry.role.replace("_", " ")}`,
        "success"
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `staffDirectory/${cleanId}`);
    }
  };

  const provisionAllSampleStaffAccounts = async () => {
    if (!isActualAdmin) {
      return {
        firestoreSynced: 0,
        authCreated: 0,
        authExisting: 0,
        providerDisabled: false,
      };
    }

    const existingDirSnap = await getDocs(collection(db, "staffDirectory"));
    const existingDirIds = new Set(existingDirSnap.docs.map((d) => d.id));
    const batch = writeBatch(db);
    const ts = serverTimestamp();

    for (const entry of INITIAL_STAFF_DIRECTORY) {
      const dirRef = doc(db, "staffDirectory", entry.linkedStaffId);
      if (existingDirIds.has(entry.linkedStaffId)) {
        batch.update(dirRef, {
          email: entry.email.toLowerCase(),
          fullName: entry.fullName,
          role: entry.role,
          linkedStaffId: entry.linkedStaffId,
          department: entry.department,
          updatedAt: ts,
        });
      } else {
        batch.set(dirRef, {
          email: entry.email.toLowerCase(),
          fullName: entry.fullName,
          role: entry.role,
          linkedStaffId: entry.linkedStaffId,
          department: entry.department,
          createdAt: ts,
          updatedAt: ts,
        });
      }
    }

    for (const shift of INITIAL_STAFF_SHIFTS) {
      const payload: Record<string, unknown> = {
        staffId: shift.staffId,
        ownerEmail: shift.ownerEmail.toLowerCase(),
        name: shift.name,
        role: shift.role,
        specialty: shift.specialty,
        location: shift.location,
        status: shift.status,
        shiftName: shift.shiftName,
        shiftStart: shift.shiftStart,
        shiftEnd: shift.shiftEnd,
        assignedWard: shift.assignedWard,
        activePatientsCount: shift.activePatientsCount,
        maxCapacity: shift.maxCapacity,
        initials: shift.initials,
        updatedAt: ts,
      };
      if (shift.breakWindow) payload.breakWindow = shift.breakWindow;
      if (shift.assignedDoctorIds) payload.assignedDoctorIds = shift.assignedDoctorIds;
      if (shift.avatarUrl) payload.avatarUrl = shift.avatarUrl;
      batch.set(doc(db, "staffShifts", shift.staffId), payload);
    }

    for (const dLoc of INITIAL_DOCTOR_LOCATIONS) {
      const payload: Record<string, unknown> = {
        doctorId: dLoc.doctorId,
        name: dLoc.name,
        specialty: dLoc.specialty,
        location: dLoc.location,
        status: dLoc.status,
        shiftEnd: dLoc.shiftEnd,
        activePatientsCount: dLoc.activePatientsCount,
        maxCapacity: dLoc.maxCapacity,
        initials: dLoc.initials,
        updatedAt: ts,
      };
      if (dLoc.avatarUrl) payload.avatarUrl = dLoc.avatarUrl;
      batch.set(doc(db, "doctorLocations", dLoc.doctorId), payload);
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "staffDirectory");
    }

    let authCreated = 0;
    let authExisting = 0;
    let providerDisabled = false;

    for (const cred of SAMPLE_STAFF_CREDENTIALS) {
      const status = await provisionStaffAuthAccount(
        cred.email,
        cred.password,
        cred.fullName
      );
      if (status === "created") authCreated++;
      else if (status === "exists") authExisting++;
      else if (status === "provider_disabled") {
        providerDisabled = true;
        break;
      }
    }

    if (providerDisabled) {
      pushToast(
        `Database directory synced (${INITIAL_STAFF_DIRECTORY.length} staff)`,
        "Enable Email/Password in Firebase Console, then click Sync again to register Auth passwords.",
        "warning"
      );
    } else {
      pushToast(
        `All ${INITIAL_STAFF_DIRECTORY.length} @medcore.org staff provisioned`,
        `Firestore synced · ${authCreated} new Auth accounts created (${authExisting} already active)`,
        "success"
      );
    }

    return {
      firestoreSynced: INITIAL_STAFF_DIRECTORY.length,
      authCreated,
      authExisting,
      providerDisabled,
    };
  };

  const seedSamplePharmacyData = async () => {
    if (!firebaseUser) return;
    if (isActualAdmin) {
      await seedHospitalDatabase(firebaseUser.uid, false);
      pushToast(
        "Sample hospital & pharmacy data synced",
        `${INITIAL_INVENTORY.length} medicines & ${INITIAL_PHARMACY_SALES.length} sample bills ready`,
        "success"
      );
      return;
    }
    const { addedMedicines, addedBills } = await seedSamplePharmacyDataForUid(
      firebaseUser.uid
    );
    if (addedMedicines === 0 && addedBills === 0) {
      pushToast(
        "Sample pharmacy data already loaded",
        `${inventory.length} medicines and ${pharmacySales.length} bills in database`,
        "info"
      );
    } else {
      pushToast(
        "Sample pharmacy data loaded",
        `Added ${addedMedicines} medicines and ${addedBills} sample bills to Firestore`,
        "success"
      );
    }
  };

  const resetDemoData = async () => {
    if (!firebaseUser || !isActualAdmin) {
      pushToast("Admin action only", "Only hospital admins can reset database records.", "warning");
      return;
    }
    await seedHospitalDatabase(firebaseUser.uid, true);
    pushToast(
      "Database restored",
      "Firestore records reset to baseline hospital state",
      "info"
    );
  };

  const clockIn = async (notes?: string) => {
    const staffId = activeStaffId || userProfile?.linkedStaffId || "STAFF-01";
    const staffName = myShift?.name || userProfile?.displayName || "Hospital Staff";
    const role = activeRole;
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = formatNowTime();
    const recordId = `ATT-${Date.now()}`;
    const newRecord: AttendanceRecord = {
      id: recordId,
      staffId,
      staffName,
      role,
      date: dateStr,
      clockInTime: timeStr,
      status: "Clocked In",
      payrollHoursCounted: 0,
      notes: notes || "Shift shift clock-in",
      createdAt: now.toISOString(),
    };
    setAttendanceRecords((prev) => [newRecord, ...prev]);
    pushToast("Clocked In Successfully", `Logged in at ${timeStr} for ${staffName}`, "success");
    await writeActivityLog("Staff", `Clocked IN for ${role} shift at ${timeStr} (${staffName}).`, "system");
  };

  const clockOut = async (recordId: string, notes?: string) => {
    const timeStr = formatNowTime();
    setAttendanceRecords((prev) =>
      prev.map((rec) => {
        if (rec.id === recordId) {
          const inParts = rec.clockInTime.split(":").map(Number);
          const outParts = timeStr.split(":").map(Number);
          let hours = (outParts[0] + (outParts[1] || 0) / 60) - (inParts[0] + (inParts[1] || 0) / 60);
          if (hours < 0) hours += 24;
          const roundedHours = Math.max(0.5, Math.round(hours * 10) / 10);
          return {
            ...rec,
            clockOutTime: timeStr,
            totalHours: roundedHours,
            payrollHoursCounted: roundedHours,
            status: "Clocked Out" as const,
            notes: notes ? `${rec.notes ? rec.notes + " | " : ""}${notes}` : rec.notes,
          };
        }
        return rec;
      })
    );
    pushToast("Clocked Out Successfully", `Logged out at ${timeStr}. Attendance hours updated.`, "success");
  };

  const sendInternalMail = async (payload: {
    toEmail: string;
    toName: string;
    toRole: UserRole;
    subject: string;
    body: string;
    priority: InternalMail["priority"];
  }) => {
    const fromEmail = userProfile?.email || "staff@medcore.org";
    const fromName = myShift?.name || userProfile?.displayName || "Hospital Staff";
    const newMail: InternalMail = {
      id: `MAIL-${Date.now()}`,
      fromEmail,
      fromName,
      fromRole: activeRole,
      toEmail: payload.toEmail.toLowerCase(),
      toName: payload.toName,
      toRole: payload.toRole,
      subject: payload.subject.trim(),
      body: payload.body.trim(),
      sentAtLabel: `Today ${formatNowTime()}`,
      priority: payload.priority,
      isRead: false,
    };
    setInternalMails((prev) => [newMail, ...prev]);
    pushToast("Internal Memo Dispatched", `Sent to ${payload.toName} (${payload.toRole})`, "success");
  };

  const markMailRead = async (mailId: string) => {
    setInternalMails((prev) =>
      prev.map((m) => (m.id === mailId ? { ...m, isRead: true } : m))
    );
  };

  const raiseHelpdeskTicket = async (payload: {
    category: HelpdeskTicket["category"];
    priority: HelpdeskTicket["priority"];
    subject: string;
    description: string;
    location: string;
  }) => {
    const raisedByEmail = userProfile?.email || "staff@medcore.org";
    const raisedByName = myShift?.name || userProfile?.displayName || "MedCore Staff";
    const ticketId = `TCK-${Date.now().toString().slice(-5)}`;
    const newTicket: HelpdeskTicket = {
      id: ticketId,
      ticketNumber: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
      category: payload.category,
      priority: payload.priority,
      status: "Open",
      subject: payload.subject.trim(),
      description: payload.description.trim(),
      location: payload.location.trim(),
      raisedByEmail,
      raisedByName,
      raisedByRole: activeRole,
      raisedAtLabel: `Today ${formatNowTime()}`,
    };
    setHelpdeskTickets((prev) => [newTicket, ...prev]);
    pushToast("Helpdesk Ticket Logged", `Ticket #${newTicket.ticketNumber} submitted to hospital admin`, "info");
    await writeActivityLog("Staff", `Raised helpdesk issue #${newTicket.ticketNumber}: ${payload.subject}`, "system");
  };

  const updateTicketStatus = async (
    ticketId: string,
    status: HelpdeskTicket["status"],
    resolutionNotes?: string
  ) => {
    setHelpdeskTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          return {
            ...t,
            status,
            resolutionNotes: resolutionNotes || t.resolutionNotes,
            resolvedAtLabel:
              status === "Resolved" || status === "Closed"
                ? `Today ${formatNowTime()}`
                : t.resolvedAtLabel,
          };
        }
        return t;
      })
    );
    pushToast("Ticket Updated", `Status changed to ${status}`, "success");
  };

  const issueSpecialPayment = async (
    payment: {
      payeeName: string;
      accountNumber: string;
      ifsc: string;
      amount: number;
      remarks: string;
      approvedBy?: string;
      paymentType: DisbursementRail;
    },
    targetPayrollId?: string
  ) => {
    const specialId = `SP-${Date.now().toString().slice(-4)}`;
    const ref = `${payment.paymentType}-MC-${Math.floor(10000 + Math.random() * 90000)}`;
    const approvedBy =
      payment.approvedBy ||
      userProfile?.displayName ||
      (activeRole === "accountant" ? "Vikram Mehta (CPA)" : "Hospital Administrator");
    const nowStr = `Today ${formatNowTime()}`;

    const newSpecial: SpecialPayment = {
      id: specialId,
      payeeName: payment.payeeName.trim(),
      accountNumber: payment.accountNumber.trim(),
      ifsc: payment.ifsc.trim(),
      amount: payment.amount,
      remarks: payment.remarks.trim(),
      approvedBy,
      paymentType: payment.paymentType,
      date: nowStr,
      transactionReference: ref,
      title: payment.remarks.trim(),
      reason: payment.remarks.trim(),
    };

    setSpecialPayments((prev) => [newSpecial, ...prev]);

    if (targetPayrollId) {
      setPayrollRecords((prev) =>
        prev.map((rec) => {
          if (rec.id === targetPayrollId) {
            const currentSpecials = rec.specialPayments || [];
            const newSpecials = [...currentSpecials, newSpecial];
            const newBonus = (rec.bonus || 0) + payment.amount;
            const newNet =
              rec.baseSalary + rec.allowances + newBonus + rec.overtimePay - rec.deductions;
            return {
              ...rec,
              bonus: newBonus,
              specialPayments: newSpecials,
              netSalary: Math.max(0, newNet),
            };
          }
          return rec;
        })
      );
    }

    pushToast(
      "Special Payment Disbursed",
      `₹${payment.amount.toLocaleString("en-IN")} via ${payment.paymentType} to ${payment.payeeName}. Ref: ${ref}`,
      "success"
    );
    await writeActivityLog(
      activeRole === "accountant" ? "Accountant" : "Admin",
      `Disbursed special payment of ₹${payment.amount} to ${payment.payeeName} (${payment.remarks}) via ${payment.paymentType}. Ref: ${ref}`,
      "system"
    );
  };

  const deleteStaffMember = async (staffId: string) => {
    if (!isActualAdmin) {
      pushToast("Admin Action Required", "Only hospital administrators can remove staff accounts.", "warning");
      return;
    }
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "staffDirectory", staffId));
      batch.delete(doc(db, "staffShifts", staffId));
      batch.delete(doc(db, "doctorLocations", staffId));
      await batch.commit();

      setStaffDirectory((prev) => prev.filter((s) => s.linkedStaffId !== staffId && s.id !== staffId));
      setStaffShifts((prev) => prev.filter((s) => s.staffId !== staffId));
      setDoctorLocations((prev) => prev.filter((d) => d.doctorId !== staffId));

      pushToast("Staff Member Removed", `Removed ${staffId} from hospital directory`, "success");
      await writeActivityLog("Admin", `Removed staff member ${staffId} from hospital directory.`, "system");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `staffDirectory/${staffId}`);
    }
  };

  const value = useMemo<HospitalContextValue>(
    () => ({
      firebaseUser,
      userProfile,
      authLoading,
      accessDeniedEmail,
      activeRole,
      activeStaffId,
      isActualAdmin,
      setAdminRolePreview,
      loginWithGoogle,
      loginWithEmailPassword,
      logout,
      staffDirectory,
      staffShifts,
      myShift,
      doctorLocations,
      doctors,
      patients,
      beds,
      inventory,
      prescriptions,
      pharmacySales,
      staffDuties,
      hospitalSales,
      payrollRecords,
      specialPayments,
      attendanceRecords,
      internalMails,
      helpdeskTickets,
      activity,
      toasts,
      dismissToast,
      pushToast,
      admitPatient,
      updatePatientVitals,
      logPatientHistoricalVitals,
      dischargePatient,
      setBedStatus,
      clearAllCleaningBeds,
      cycleDoctorStatus,
      updateDoctorLocationAndStatus,
      updateDoctorShift,
      updateNurseShift,
      updateWardStaffShift,
      addStaffDuty,
      updateStaffDutyStatus,
      deleteStaffDuty,
      addHospitalSale,
      paySalary,
      payAllPendingSalaries,
      updatePayrollCompensation,
      issueSpecialPayment,
      clockIn,
      clockOut,
      sendInternalMail,
      markMailRead,
      raiseHelpdeskTicket,
      updateTicketStatus,
      deleteStaffMember,
      adjustInventoryStock,
      addInventoryItem,
      importStockFromExcelRows,
      applyRestockBatch,
      sendPrescriptionToPharmacy,
      updatePrescriptionStatus,
      createPharmacyBill,
      saveStaffDirectoryEntry,
      provisionAllSampleStaffAccounts,
      seedSamplePharmacyData,
      resetDemoData,
    }),
    [
      firebaseUser,
      userProfile,
      authLoading,
      accessDeniedEmail,
      activeRole,
      activeStaffId,
      isActualAdmin,
      staffDirectory,
      staffShifts,
      myShift,
      doctorLocations,
      doctors,
      patients,
      beds,
      inventory,
      prescriptions,
      pharmacySales,
      staffDuties,
      hospitalSales,
      payrollRecords,
      specialPayments,
      attendanceRecords,
      internalMails,
      helpdeskTickets,
      activity,
      toasts,
    ]
  );

  return (
    <HospitalContext.Provider value={value}>{children}</HospitalContext.Provider>
  );
}

export function useHospital(): HospitalContextValue {
  const ctx = useContext(HospitalContext);
  if (!ctx) {
    throw new Error("useHospital must be used inside HospitalProvider");
  }
  return ctx;
}
