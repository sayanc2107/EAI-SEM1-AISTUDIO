import type {
  Bed,
  BriefingAIResult,
  CopilotMessage,
  Doctor,
  DoctorLocation,
  ForecastAIResult,
  InventoryItem,
  NurseNextActionAIResult,
  OptimizationAIResult,
  Patient,
  PatientVitals,
  PharmacyInsightsAIResult,
  PharmacySale,
  PrescriptionRequest,
  StaffShift,
  TriageAIResult,
  WardCallPredictAIResult,
} from "../types/hospital";

export class ApiRequestError extends Error {
  hint?: string;
  constructor(message: string, hint?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.hint = hint;
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiRequestError(
      payload?.error || `Request failed with status ${response.status}`,
      payload?.hint
    );
  }
  return payload as T;
}

export async function runAITriage(args: {
  patient: {
    name: string;
    age: number;
    gender: string;
    symptoms: string;
    vitals: PatientVitals;
  };
  availableBeds: Bed[];
  onDutyDoctors: Doctor[];
}): Promise<TriageAIResult> {
  return postJson<TriageAIResult>("/api/ai/triage", args);
}

export async function runAIOptimization(args: {
  beds: Bed[];
  doctors: Doctor[];
  patients: Patient[];
}): Promise<OptimizationAIResult> {
  return postJson<OptimizationAIResult>("/api/ai/optimize", args);
}

export async function runAIForecast(args: {
  inventory: InventoryItem[];
  activePatientCount: number;
  criticalPatientCount: number;
}): Promise<ForecastAIResult> {
  return postJson<ForecastAIResult>("/api/ai/forecast", args);
}

export async function runAIBriefing(
  summary: Record<string, unknown>
): Promise<BriefingAIResult> {
  return postJson<BriefingAIResult>("/api/ai/briefing", { summary });
}

export async function askAICopilot(args: {
  question: string;
  history: Pick<CopilotMessage, "role" | "content">[];
  hospitalState: Record<string, unknown>;
}): Promise<{
  answer: string;
  referencedFacts: string[];
  suggestedFollowUps: string[];
}> {
  return postJson("/api/ai/copilot", args);
}

export async function runAICopilotQuery(args: {
  query: string;
  systemState?: Record<string, unknown>;
}): Promise<{
  answer: string;
  referencedFacts: string[];
  suggestedFollowUps: string[];
}> {
  return askAICopilot({
    question: args.query,
    history: [],
    hospitalState: args.systemState || {},
  });
}

export async function runAIPharmacyInsights(args: {
  sales: PharmacySale[];
  inventory: InventoryItem[];
  pendingPrescriptions: PrescriptionRequest[];
}): Promise<PharmacyInsightsAIResult> {
  return postJson<PharmacyInsightsAIResult>("/api/ai/pharmacy-insights", args);
}

export async function runAIWardPredict(args: {
  wardStaffShift: StaffShift | null;
  beds: Bed[];
  activePatients: Patient[];
  onDutyDoctors: DoctorLocation[];
}): Promise<WardCallPredictAIResult> {
  return postJson<WardCallPredictAIResult>("/api/ai/ward-predict", args);
}

export async function runAINursePredict(args: {
  nurseShift: StaffShift | null;
  allottedPatients: Patient[];
  allottedDoctors: DoctorLocation[];
  allDoctors: DoctorLocation[];
  pendingPrescriptions: PrescriptionRequest[];
}): Promise<NurseNextActionAIResult> {
  return postJson<NurseNextActionAIResult>("/api/ai/nurse-predict", args);
}
