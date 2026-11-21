import React, { useMemo, useState } from "react";
import {
  Activity,
  Check,
  Clock,
  MapPin,
  PhoneCall,
  RefreshCw,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import { ApiRequestError, runAINursePredict } from "../services/aiClient";
import type {
  NurseNextActionAIResult,
  Patient,
  SeverityLevel,
} from "../types/hospital";
import { DoctorAvatar } from "./DoctorAvatar";

function severityColor(severity: SeverityLevel): string {
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

export function NursePortalView({
  activeSubTab,
}: {
  activeSubTab?: "station" | "patients" | "prescriptions" | "doctors";
} = {}) {
  const {
    activeStaffId,
    myShift,
    doctorLocations,
    patients,
    prescriptions,
    staffDuties,
    updateStaffDutyStatus,
    updatePatientVitals,
  } = useHospital();

  const myNurseId = myShift?.staffId || activeStaffId || "NUR-01";
  const allottedDoctorIds = myShift?.assignedDoctorIds ?? ["DOC-01", "DOC-02"];

  // Assigned duties from administrator
  const myAssignedDuties = useMemo(
    () => staffDuties.filter((d) => d.staffId === myNurseId),
    [staffDuties, myNurseId]
  );

  // Strictly ONLY patients allotted to THIS nurse
  const myAllottedPatients = useMemo(
    () =>
      patients.filter(
        (p) => p.assignedNurseId === myNurseId && p.status === "Admitted"
      ),
    [patients, myNurseId]
  );

  // Allotted supervising doctors
  const myAllottedDoctors = useMemo(
    () => doctorLocations.filter((d) => allottedDoctorIds.includes(d.doctorId)),
    [doctorLocations, allottedDoctorIds]
  );

  // Pending / Ready prescriptions relevant to this nurse's allotted patients
  const relevantPrescriptions = useMemo(() => {
    const patientIds = new Set(myAllottedPatients.map((p) => p.id));
    return prescriptions.filter(
      (rx) => patientIds.has(rx.patientId) && rx.status !== "Dispensed"
    );
  }, [prescriptions, myAllottedPatients]);

  // Inline Vitals Update State
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [editHR, setEditHR] = useState("");
  const [editBP, setEditBP] = useState("");
  const [editSpO2, setEditSpO2] = useState("");
  const [editTemp, setEditTemp] = useState("");
  const [savingVitals, setSavingVitals] = useState(false);

  // AI Next-Action Predictor State
  const [aiPlan, setAiPlan] = useState<NurseNextActionAIResult | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<{ message: string; hint?: string } | null>(
    null
  );
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);

  function startEditVitals(patient: Patient) {
    setEditingPatientId(patient.id);
    setEditHR(String(patient.vitals.heartRate));
    setEditBP(patient.vitals.bloodPressure);
    setEditSpO2(String(patient.vitals.spo2));
    setEditTemp(String(patient.vitals.temperature));
  }

  async function handleSaveVitals(e: React.FormEvent, patientId: string) {
    e.preventDefault();
    setSavingVitals(true);
    try {
      await updatePatientVitals(patientId, {
        heartRate: Number(editHR) || 85,
        bloodPressure: editBP.trim() || "120/80",
        spo2: Number(editSpO2) || 97,
        temperature: Number(editTemp) || 98.6,
      });
      setEditingPatientId(null);
    } finally {
      setSavingVitals(false);
    }
  }

  async function handleRunNursePredictor() {
    setLoadingAI(true);
    setAiError(null);
    setCompletedTaskIds([]);
    try {
      const result = await runAINursePredict({
        nurseShift: myShift,
        allottedPatients: myAllottedPatients,
        allottedDoctors: myAllottedDoctors,
        allDoctors: doctorLocations,
        pendingPrescriptions: relevantPrescriptions,
      });
      setAiPlan(result);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setAiError({ message: err.message, hint: err.hint });
      } else {
        setAiError({ message: "Could not predict next nursing actions." });
      }
    } finally {
      setLoadingAI(false);
    }
  }

  function toggleTaskCompleted(id: string) {
    setCompletedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1 & 2: Shift Schedule, Assigned Duties & AI Predictor (Station Tab) */}
      {(!activeSubTab || activeSubTab === "station") && (
        <>
          <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-wider text-sky-400">
                My Full Shift Schedule
              </div>
              <h2 className="text-lg font-semibold text-slate-50">
                {myShift?.name || "Registered Nurse"}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                <span>{myShift?.specialty || "ICU & ER Nursing"}</span>
                <span className="text-slate-600">·</span>
                <span className="inline-flex items-center gap-1 font-mono tabular-nums text-slate-100">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  {myShift
                    ? `${myShift.shiftName} Shift (${myShift.shiftStart} – ${myShift.shiftEnd})`
                    : "Morning Shift (07:00 – 15:00)"}
                </span>
                {myShift?.breakWindow && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="font-mono tabular-nums text-slate-400">
                      Break: {myShift.breakWindow}
                    </span>
                  </>
                )}
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">
                  Ward:{" "}
                  <strong className="text-slate-200">
                    {myShift?.assignedWard || "ICU / Emergency"}
                  </strong>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRunNursePredictor}
              disabled={loadingAI}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {loadingAI ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {loadingAI ? "Prioritizing Tasks..." : "Predict What To Do Next"}
            </button>
          </section>

          {/* Assigned Duties from Hospital Administration */}
          <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  Assigned Administrative Duties ({myAssignedDuties.length})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ward rounds, patient monitors, and specialized procedures assigned by Hospital Admin.
                </p>
              </div>
            </div>

            {myAssignedDuties.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No active duty assignments for this shift. Check with Nursing Supervisor if needed.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {myAssignedDuties.map((duty) => (
                  <div
                    key={duty.id}
                    className="p-4 rounded-xl bg-[#0B1120] border border-slate-800 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-sm text-slate-100">{duty.dutyTitle}</div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            duty.priority === "Critical"
                              ? "bg-red-950/60 text-red-300 border border-red-800/80"
                              : "bg-sky-950/60 text-sky-300 border border-sky-800/80"
                          }`}
                        >
                          {duty.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {duty.notes || "Standard clinical care protocol."}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-2 font-mono">
                        <span className="text-slate-300">{duty.wardOrLocation}</span>
                        <span>·</span>
                        <span>{duty.shiftStart} – {duty.shiftEnd}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-sky-400">
                        Status: {duty.status}
                      </span>
                      {duty.status !== "Completed" && (
                        <button
                          type="button"
                          onClick={() => updateStaffDutyStatus(duty.id, "Completed")}
                          className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold cursor-pointer"
                        >
                          Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* AI Next-Action Clinical Predictor */}
          <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="pb-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-slate-100">
                AI Next-Action Nursing Predictor
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ranks your immediate bedside actions across allotted patients, flags which doctor is available to call, and tracks ready pharmacy pickups.
              </p>
            </div>

            {aiError && (
              <div className="p-4 rounded-lg bg-red-950/40 border border-red-900/70 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-red-300">{aiError.message}</p>
                  {aiError.hint && <p className="text-xs text-red-400 mt-0.5">{aiError.hint}</p>}
                </div>
                <button
                  type="button"
                  onClick={handleRunNursePredictor}
                  className="px-3 py-1.5 rounded-md border border-red-700 text-xs font-medium text-red-200 hover:bg-red-900/40 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {loadingAI && (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 w-2/3 bg-slate-800 rounded" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="h-28 bg-slate-800/70 rounded-lg" />
                  <div className="h-28 bg-slate-800/70 rounded-lg" />
                </div>
              </div>
            )}

            {!loadingAI && !aiPlan && !aiError && (
              <p className="text-sm text-slate-400">
                Click <strong className="text-slate-200">Predict What To Do Next</strong> to generate a
                prioritized clinical task queue based on your allotted patients' latest vitals and live
                doctor availability.
              </p>
            )}

            {!loadingAI && aiPlan && (
              <div className="space-y-4">
                <p className="text-sm text-slate-200 leading-relaxed">{aiPlan.shiftFocusSummary}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {aiPlan.nextActions.map((task) => {
                    const done = completedTaskIds.includes(task.id);
                    return (
                      <div
                        key={task.id}
                        className={`p-4 rounded-lg bg-[#0B1120] border transition-colors flex flex-col justify-between gap-3 ${
                          done ? "border-emerald-800/60 opacity-70" : "border-slate-800"
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-semibold text-slate-100">
                              #{task.priorityRank} {task.actionTitle}
                            </div>
                            <span className="text-xs font-mono text-sky-400 shrink-0">
                              {task.dueWindow}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            Patient: <strong className="text-slate-200">{task.patientName}</strong> · Bed{" "}
                            <span className="font-mono text-slate-300">{task.bedId}</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {task.clinicalReason}
                          </p>
                          <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 pt-1">
                            <PhoneCall className="w-3 h-3" />
                            Call: {task.doctorToCall}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleTaskCompleted(task.id)}
                          className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                            done
                              ? "bg-emerald-950/60 border border-emerald-800/70 text-emerald-300"
                              : "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {done ? "Completed" : "Mark Task Done"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* Row 3: Patients, Prescriptions, and Doctors depending on activeSubTab */}
      {(!activeSubTab || activeSubTab === "station" || activeSubTab === "patients") && (
        <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="pb-4 border-b border-slate-800">
            <h2 className="text-base font-semibold text-slate-100">
              My Allotted Patients ({myAllottedPatients.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Patients assigned to your nursing care. Update bedside vitals in real time.
            </p>
          </div>

          {myAllottedPatients.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              No active patients currently allotted to your nursing roster.
            </div>
          ) : (
            <div className="space-y-3">
              {myAllottedPatients.map((patient) => {
                const doc = doctorLocations.find(
                  (d) => d.doctorId === patient.assignedDoctorId
                );
                const readyRx = relevantPrescriptions.find(
                  (rx) => rx.patientId === patient.id
                );
                const isEditing = editingPatientId === patient.id;

                return (
                  <div
                    key={patient.id}
                    className="p-4 rounded-lg bg-[#0B1120] border border-slate-800 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100">{patient.name}</span>
                          <span className={`text-xs font-semibold ${severityColor(patient.severity)}`}>
                            {patient.severity}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Bed <span className="font-mono text-slate-200">{patient.assignedBedId}</span> ·{" "}
                          {patient.department} · Doctor: {doc?.name || patient.assignedDoctorId}
                        </div>
                      </div>

                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => startEditVitals(patient)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-200 whitespace-nowrap cursor-pointer"
                        >
                          <Activity className="w-3.5 h-3.5 text-sky-400" />
                          Update Vitals
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{patient.symptoms}</p>

                    {readyRx && (
                      <div className="text-xs text-emerald-400">
                        Pharmacy Rx {readyRx.id}:{" "}
                        {readyRx.status === "Ready"
                          ? "Packed & Ready for Pickup"
                          : readyRx.status}
                      </div>
                    )}

                    {isEditing ? (
                      <form
                        onSubmit={(e) => handleSaveVitals(e, patient.id)}
                        className="pt-3 border-t border-slate-800 space-y-3"
                      >
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">HR</label>
                            <input
                              type="number"
                              value={editHR}
                              onChange={(e) => setEditHR(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded bg-[#111827] border border-slate-700 text-xs font-mono text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">BP</label>
                            <input
                              type="text"
                              value={editBP}
                              onChange={(e) => setEditBP(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded bg-[#111827] border border-slate-700 text-xs font-mono text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">SpO2 (%)</label>
                            <input
                              type="number"
                              value={editSpO2}
                              onChange={(e) => setEditSpO2(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded bg-[#111827] border border-slate-700 text-xs font-mono text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Temp (°F)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={editTemp}
                              onChange={(e) => setEditTemp(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded bg-[#111827] border border-slate-700 text-xs font-mono text-slate-100"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingPatientId(null)}
                            className="px-3 py-1.5 rounded-md border border-slate-700 text-xs text-slate-300 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={savingVitals}
                            className="px-3 py-1.5 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold cursor-pointer"
                          >
                            {savingVitals ? "Saving..." : "Save Vitals"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-slate-800/80 text-xs font-mono tabular-nums text-slate-400">
                        <span>HR {patient.vitals.heartRate} bpm</span>
                        <span>BP {patient.vitals.bloodPressure}</span>
                        <span
                          className={
                            patient.vitals.spo2 < 93 ? "text-red-400 font-semibold" : ""
                          }
                        >
                          SpO2 {patient.vitals.spo2}%
                        </span>
                        <span>Temp {patient.vitals.temperature}°F</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Dedicated Prescriptions Desk for Nurse */}
      {(activeSubTab === "prescriptions" || !activeSubTab) && (
        <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Patient Prescriptions & Medication Delivery ({relevantPrescriptions.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Active medication orders for your allotted patients from attending physicians.
              </p>
            </div>
          </div>

          {relevantPrescriptions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No pending pharmacy orders for your assigned patients.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {relevantPrescriptions.map((rx) => (
                <div
                  key={rx.id}
                  className="p-4 rounded-xl bg-[#0B1120] border border-slate-800 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{rx.patientName}</div>
                        <div className="text-xs text-slate-400">
                          Prescribed by <span className="text-slate-200">{rx.doctorName}</span> · {rx.id}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          rx.status === "Ready"
                            ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/80"
                            : rx.status === "Preparing"
                              ? "bg-amber-950/60 text-amber-300 border border-amber-800/80"
                              : "bg-sky-950/60 text-sky-300 border border-sky-800/80"
                        }`}
                      >
                        {rx.status}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                      {rx.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs font-mono text-slate-300"
                        >
                          <span>{it.itemName}</span>
                          <span className="text-slate-400">{it.quantity} {it.dosage || "unit"}</span>
                        </div>
                      ))}
                    </div>

                    {rx.notes && (
                      <p className="text-xs text-slate-400 italic mt-1 bg-slate-900/60 p-2 rounded">
                        Note: {rx.notes}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-400">Priority: {rx.priority}</span>
                    <span className="font-mono text-slate-400">
                      {rx.createdAtLabel || "Recent"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Doctors & Live Call Availability */}
      {(!activeSubTab || activeSubTab === "station" || activeSubTab === "doctors") && (
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* My Allotted Supervising Doctors */}
          <div className="xl:col-span-6 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  My Allotted Doctors ({myAllottedDoctors.length})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Primary doctors you are directly supporting this shift.
                </p>
              </div>
              <Stethoscope className="w-4 h-4 text-sky-400 shrink-0" />
            </div>

            <div className="space-y-2.5">
              {myAllottedDoctors.map((doc) => (
                <div
                  key={doc.doctorId}
                  className="p-3.5 rounded-lg bg-[#0B1120] border border-sky-500/40 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <DoctorAvatar
                      name={doc.name}
                      initials={doc.initials}
                      avatarUrl={doc.avatarUrl}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-100 truncate">
                        {doc.name}
                      </div>
                      <div className="text-xs text-slate-400 truncate">{doc.specialty}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="inline-flex items-center gap-1 text-xs font-semibold text-sky-300">
                      <MapPin className="w-3 h-3" /> {doc.location}
                    </div>
                    <div
                      className={`text-xs font-semibold mt-0.5 ${
                        doc.status === "On Duty"
                          ? "text-emerald-400"
                          : doc.status === "In Surgery"
                            ? "text-amber-400"
                            : "text-sky-400"
                      }`}
                    >
                      {doc.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* All Doctors' Current Status (So Nurse Knows Who to Call) */}
          <div className="xl:col-span-6 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-3">
            <div className="pb-3 border-b border-slate-800">
              <h2 className="text-base font-semibold text-slate-100">
                All Doctors — Live Call Availability
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Check real-time availability before paging a doctor for escalation.
              </p>
            </div>

            <div className="divide-y divide-slate-800/70 max-h-[360px] overflow-y-auto pr-1">
              {doctorLocations.map((doc) => {
                const statusColor =
                  doc.status === "On Duty"
                    ? "text-emerald-400"
                    : doc.status === "On Call"
                      ? "text-sky-400"
                      : doc.status === "In Surgery"
                        ? "text-amber-400"
                        : "text-slate-500";
                const callNote =
                  doc.status === "On Duty"
                    ? "Available"
                    : doc.status === "On Call"
                      ? "Page On-Call"
                      : doc.status === "In Surgery"
                        ? "Do Not Disturb"
                        : "Off Shift";

                return (
                  <div
                    key={doc.doctorId}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-100 truncate">{doc.name}</div>
                      <div className="text-slate-400 truncate">
                        {doc.specialty} · {doc.location}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-semibold ${statusColor}`}>{doc.status}</div>
                      <div className="text-[11px] text-slate-500">{callNote}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
