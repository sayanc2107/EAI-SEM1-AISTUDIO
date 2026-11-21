import React, { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  MapPin,
  Plus,
  Shield,
  Stethoscope,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import { DoctorAvatar } from "./DoctorAvatar";
import type {
  DoctorStatus,
  ShiftType,
  StaffDuty,
  UserRole,
} from "../types/hospital";

const LOCATION_OPTIONS = [
  "Emergency Bay (ER)",
  "ICU",
  "Cardiology Wing",
  "OPD Suite 1",
  "OPD Suite 2",
  "OPD Suite 3",
  "OT-1 (Main OR)",
  "OT-2 (Procedure)",
  "General Ward Floor 1",
  "General Ward Floor 2",
  "On-Call Physician Room",
];

const SHIFT_TYPE_OPTIONS: ShiftType[] = ["Morning", "Evening", "Night"];

const DOCTOR_STATUS_OPTIONS: DoctorStatus[] = [
  "On Duty",
  "In Surgery",
  "On Call",
  "Off Duty",
];

export function ShiftDutyManagementView() {
  const {
    doctors,
    staffShifts,
    staffDuties,
    updateDoctorShift,
    addStaffDuty,
    updateStaffDutyStatus,
    deleteStaffDuty,
  } = useHospital();

  // Active sub-section
  const [sectionTab, setSectionTab] = useState<"shift_change" | "assign_duty" | "roster">(
    "shift_change"
  );

  // 1. Doctor Shift Change State
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors[0]?.id || "DOC-01");
  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];
  const [targetShift, setTargetShift] = useState<ShiftType>(selectedDoctor?.shift || "Morning");
  const [shiftStart, setShiftStart] = useState(selectedDoctor?.shiftStart || "07:00");
  const [shiftEnd, setShiftEnd] = useState(selectedDoctor?.shiftEnd || "15:00");
  const [doctorLocation, setDoctorLocation] = useState(selectedDoctor?.location || "Emergency Bay (ER)");
  const [doctorStatus, setDoctorStatus] = useState<DoctorStatus>(selectedDoctor?.status || "On Duty");
  const [savingShift, setSavingShift] = useState(false);

  // 2. Add Duty State
  const [dutyRole, setDutyRole] = useState<"doctor" | "nurse" | "ward_staff">("doctor");
  const [dutyStaffId, setDutyStaffId] = useState(doctors[0]?.id || "DOC-01");
  const [dutyTitle, setDutyTitle] = useState("");
  const [dutyCategory, setDutyCategory] = useState<StaffDuty["category"]>("Emergency");
  const [dutyLocation, setDutyLocation] = useState("Emergency Bay (ER)");
  const [dutyShift, setDutyShift] = useState<ShiftType>("Morning");
  const [dutyStart, setDutyStart] = useState("07:00");
  const [dutyEnd, setDutyEnd] = useState("15:00");
  const [dutyPriority, setDutyPriority] = useState<StaffDuty["priority"]>("Urgent");
  const [dutyNotes, setDutyNotes] = useState("");
  const [savingDuty, setSavingDuty] = useState(false);

  // 3. Roster Filter State
  const [rosterRoleFilter, setRosterRoleFilter] = useState<"all" | UserRole>("all");
  const [rosterStatusFilter, setRosterStatusFilter] = useState<"all" | StaffDuty["status"]>("all");

  const eligibleDoctors = doctors;
  const eligibleNurses = staffShifts.filter((s) => s.role === "nurse");
  const eligibleWardStaff = staffShifts.filter((s) => s.role === "ward_staff");

  function handleDoctorSelect(docId: string) {
    setSelectedDoctorId(docId);
    const doc = doctors.find((d) => d.id === docId);
    if (doc) {
      setTargetShift(doc.shift);
      setShiftStart(doc.shiftStart);
      setShiftEnd(doc.shiftEnd);
      setDoctorLocation(doc.location);
      setDoctorStatus(doc.status);
    }
  }

  async function handleSaveDoctorShift(e: React.FormEvent) {
    e.preventDefault();
    setSavingShift(true);
    try {
      await updateDoctorShift(selectedDoctorId, {
        shiftName: targetShift,
        shiftStart,
        shiftEnd,
        location: doctorLocation,
        status: doctorStatus,
      });
    } finally {
      setSavingShift(false);
    }
  }

  async function handleCreateDuty(e: React.FormEvent) {
    e.preventDefault();
    if (!dutyTitle.trim()) return;

    let staffName = "";
    if (dutyRole === "doctor") {
      const doc = doctors.find((d) => d.id === dutyStaffId);
      staffName = doc?.name || dutyStaffId;
    } else if (dutyRole === "nurse") {
      const nurse = eligibleNurses.find((n) => n.staffId === dutyStaffId);
      staffName = nurse?.name || dutyStaffId;
    } else {
      const ward = eligibleWardStaff.find((w) => w.staffId === dutyStaffId);
      staffName = ward?.name || dutyStaffId;
    }

    setSavingDuty(true);
    try {
      await addStaffDuty({
        staffId: dutyStaffId,
        staffName,
        role: dutyRole,
        dutyTitle: dutyTitle.trim(),
        category: dutyCategory,
        wardOrLocation: dutyLocation,
        shiftName: dutyShift,
        shiftStart: dutyStart,
        shiftEnd: dutyEnd,
        date: "Today",
        priority: dutyPriority,
        assignedBy: "Hospital Administrator",
        notes: dutyNotes.trim() || undefined,
      });

      setDutyTitle("");
      setDutyNotes("");
      setSectionTab("roster");
    } finally {
      setSavingDuty(false);
    }
  }

  const filteredDuties = staffDuties.filter((duty) => {
    if (rosterRoleFilter !== "all" && duty.role !== rosterRoleFilter) return false;
    if (rosterStatusFilter !== "all" && duty.status !== rosterStatusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold uppercase tracking-wider">
              <Shield className="w-4 h-4" />
              Administrative Staffing Command
            </div>
            <h2 className="text-xl font-bold text-slate-100 mt-1">
              Doctor Shifts & Staff Duty Assignment Center
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Directly adjust physician shift hours and assign duty rosters for Doctors, Nurses, and Ward Staff.
            </p>
          </div>

          {/* Section Switcher */}
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0B1120] border border-slate-800 self-start md:self-center">
            <button
              type="button"
              onClick={() => setSectionTab("shift_change")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                sectionTab === "shift_change"
                  ? "bg-sky-500 text-slate-950"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Change Doctor Shift
            </button>
            <button
              type="button"
              onClick={() => setSectionTab("assign_duty")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                sectionTab === "assign_duty"
                  ? "bg-sky-500 text-slate-950"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Assign New Duty
            </button>
            <button
              type="button"
              onClick={() => setSectionTab("roster")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                sectionTab === "roster"
                  ? "bg-sky-500 text-slate-950"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Live Duty Roster ({staffDuties.length})
            </button>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
          <div className="p-3 rounded-lg bg-[#0B1120] border border-slate-800/80">
            <div className="text-[11px] text-slate-400">Total Doctors</div>
            <div className="text-lg font-mono font-bold text-slate-100 mt-0.5">
              {doctors.length}
            </div>
            <div className="text-[10px] text-emerald-400 mt-0.5">
              {doctors.filter((d) => d.status === "On Duty").length} On Duty
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0B1120] border border-slate-800/80">
            <div className="text-[11px] text-slate-400">Active Duties Today</div>
            <div className="text-lg font-mono font-bold text-sky-400 mt-0.5">
              {staffDuties.length}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {staffDuties.filter((d) => d.status === "In Progress").length} in progress
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0B1120] border border-slate-800/80">
            <div className="text-[11px] text-slate-400">Nurse Roster Coverage</div>
            <div className="text-lg font-mono font-bold text-rose-400 mt-0.5">
              {staffDuties.filter((d) => d.role === "nurse").length} Tasks
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">ICU & Emergency Care</div>
          </div>
          <div className="p-3 rounded-lg bg-[#0B1120] border border-slate-800/80">
            <div className="text-[11px] text-slate-400">Ward Staff Duties</div>
            <div className="text-lg font-mono font-bold text-amber-400 mt-0.5">
              {staffDuties.filter((d) => d.role === "ward_staff").length} Tasks
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Sanitation & Wheelchair Escort</div>
          </div>
        </div>
      </section>

      {/* 1. Change Doctor Shift Form */}
      {sectionTab === "shift_change" && (
        <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" />
                Change Doctor Shift & Coverage Location
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Select any attending physician to reassign their shift timing, ward placement, or duty status.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveDoctorShift} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Doctor Picker */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Select Doctor
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => handleDoctorSelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.specialty} — {d.shift} Shift)
                    </option>
                  ))}
                </select>
              </div>

              {/* Shift Type */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Shift Timing Slot
                </label>
                <select
                  value={targetShift}
                  onChange={(e) => setTargetShift(e.target.value as ShiftType)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  {SHIFT_TYPE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s} Shift
                    </option>
                  ))}
                </select>
              </div>

              {/* Doctor Status */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Duty Status
                </label>
                <select
                  value={doctorStatus}
                  onChange={(e) => setDoctorStatus(e.target.value as DoctorStatus)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  {DOCTOR_STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shift Start */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Shift Start Time
                </label>
                <input
                  type="time"
                  value={shiftStart}
                  onChange={(e) => setShiftStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>

              {/* Shift End */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Shift End Time
                </label>
                <input
                  type="time"
                  value={shiftEnd}
                  onChange={(e) => setShiftEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>

              {/* Assigned Ward / Location */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Station / Location
                </label>
                <select
                  value={doctorLocation}
                  onChange={(e) => setDoctorLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  {LOCATION_OPTIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Updating shift will immediately refresh doctor availability across ER triage & wards.
              </span>
              <button
                type="submit"
                disabled={savingShift}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                {savingShift ? "Saving Shift..." : "Save Doctor Shift"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* 2. Assign Duty Form (Doctor / Nurse / Ward Staff) */}
      {sectionTab === "assign_duty" && (
        <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                Add Duty to Doctor, Nurse, or Ward Staff
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Assign specific clinical or operational tasks directly to clinical staff members.
              </p>
            </div>

            {/* Target Role Selector */}
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0B1120] border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setDutyRole("doctor");
                  setDutyStaffId(doctors[0]?.id || "DOC-01");
                  setDutyCategory("Emergency");
                }}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  dutyRole === "doctor"
                    ? "bg-sky-500 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Doctor Duty
              </button>
              <button
                type="button"
                onClick={() => {
                  setDutyRole("nurse");
                  setDutyStaffId(eligibleNurses[0]?.staffId || "NUR-01");
                  setDutyCategory("ICU");
                }}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  dutyRole === "nurse"
                    ? "bg-rose-500 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Nurse Duty
              </button>
              <button
                type="button"
                onClick={() => {
                  setDutyRole("ward_staff");
                  setDutyStaffId(eligibleWardStaff[0]?.staffId || "WRD-01");
                  setDutyCategory("Wards");
                }}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  dutyRole === "ward_staff"
                    ? "bg-amber-500 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Ward Staff Duty
              </button>
            </div>
          </div>

          <form onSubmit={handleCreateDuty} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Select Staff Member */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Select {dutyRole === "doctor" ? "Physician" : dutyRole === "nurse" ? "Nurse" : "Ward Staff"}
                </label>
                <select
                  value={dutyStaffId}
                  onChange={(e) => setDutyStaffId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  {dutyRole === "doctor" &&
                    doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.specialty})
                      </option>
                    ))}
                  {dutyRole === "nurse" &&
                    eligibleNurses.map((n) => (
                      <option key={n.staffId} value={n.staffId}>
                        {n.name} ({n.specialty})
                      </option>
                    ))}
                  {dutyRole === "ward_staff" &&
                    eligibleWardStaff.map((w) => (
                      <option key={w.staffId} value={w.staffId}>
                        {w.name} ({w.specialty})
                      </option>
                    ))}
                </select>
              </div>

              {/* Duty Category */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Category
                </label>
                <select
                  value={dutyCategory}
                  onChange={(e) => setDutyCategory(e.target.value as StaffDuty["category"])}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  <option value="Emergency">Emergency</option>
                  <option value="ICU">ICU</option>
                  <option value="OPD">OPD</option>
                  <option value="Wards">Wards</option>
                  <option value="OT">OT / Surgical</option>
                  <option value="General">General</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Priority Level
                </label>
                <select
                  value={dutyPriority}
                  onChange={(e) => setDutyPriority(e.target.value as StaffDuty["priority"])}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  <option value="Routine">Routine</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Duty Title */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Duty Title / Task Description
              </label>
              <input
                type="text"
                required
                placeholder={
                  dutyRole === "doctor"
                    ? "e.g., Code Blue Lead, Cardiac Cath Lab Standby, ER Night Rounding"
                    : dutyRole === "nurse"
                    ? "e.g., ICU Ventilator Care & Arterial Line Sampling, ER Acute Triage"
                    : "e.g., ICU Bed 03 Deep Sanitization, Emergency Wheelchair Transport"
                }
                value={dutyTitle}
                onChange={(e) => setDutyTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Location / Station
                </label>
                <select
                  value={dutyLocation}
                  onChange={(e) => setDutyLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  {LOCATION_OPTIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Shift Window
                </label>
                <select
                  value={dutyShift}
                  onChange={(e) => setDutyShift(e.target.value as ShiftType)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  {SHIFT_TYPE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s} Shift
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Start</label>
                  <input
                    type="time"
                    value={dutyStart}
                    onChange={(e) => setDutyStart(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">End</label>
                  <input
                    type="time"
                    value={dutyEnd}
                    onChange={(e) => setDutyEnd(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Special Clinical / Operational Instructions
              </label>
              <textarea
                rows={2}
                placeholder="Specific clinical priorities, patient handoffs, or safety precautions..."
                value={dutyNotes}
                onChange={(e) => setDutyNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="submit"
                disabled={savingDuty}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {savingDuty ? "Assigning Duty..." : "Assign Duty to Staff"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* 3. Live Duties Matrix Roster */}
      {sectionTab === "roster" && (
        <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                Active Hospital Duty Roster
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Overview of duties assigned to doctors, nurses, and ward operations staff.
              </p>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B1120] border border-slate-800">
                <button
                  type="button"
                  onClick={() => setRosterRoleFilter("all")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    rosterRoleFilter === "all"
                      ? "bg-slate-800 text-white font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  All Roles
                </button>
                <button
                  type="button"
                  onClick={() => setRosterRoleFilter("doctor")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    rosterRoleFilter === "doctor"
                      ? "bg-sky-500 text-slate-950 font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Doctors
                </button>
                <button
                  type="button"
                  onClick={() => setRosterRoleFilter("nurse")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    rosterRoleFilter === "nurse"
                      ? "bg-rose-500 text-white font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Nurses
                </button>
                <button
                  type="button"
                  onClick={() => setRosterRoleFilter("ward_staff")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    rosterRoleFilter === "ward_staff"
                      ? "bg-amber-500 text-slate-950 font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Ward Staff
                </button>
              </div>

              <select
                value={rosterStatusFilter}
                onChange={(e) => setRosterStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-300 focus:border-sky-500 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="Assigned">Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          {filteredDuties.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No duties match your selected role or status filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-3 pr-4 font-medium">Assigned Staff</th>
                    <th className="py-3 px-3 font-medium">Duty Title & Category</th>
                    <th className="py-3 px-3 font-medium">Location & Timing</th>
                    <th className="py-3 px-3 font-medium">Priority</th>
                    <th className="py-3 px-3 font-medium">Status</th>
                    <th className="py-3 pl-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredDuties.map((duty) => {
                    const priorityColor =
                      duty.priority === "Critical"
                        ? "text-red-400 bg-red-950/60 border-red-800/80"
                        : duty.priority === "Urgent"
                        ? "text-amber-400 bg-amber-950/60 border-amber-800/80"
                        : "text-sky-400 bg-sky-950/60 border-sky-800/80";

                    const roleBadgeColor =
                      duty.role === "doctor"
                        ? "text-sky-300 bg-sky-950/50"
                        : duty.role === "nurse"
                        ? "text-rose-300 bg-rose-950/50"
                        : "text-amber-300 bg-amber-950/50";

                    return (
                      <tr key={duty.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 pr-4">
                          <div className="font-semibold text-slate-100">{duty.staffName}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${roleBadgeColor}`}>
                              {duty.staffId} · {duty.role.replace("_", " ")}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-200">{duty.dutyTitle}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {duty.category} · {duty.notes || "Standard protocol"}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1 text-slate-300">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            {duty.wardOrLocation}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                            {duty.shiftName} ({duty.shiftStart} – {duty.shiftEnd})
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${priorityColor}`}>
                            {duty.priority}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-block text-[11px] font-semibold ${
                            duty.status === "Completed"
                              ? "text-emerald-400"
                              : duty.status === "In Progress"
                              ? "text-sky-400"
                              : "text-slate-400"
                          }`}>
                            ● {duty.status}
                          </span>
                        </td>
                        <td className="py-3 pl-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {duty.status !== "Completed" && (
                              <button
                                type="button"
                                onClick={() => updateStaffDutyStatus(duty.id, "Completed")}
                                className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium transition-colors cursor-pointer"
                              >
                                Mark Done
                              </button>
                            )}
                            {duty.status === "Assigned" && (
                              <button
                                type="button"
                                onClick={() => updateStaffDutyStatus(duty.id, "In Progress")}
                                className="px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] font-medium transition-colors cursor-pointer"
                              >
                                In Progress
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteStaffDuty(duty.id)}
                              className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                              aria-label="Remove duty"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
