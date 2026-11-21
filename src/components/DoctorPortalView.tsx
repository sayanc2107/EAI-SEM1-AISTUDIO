import React, { useEffect, useMemo, useState } from "react";
import {
  Clock,
  MapPin,
  Pill,
  Plus,
  Send,
  Sparkles,
  Stethoscope,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import { runAITriage } from "../services/aiClient";
import type {
  DoctorStatus,
  Patient,
  PrescriptionLineItem,
  SeverityLevel,
} from "../types/hospital";
import { DoctorAvatar } from "./DoctorAvatar";

const LOCATION_OPTIONS = [
  "ICU",
  "ER",
  "OPD Suite 1",
  "OPD Suite 2",
  "Cardiology",
  "OT-1",
  "OT-2",
  "General Ward",
  "On-Call Room",
];

const STATUS_OPTIONS: DoctorStatus[] = [
  "On Duty",
  "In Surgery",
  "On Call",
  "Off Duty",
];

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

export function DoctorPortalView({
  activeSubTab,
}: {
  activeSubTab?: "shift" | "patients" | "prescriptions" | "library";
} = {}) {
  const {
    activeStaffId,
    myShift,
    doctorLocations,
    doctors,
    patients,
    beds,
    inventory,
    prescriptions,
    staffDuties,
    updateStaffDutyStatus,
    admitPatient,
    updateDoctorLocationAndStatus,
    sendPrescriptionToPharmacy,
    pushToast,
  } = useHospital();

  const myDoctorId = myShift?.staffId || activeStaffId || "DOC-02";
  const myDoctorRecord = useMemo(
    () => doctorLocations.find((d) => d.doctorId === myDoctorId) || null,
    [doctorLocations, myDoctorId]
  );

  const myAssignedDuties = useMemo(
    () => staffDuties.filter((d) => d.staffId === myDoctorId),
    [staffDuties, myDoctorId]
  );

  // Presence update form (Doctor updates own location & status)
  const [myLocation, setMyLocation] = useState(
    myDoctorRecord?.location || myShift?.location || "ER"
  );
  const [myStatus, setMyStatus] = useState<DoctorStatus>(
    myDoctorRecord?.status || myShift?.status || "On Duty"
  );
  const [savingPresence, setSavingPresence] = useState(false);

  useEffect(() => {
    if (myDoctorRecord) {
      setMyLocation(myDoctorRecord.location);
      setMyStatus(myDoctorRecord.status);
    } else if (myShift) {
      setMyLocation(myShift.location);
      setMyStatus(myShift.status);
    }
  }, [myDoctorRecord?.doctorId, myDoctorRecord?.location, myDoctorRecord?.status, myShift]);

  // Strictly ONLY patients allotted to THIS doctor
  const myAllottedPatients = useMemo(
    () =>
      patients.filter(
        (p) => p.assignedDoctorId === myDoctorId && p.status === "Admitted"
      ),
    [patients, myDoctorId]
  );

  // Prescriptions sent by THIS doctor
  const mySentPrescriptions = useMemo(
    () => prescriptions.filter((rx) => rx.doctorId === myDoctorId),
    [prescriptions, myDoctorId]
  );

  const availableBeds = useMemo(
    () => beds.filter((b) => b.status === "Available"),
    [beds]
  );

  // Manual Add Patient modal state
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [ptName, setPtName] = useState("");
  const [ptAge, setPtAge] = useState("42");
  const [ptGender, setPtGender] = useState<"Female" | "Male" | "Other">("Male");
  const [ptSymptoms, setPtSymptoms] = useState("");
  const [ptHR, setPtHR] = useState("88");
  const [ptBP, setPtBP] = useState("126/82");
  const [ptSpO2, setPtSpO2] = useState("97");
  const [ptTemp, setPtTemp] = useState("98.6");
  const [ptSeverity, setPtSeverity] = useState<SeverityLevel>("Moderate");
  const [ptBedId, setPtBedId] = useState("");
  const [ptSummary, setPtSummary] = useState("");
  const [runningAiAssist, setRunningAiAssist] = useState(false);
  const [savingPatient, setSavingPatient] = useState(false);

  // Send Prescription to Pharmacy modal state
  const [rxPatient, setRxPatient] = useState<Patient | null>(null);
  const [rxPriority, setRxPriority] = useState<"Stat" | "Urgent" | "Standard">("Urgent");
  const [rxNotes, setRxNotes] = useState("");
  const [rxItems, setRxItems] = useState<PrescriptionLineItem[]>([]);
  const [rxMedId, setRxMedId] = useState("");
  const [rxMedQty, setRxMedQty] = useState("2");
  const [rxMedDosage, setRxMedDosage] = useState("1 dose as directed");
  const [sendingRx, setSendingRx] = useState(false);

  async function handleSavePresence(e: React.FormEvent) {
    e.preventDefault();
    setSavingPresence(true);
    try {
      await updateDoctorLocationAndStatus(myDoctorId, myLocation, myStatus);
    } finally {
      setSavingPresence(false);
    }
  }

  async function handleAiTriageAssist() {
    if (!ptName.trim() || !ptSymptoms.trim()) {
      pushToast(
        "Enter patient name & symptoms",
        "AI Triage Assist needs symptoms to classify severity.",
        "warning"
      );
      return;
    }
    setRunningAiAssist(true);
    try {
      const res = await runAITriage({
        patient: {
          name: ptName.trim(),
          age: Number(ptAge) || 40,
          gender: ptGender,
          symptoms: ptSymptoms.trim(),
          vitals: {
            heartRate: Number(ptHR) || 88,
            bloodPressure: ptBP || "120/80",
            spo2: Number(ptSpO2) || 97,
            temperature: Number(ptTemp) || 98.6,
          },
        },
        availableBeds,
        onDutyDoctors: doctors.filter((d) => d.status === "On Duty"),
      });
      setPtSeverity(res.severity);
      setPtSummary(res.clinicalSummary);
      if (availableBeds.some((b) => b.id === res.suggestedBedId)) {
        setPtBedId(res.suggestedBedId);
      }
      pushToast("AI Triage Assist applied", `Suggested ${res.severity} priority`, "info");
    } catch {
      pushToast("AI Assist unavailable", "You can still save the patient manually.", "warning");
    } finally {
      setRunningAiAssist(false);
    }
  }

  async function handleAddPatientSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ptName.trim() || !ptSymptoms.trim()) return;
    setSavingPatient(true);
    try {
      await admitPatient({
        name: ptName.trim(),
        age: Number(ptAge) || 40,
        gender: ptGender,
        symptoms: ptSymptoms.trim(),
        vitals: {
          heartRate: Number(ptHR) || 88,
          bloodPressure: ptBP.trim() || "120/80",
          spo2: Number(ptSpO2) || 97,
          temperature: Number(ptTemp) || 98.6,
        },
        severity: ptSeverity,
        department: myShift?.specialty || myDoctorRecord?.specialty || "General Medicine",
        assignedBedId: ptBedId || availableBeds[0]?.id || "WAITLIST",
        assignedDoctorId: myDoctorId,
        assignedNurseId: myDoctorId === "DOC-01" || myDoctorId === "DOC-02" ? "NUR-01" : "NUR-02",
        aiSummary:
          ptSummary.trim() ||
          `Manually admitted by ${myShift?.name || myDoctorRecord?.name || myDoctorId}.`,
        recommendedActions: ["Doctor assessment completed", "Monitor vitals q4h"],
      });
      setShowAddPatient(false);
      setPtName("");
      setPtSymptoms("");
      setPtSummary("");
    } finally {
      setSavingPatient(false);
    }
  }

  function openPrescriptionModal(patient: Patient) {
    setRxPatient(patient);
    setRxPriority(patient.severity === "Critical" ? "Stat" : "Urgent");
    setRxNotes("Please pre-pack so patient attendant can pay and collect immediately.");
    setRxItems([]);
    setRxMedId(inventory[0]?.id || "");
    setRxMedQty("2");
    setRxMedDosage("As prescribed");
  }

  function addMedicineToRx() {
    const targetId = rxMedId || inventory[0]?.id;
    const med = inventory.find((i) => i.id === targetId);
    if (!med) return;
    const qty = Math.max(1, Math.round(Number(rxMedQty) || 1));

    setRxItems((prev) => {
      const existing = prev.find((i) => i.itemId === med.id);
      if (existing) {
        return prev.map((i) =>
          i.itemId === med.id ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [
        ...prev,
        {
          itemId: med.id,
          itemName: med.name,
          quantity: qty,
          unitPrice: med.unitPrice,
          dosage: rxMedDosage.trim() || "As prescribed",
        },
      ];
    });
  }

  async function handleSendRx(e: React.FormEvent) {
    e.preventDefault();
    if (!rxPatient || rxItems.length === 0) return;
    setSendingRx(true);
    try {
      await sendPrescriptionToPharmacy({
        patientId: rxPatient.id,
        patientName: rxPatient.name,
        doctorId: myDoctorId,
        doctorName: myShift?.name || myDoctorRecord?.name || "Attending Doctor",
        items: rxItems,
        notes: rxNotes,
        priority: rxPriority,
      });
      setRxPatient(null);
      setRxItems([]);
    } finally {
      setSendingRx(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Shift Schedule & Presence Section */}
      {(!activeSubTab || activeSubTab === "shift") && (
        <>
          <section className="bg-[#111827] border border-slate-800 rounded-xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="flex items-start gap-4">
                <DoctorAvatar
                  name={myShift?.name || myDoctorRecord?.name || "Doctor"}
                  initials={myShift?.initials || myDoctorRecord?.initials || "DR"}
                  avatarUrl={myShift?.avatarUrl || myDoctorRecord?.avatarUrl}
                  size="md"
                />
                <div className="space-y-1">
                  <div className="text-xs font-medium uppercase tracking-wider text-sky-400">
                    My Full Shift Schedule
                  </div>
                  <h2 className="text-lg font-semibold text-slate-50">
                    {myShift?.name || myDoctorRecord?.name || "Attending Physician"}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                    <span>{myShift?.specialty || myDoctorRecord?.specialty}</span>
                    <span className="text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums text-slate-100">
                      <Clock className="w-3.5 h-3.5 text-sky-400" />
                      {myShift
                        ? `${myShift.shiftName} Shift (${myShift.shiftStart} – ${myShift.shiftEnd})`
                        : `Ends ${myDoctorRecord?.shiftEnd ?? "15:00"}`}
                    </span>
                    {myShift?.breakWindow && (
                      <>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-400 font-mono tabular-nums">
                          Break: {myShift.breakWindow}
                        </span>
                      </>
                    )}
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400">
                      Assigned Ward: <strong className="text-slate-200">{myShift?.assignedWard || "Emergency"}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Update Own Current Location & Status */}
              <form
                onSubmit={handleSavePresence}
                className="flex flex-wrap items-center gap-2.5 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-800"
              >
                <select
                  value={myLocation}
                  onChange={(e) => setMyLocation(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  aria-label="Current location"
                >
                  {LOCATION_OPTIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      Location: {loc}
                    </option>
                  ))}
                </select>
                <select
                  value={myStatus}
                  onChange={(e) => setMyStatus(e.target.value as DoctorStatus)}
                  className="px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                  aria-label="Current duty status"
                >
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={savingPresence}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-100 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {savingPresence ? "Saving..." : "Update Presence"}
                </button>
              </form>
            </div>
          </section>

          {/* Assigned Duties from Hospital Administrator */}
          <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" />
                  My Assigned Duties from Administrator ({myAssignedDuties.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Clinical responsibilities and emergency rotations assigned directly by hospital leadership.
                </p>
              </div>
            </div>

            {myAssignedDuties.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No active duty assignments for this shift. Check with Hospital Administration if needed.
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
        </>
      )}

      {/* 2. Allotted Patients Section */}
      {(!activeSubTab || activeSubTab === "patients") && (
        <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                My Allotted Patients ({myAllottedPatients.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Showing only patients allotted to you. Send prescriptions directly to Pharmacy for early packing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPtBedId(availableBeds[0]?.id || "WAITLIST");
                setShowAddPatient(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Patient Manually
            </button>
          </div>

          {myAllottedPatients.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              No active patients currently allotted to you. Use{" "}
              <strong className="text-slate-200">Add Patient Manually</strong> to admit one.
            </div>
          ) : (
            <div className="space-y-3">
              {myAllottedPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="p-4 rounded-lg bg-[#0B1120] border border-slate-800 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold text-slate-100">{patient.name}</span>
                        <span className={`text-xs font-semibold ${severityColor(patient.severity)}`}>
                          {patient.severity}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {patient.id} · {patient.age}y {patient.gender} · Bed{" "}
                        <span className="font-mono text-slate-200">{patient.assignedBedId}</span> ·
                        Admitted {patient.admittedAt}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openPrescriptionModal(patient)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-600/50 text-emerald-300 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Pill className="w-3.5 h-3.5" />
                      Send Prescription to Pharmacy
                    </button>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{patient.symptoms}</p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-slate-800/80 text-xs font-mono tabular-nums text-slate-400">
                    <span>HR {patient.vitals.heartRate} bpm</span>
                    <span>BP {patient.vitals.bloodPressure}</span>
                    <span className={patient.vitals.spo2 < 93 ? "text-red-400 font-semibold" : ""}>
                      SpO2 {patient.vitals.spo2}%
                    </span>
                    <span>Temp {patient.vitals.temperature}°F</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3. Prescriptions Desk Section */}
      {(!activeSubTab || activeSubTab === "prescriptions") && (
        <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Pill className="w-4 h-4 text-emerald-400" />
                Prescriptions Sent to Central Pharmacy ({mySentPrescriptions.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Track dispensing status and fulfillment for medications ordered by you.
              </p>
            </div>
          </div>

          {mySentPrescriptions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No prescriptions sent yet. Select an allotted patient above to issue a digital Rx.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/70 border border-slate-800 rounded-xl bg-[#0B1120] overflow-hidden">
              {mySentPrescriptions.map((rx) => (
                <div key={rx.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-100">{rx.patientName}</div>
                    <div className="text-slate-400 mt-0.5">
                      {rx.items.map((i) => `${i.itemName} (×${i.quantity})`).join(", ")}
                    </div>
                    {rx.notes && <div className="text-slate-500 mt-1 italic font-sans">{rx.notes}</div>}
                  </div>
                  <span
                    className={`font-semibold shrink-0 px-2.5 py-1 rounded text-xs ${
                      rx.status === "Ready"
                        ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/80"
                        : rx.status === "Dispensed"
                        ? "bg-slate-800 text-slate-400"
                        : "bg-sky-950/60 text-sky-300 border border-sky-800/80"
                    }`}
                  >
                    {rx.status === "Ready" ? "Ready at Pharmacy Desk" : rx.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 4. Doctor Library & Locations Directory */}
      {(!activeSubTab || activeSubTab === "library") && (
        <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="pb-4 border-b border-slate-800">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-sky-400" />
              Doctor Library & Colleague On-Duty Presence
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live unit presence and specialties of hospital physicians across ICU, OPD, ER, and OT suites.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {doctorLocations.map((doc) => {
              const statusColor =
                doc.status === "On Duty"
                  ? "text-emerald-400"
                  : doc.status === "In Surgery"
                  ? "text-amber-400"
                  : doc.status === "On Call"
                  ? "text-sky-400"
                  : "text-slate-500";
              return (
                <div
                  key={doc.doctorId}
                  className={`p-4 rounded-xl bg-[#0B1120] border flex flex-col justify-between gap-3 ${
                    doc.doctorId === myDoctorId ? "border-sky-500/50" : "border-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <DoctorAvatar
                      name={doc.name}
                      initials={doc.initials}
                      avatarUrl={doc.avatarUrl}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100 truncate">
                        {doc.name}
                      </div>
                      <div className="text-xs text-slate-400 truncate">{doc.specialty}</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="inline-flex items-center gap-1 font-semibold text-sky-300">
                      <MapPin className="w-3 h-3" />
                      {doc.location}
                    </div>
                    <div className={`font-semibold ${statusColor}`}>
                      ● {doc.status}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Modal 1: Manual Add Patient (Allotted to This Doctor) */}
      {showAddPatient && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
          onClick={() => setShowAddPatient(false)}
        >
          <div
            className="bg-[#111827] border border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Add Patient to My Allotted List
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Patient will be directly assigned to {myShift?.name || myDoctorRecord?.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPatient(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddPatientSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label className="block text-xs text-slate-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={ptName}
                    onChange={(e) => setPtName(e.target.value)}
                    placeholder="e.g., Rohan Verma"
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs text-slate-400 mb-1">Age</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={ptAge}
                    onChange={(e) => setPtAge(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm font-mono text-slate-100"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs text-slate-400 mb-1">Gender</label>
                  <select
                    value={ptGender}
                    onChange={(e) =>
                      setPtGender(e.target.value as "Female" | "Male" | "Other")
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm text-slate-100"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-400">Symptoms & Clinical Notes</label>
                  <button
                    type="button"
                    onClick={handleAiTriageAssist}
                    disabled={runningAiAssist}
                    className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {runningAiAssist ? "Analyzing..." : "AI Triage Assist"}
                  </button>
                </div>
                <textarea
                  rows={2}
                  required
                  value={ptSymptoms}
                  onChange={(e) => setPtSymptoms(e.target.value)}
                  placeholder="Describe symptoms..."
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">HR (bpm)</label>
                  <input
                    type="number"
                    value={ptHR}
                    onChange={(e) => setPtHR(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">BP</label>
                  <input
                    type="text"
                    value={ptBP}
                    onChange={(e) => setPtBP(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">SpO2 (%)</label>
                  <input
                    type="number"
                    value={ptSpO2}
                    onChange={(e) => setPtSpO2(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Temp (°F)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={ptTemp}
                    onChange={(e) => setPtTemp(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Severity</label>
                  <select
                    value={ptSeverity}
                    onChange={(e) => setPtSeverity(e.target.value as SeverityLevel)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm text-slate-100"
                  >
                    <option value="Critical">Critical</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Routine">Routine</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Assign Available Bed</label>
                  <select
                    value={ptBedId}
                    onChange={(e) => setPtBedId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm font-mono text-slate-100"
                  >
                    {availableBeds.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.id} ({b.ward})
                      </option>
                    ))}
                    <option value="WAITLIST">OPD / WAITLIST</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddPatient(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPatient}
                  className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 text-xs font-semibold cursor-pointer"
                >
                  {savingPatient ? "Saving..." : "Admit Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Send Prescription / Medicine Request to Pharmacy */}
      {rxPatient && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
          onClick={() => setRxPatient(null)}
        >
          <div
            className="bg-[#111827] border border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Send Prescription to Pharmacy
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Patient: <strong className="text-slate-200">{rxPatient.name}</strong> ({rxPatient.assignedBedId}) — Pharmacy will pre-pack for immediate pickup.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRxPatient(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                aria-label="Close prescription modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendRx} className="space-y-4">
              <div className="p-3.5 rounded-lg bg-[#0B1120] border border-slate-800 space-y-2.5">
                <div className="text-xs font-medium text-slate-400">Select Medicine</div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <select
                    value={rxMedId || inventory[0]?.id || ""}
                    onChange={(e) => setRxMedId(e.target.value)}
                    className="sm:col-span-6 px-2.5 py-2 rounded-lg bg-[#111827] border border-slate-800 text-xs text-slate-100"
                  >
                    {inventory.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (₹{m.unitPrice})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={rxMedQty}
                    onChange={(e) => setRxMedQty(e.target.value)}
                    className="sm:col-span-2 px-2.5 py-2 rounded-lg bg-[#111827] border border-slate-800 text-xs font-mono text-slate-100"
                    aria-label="Quantity"
                  />
                  <input
                    type="text"
                    value={rxMedDosage}
                    onChange={(e) => setRxMedDosage(e.target.value)}
                    placeholder="Dosage"
                    className="sm:col-span-4 px-2.5 py-2 rounded-lg bg-[#111827] border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={addMedicineToRx}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add to Prescription
                  </button>
                </div>
              </div>

              {rxItems.length > 0 && (
                <div className="border border-slate-800 rounded-lg divide-y divide-slate-800/80 bg-[#0B1120]">
                  {rxItems.map((line) => (
                    <div
                      key={line.itemId}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-medium text-slate-100">{line.itemName}</div>
                        <div className="text-slate-400">
                          Qty {line.quantity} · {line.dosage}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setRxItems((prev) => prev.filter((i) => i.itemId !== line.itemId))
                        }
                        className="text-slate-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Priority</label>
                  <select
                    value={rxPriority}
                    onChange={(e) =>
                      setRxPriority(e.target.value as "Stat" | "Urgent" | "Standard")
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100"
                  >
                    <option value="Stat">Stat (Immediate)</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Standard">Standard</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">
                    Pharmacy Instructions
                  </label>
                  <input
                    type="text"
                    value={rxNotes}
                    onChange={(e) => setRxNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRxPatient(null)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingRx || rxItems.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-semibold cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sendingRx ? "Sending to Pharmacy..." : "Send Request to Pharmacy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
