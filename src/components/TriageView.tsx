import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Search,
  Sparkles,
  UserCheck,
  UserMinus,
  X,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import { TRIAGE_DEMO_PRESETS } from "../data/seedData";
import { ApiRequestError, runAITriage } from "../services/aiClient";
import type { Patient, SeverityLevel, TriageAIResult } from "../types/hospital";

const SEVERITY_FILTERS: Array<"All" | SeverityLevel> = [
  "All",
  "Critical",
  "Urgent",
  "Moderate",
  "Routine",
];

function severityTextClass(severity: SeverityLevel): string {
  switch (severity) {
    case "Critical":
      return "text-red-400";
    case "Urgent":
      return "text-amber-400";
    case "Moderate":
      return "text-sky-400";
    case "Routine":
      return "text-emerald-400";
  }
}

export function TriageView() {
  const { patients, beds, doctors, admitPatient, dischargePatient } = useHospital();

  // Intake Form State
  const [name, setName] = useState("");
  const [age, setAge] = useState("48");
  const [gender, setGender] = useState<"Female" | "Male" | "Other">("Male");
  const [symptoms, setSymptoms] = useState("");
  const [heartRate, setHeartRate] = useState("96");
  const [bloodPressure, setBloodPressure] = useState("132/84");
  const [spo2, setSpo2] = useState("97");
  const [temperature, setTemperature] = useState("98.6");

  // AI Triage Inference State
  const [assessment, setAssessment] = useState<TriageAIResult | null>(null);
  const [selectedBedId, setSelectedBedId] = useState<string>("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [loadingTriage, setLoadingTriage] = useState(false);
  const [triageError, setTriageError] = useState<{ message: string; hint?: string } | null>(null);
  const [formValidationError, setFormValidationError] = useState<string | null>(null);

  // Registry Filter & Detail Drawer State
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"All" | SeverityLevel>("All");
  const [showDischarged, setShowDischarged] = useState(false);
  const [inspectedPatient, setInspectedPatient] = useState<Patient | null>(null);

  const availableBeds = useMemo(
    () => beds.filter((b) => b.status === "Available"),
    [beds]
  );
  const availableDoctors = useMemo(
    () => doctors.filter((d) => d.status === "On Duty" || d.status === "On Call"),
    [doctors]
  );

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      if (!showDischarged && p.status === "Discharged") return false;
      if (severityFilter !== "All" && p.severity !== severityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.department.toLowerCase().includes(q) ||
          p.assignedBedId.toLowerCase().includes(q) ||
          p.symptoms.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [patients, showDischarged, severityFilter, searchQuery]);

  function applyPreset(index: number) {
    const preset = TRIAGE_DEMO_PRESETS[index];
    if (!preset) return;
    setName(preset.name);
    setAge(String(preset.age));
    setGender(preset.gender);
    setSymptoms(preset.symptoms);
    setHeartRate(String(preset.vitals.heartRate));
    setBloodPressure(preset.vitals.bloodPressure);
    setSpo2(String(preset.vitals.spo2));
    setTemperature(String(preset.vitals.temperature));
    setAssessment(null);
    setTriageError(null);
    setFormValidationError(null);
  }

  async function handleRunTriage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setFormValidationError(null);

    if (!name.trim() || !symptoms.trim()) {
      setFormValidationError("Enter the patient's name and chief symptoms before running AI triage.");
      return;
    }

    const parsedAge = Number(age);
    const parsedHR = Number(heartRate);
    const parsedSpO2 = Number(spo2);
    const parsedTemp = Number(temperature);
    if (
      Number.isNaN(parsedAge) ||
      Number.isNaN(parsedHR) ||
      Number.isNaN(parsedSpO2) ||
      Number.isNaN(parsedTemp)
    ) {
      setFormValidationError("Age, Heart Rate, SpO2, and Temperature must be valid numbers.");
      return;
    }

    setLoadingTriage(true);
    setTriageError(null);
    try {
      const result = await runAITriage({
        patient: {
          name: name.trim(),
          age: parsedAge,
          gender,
          symptoms: symptoms.trim(),
          vitals: {
            heartRate: parsedHR,
            bloodPressure: bloodPressure.trim() || "120/80",
            spo2: parsedSpO2,
            temperature: parsedTemp,
          },
        },
        availableBeds,
        onDutyDoctors: availableDoctors,
      });

      setAssessment(result);
      const validBed = availableBeds.find((b) => b.id === result.suggestedBedId);
      setSelectedBedId(validBed ? validBed.id : availableBeds[0]?.id ?? "WAITLIST");

      const validDoc = availableDoctors.find((d) => d.id === result.suggestedDoctorId);
      setSelectedDoctorId(validDoc ? validDoc.id : availableDoctors[0]?.id ?? doctors[0]?.id ?? "");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setTriageError({ message: err.message, hint: err.hint });
      } else {
        setTriageError({ message: "Failed to run AI triage assessment." });
      }
    } finally {
      setLoadingTriage(false);
    }
  }

  function handleConfirmAdmission() {
    if (!assessment) return;
    admitPatient({
      name: name.trim(),
      age: Number(age),
      gender,
      symptoms: symptoms.trim(),
      vitals: {
        heartRate: Number(heartRate),
        bloodPressure: bloodPressure.trim() || "120/80",
        spo2: Number(spo2),
        temperature: Number(temperature),
      },
      severity: assessment.severity,
      department: assessment.department,
      assignedBedId: selectedBedId || "WAITLIST",
      assignedDoctorId: selectedDoctorId,
      aiSummary: assessment.clinicalSummary,
      recommendedActions: assessment.immediateActions,
    });

    // Clear intake form for next admission
    setName("");
    setSymptoms("");
    setAssessment(null);
    setSelectedBedId("");
    setSelectedDoctorId("");
  }

  return (
    <div className="space-y-8">
      {/* Split Workspace: Intake Form (Left) + Live Gemini Triage Assessment (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Intake Form */}
        <section className="xl:col-span-6 bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  01. Emergency Patient Intake
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter patient vitals or load a sample emergency intake case.
                </p>
              </div>
            </div>

            {/* Quick Intake Preset Buttons */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 mr-1">Sample Cases:</span>
              {TRIAGE_DEMO_PRESETS.map((preset, idx) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(idx)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleRunTriage} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label className="block text-xs text-slate-400 mb-1.5">Patient Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Suresh Menon"
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 focus:border-sky-500 focus:outline-none text-sm text-slate-100"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs text-slate-400 mb-1.5">Age</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 focus:border-sky-500 focus:outline-none text-sm font-mono tabular-nums text-slate-100"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs text-slate-400 mb-1.5">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as "Female" | "Male" | "Other")}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 focus:border-sky-500 focus:outline-none text-sm text-slate-100"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Chief Complaint & Clinical Symptoms
                </label>
                <textarea
                  rows={3}
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="Describe chest pain, breathing difficulty, trauma, fever onset, neurological signs..."
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 focus:border-sky-500 focus:outline-none text-sm text-slate-100 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={heartRate}
                    onChange={(e) => setHeartRate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 focus:border-sky-500 focus:outline-none text-sm font-mono tabular-nums text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">BP (mmHg)</label>
                  <input
                    type="text"
                    value={bloodPressure}
                    onChange={(e) => setBloodPressure(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 focus:border-sky-500 focus:outline-none text-sm font-mono tabular-nums text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">SpO2 (%)</label>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 focus:border-sky-500 focus:outline-none text-sm font-mono tabular-nums text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Temp (°F)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 focus:border-sky-500 focus:outline-none text-sm font-mono tabular-nums text-slate-100"
                  />
                </div>
              </div>

              {formValidationError && (
                <p className="text-xs text-amber-400">{formValidationError}</p>
              )}

              <div className="pt-2 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  {availableBeds.length} open beds ready for matching
                </span>
                <button
                  type="submit"
                  disabled={loadingTriage}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  {loadingTriage ? "Evaluating Vitals..." : "Run AI Triage"}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Live AI Assessment Result Panel */}
        <section className="xl:col-span-6 bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  02. AI Triage Decision Support
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Structured Gemini classification with human nurse approval required.
                </p>
              </div>
              {assessment && (
                <span
                  className={`text-sm font-semibold ${severityTextClass(assessment.severity)}`}
                >
                  {assessment.severity} Priority
                </span>
              )}
            </div>

            {triageError && (
              <div className="mt-5 p-4 rounded-lg bg-red-950/40 border border-red-900/70 space-y-2">
                <p className="text-sm font-medium text-red-300">{triageError.message}</p>
                {triageError.hint && <p className="text-xs text-red-400">{triageError.hint}</p>}
                <button
                  type="button"
                  onClick={() => handleRunTriage()}
                  className="px-3 py-1.5 rounded-md border border-red-700 text-xs font-medium text-red-200 hover:bg-red-900/40 cursor-pointer"
                >
                  Retry AI Triage
                </button>
              </div>
            )}

            {loadingTriage && (
              <div className="mt-6 space-y-4 animate-pulse">
                <div className="h-5 w-1/2 bg-slate-800 rounded" />
                <div className="h-14 w-full bg-slate-800/80 rounded" />
                <div className="space-y-2 pt-2">
                  <div className="h-4 w-5/6 bg-slate-800/70 rounded" />
                  <div className="h-4 w-4/6 bg-slate-800/70 rounded" />
                  <div className="h-4 w-3/4 bg-slate-800/70 rounded" />
                </div>
              </div>
            )}

            {!loadingTriage && !assessment && !triageError && (
              <div className="mt-10 text-center max-w-md mx-auto space-y-3 py-6">
                <ClipboardCheck className="w-8 h-8 text-slate-600 mx-auto" />
                <h3 className="text-sm font-medium text-slate-200">
                  Awaiting Patient Symptoms & Vitals
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Select a demo scenario on the left or enter custom patient details, then click{" "}
                  <span className="text-slate-200 font-medium">Run AI Triage</span> to classify urgency, predict the clinical department, and match an available hospital bed.
                </p>
              </div>
            )}

            {!loadingTriage && assessment && (
              <div className="mt-5 space-y-5">
                {/* Unboxed metadata line */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
                  <span>
                    Department: <strong className="text-slate-100">{assessment.department}</strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span>
                    Target Ward: <strong className="text-slate-100">{assessment.recommendedWard}</strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="font-mono tabular-nums">
                    Max Wait: {assessment.estimatedWaitMinutes} min
                  </span>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">
                  {assessment.clinicalSummary}
                </p>

                <div>
                  <p className="text-xs font-medium text-slate-400 mb-2">
                    Immediate Nursing & Clinical Actions
                  </p>
                  <ul className="space-y-2 text-sm text-slate-200">
                    {assessment.immediateActions.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Bed & Doctor Assignment Override (Human-in-the-Loop) */}
                <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">
                      Assign Bed (AI Suggested: {assessment.suggestedBedId})
                    </label>
                    <select
                      value={selectedBedId}
                      onChange={(e) => setSelectedBedId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                    >
                      {availableBeds.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.id} — {b.ward} Ward
                        </option>
                      ))}
                      {availableBeds.length === 0 && <option value="WAITLIST">WAITLIST</option>}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">
                      Assign Attending Doctor
                    </label>
                    <select
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                    >
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.specialty})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {assessment && !loadingTriage && (
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAssessment(null)}
                className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors whitespace-nowrap cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleConfirmAdmission}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                Confirm Admission & Assign Bed
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Patient Registry Data Grid */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Active Patient Registry</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any patient row to inspect their full AI triage protocol or discharge them.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient, bed, dept..."
                className="pl-9 pr-3 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 focus:border-sky-500 focus:outline-none text-xs text-slate-200 w-52"
              />
            </div>

            {/* Interactive Segmented Filter */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B1120] border border-slate-800">
              {SEVERITY_FILTERS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSeverityFilter(level)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    severityFilter === level
                      ? "bg-slate-800 text-slate-100"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowDischarged((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showDischarged
                  ? "border-sky-500/60 text-sky-300 bg-sky-950/30"
                  : "border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {showDischarged ? "Showing Discharged" : "Include Discharged"}
            </button>
          </div>
        </div>

        {filteredPatients.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            No patients match your current search or severity filter.
          </div>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400">
                  <th className="py-3 pr-4 font-medium">Patient & Metadata</th>
                  <th className="py-3 px-3 font-medium">Severity</th>
                  <th className="py-3 px-3 font-medium">Bed & Doctor</th>
                  <th className="py-3 px-3 font-medium text-right">Vitals (HR · SpO2 · Temp)</th>
                  <th className="py-3 pl-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-sm">
                {filteredPatients.map((patient) => {
                  const doc = doctors.find((d) => d.id === patient.assignedDoctorId);
                  return (
                    <tr
                      key={patient.id}
                      onClick={() => setInspectedPatient(patient)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 pr-4">
                        <div className="font-medium text-slate-100">
                          {patient.name}{" "}
                          {patient.status === "Discharged" && (
                            <span className="text-xs text-slate-500 font-normal ml-1.5">
                              (Discharged)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {patient.id} · {patient.department} · {patient.age}y {patient.gender} · Admitted {patient.admittedAt}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`text-xs font-semibold ${severityTextClass(patient.severity)}`}>
                          {patient.severity}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-mono text-xs text-slate-200 tabular-nums">
                          {patient.assignedBedId}
                        </div>
                        <div className="text-xs text-slate-400">
                          {doc ? doc.name : "Unassigned"}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-xs tabular-nums text-slate-300">
                        {patient.vitals.heartRate} bpm ·{" "}
                        <span className={patient.vitals.spo2 < 93 ? "text-red-400 font-semibold" : ""}>
                          {patient.vitals.spo2}%
                        </span>{" "}
                        · {patient.vitals.temperature}°F
                      </td>
                      <td
                        className="py-3.5 pl-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {patient.status === "Admitted" ? (
                          <button
                            type="button"
                            onClick={() => dischargePatient(patient.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            Discharge
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">Closed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Patient Detail Inspection Modal */}
      {inspectedPatient && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
          onClick={() => setInspectedPatient(null)}
        >
          <div
            className="bg-[#111827] border border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{inspectedPatient.name}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {inspectedPatient.id} · {inspectedPatient.age}y {inspectedPatient.gender} ·{" "}
                  {inspectedPatient.department} · Bed {inspectedPatient.assignedBedId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedPatient(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer"
                aria-label="Close patient details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 py-2 border-b border-slate-800 text-center">
              <div>
                <div className="text-xs text-slate-400">Heart Rate</div>
                <div className="text-sm font-mono font-semibold text-slate-100 mt-0.5 tabular-nums">
                  {inspectedPatient.vitals.heartRate} bpm
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Blood Pressure</div>
                <div className="text-sm font-mono font-semibold text-slate-100 mt-0.5 tabular-nums">
                  {inspectedPatient.vitals.bloodPressure}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">SpO2</div>
                <div className="text-sm font-mono font-semibold text-slate-100 mt-0.5 tabular-nums">
                  {inspectedPatient.vitals.spo2}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Temperature</div>
                <div className="text-sm font-mono font-semibold text-slate-100 mt-0.5 tabular-nums">
                  {inspectedPatient.vitals.temperature}°F
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-slate-400">Presenting Symptoms</p>
                <p className="text-sm text-slate-200 mt-1 leading-relaxed">
                  {inspectedPatient.symptoms}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">AI Clinical Rationale</p>
                <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                  {inspectedPatient.aiSummary}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2">Recommended Actions</p>
                <ul className="space-y-1.5 text-sm text-slate-200">
                  {inspectedPatient.recommendedActions.map((act, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
              {inspectedPatient.status === "Admitted" && (
                <button
                  type="button"
                  onClick={() => {
                    dischargePatient(inspectedPatient.id);
                    setInspectedPatient(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-200 cursor-pointer"
                >
                  Discharge Patient
                </button>
              )}
              <button
                type="button"
                onClick={() => setInspectedPatient(null)}
                className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold cursor-pointer"
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
