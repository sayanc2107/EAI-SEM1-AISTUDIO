import React, { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  UserCheck,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import type { DoctorDaySchedule, ShiftType } from "../types/hospital";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function DoctorWeeklyScheduleView({
  targetDoctorId,
}: {
  targetDoctorId?: string;
} = {}) {
  const { staffShifts, doctorLocations, myShift, activeStaffId } = useHospital();
  const doctorId = targetDoctorId || myShift?.staffId || activeStaffId || "DOC-01";

  const doctorShift = useMemo(
    () => staffShifts.find((s) => s.staffId === doctorId),
    [staffShifts, doctorId]
  );

  const docLocation = useMemo(
    () => doctorLocations.find((d) => d.doctorId === doctorId),
    [doctorLocations, doctorId]
  );

  // Generate deterministic 7-day rolling roster based on doctor's specialty & base shift
  const weeklySchedule = useMemo<DoctorDaySchedule[]>(() => {
    const today = new Date();
    const baseShift = doctorShift?.shiftName || "Morning";
    const ward = doctorShift?.assignedWard || "Emergency";
    const loc = doctorShift?.location || docLocation?.location || "ICU";

    return DAYS.map((dayName, idx) => {
      const d = new Date(today);
      d.setDate(today.getDate() + idx);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      // Simulate realistic hospital on-call and rotation
      const isWeekendOff = idx === 5 && (doctorId === "DOC-02" || doctorId === "DOC-04");
      const isSurgeryDay = idx === 1 || idx === 3;
      const isOnCall = idx === 4 || idx === 6;

      let shiftName: ShiftType | "Off" = baseShift;
      let hours = doctorShift ? `${doctorShift.shiftStart} – ${doctorShift.shiftEnd}` : "07:00 – 15:00";
      let dutyType: DoctorDaySchedule["dutyType"] = "Clinical Care";

      if (isWeekendOff) {
        shiftName = "Off";
        hours = "Scheduled Rest";
        dutyType = "Day Off";
      } else if (isSurgeryDay) {
        dutyType = "OR Surgery";
        hours = "08:00 – 16:00";
      } else if (isOnCall) {
        dutyType = "Emergency On-Call";
        hours = "24-Hr Pager Standby";
      } else if (idx === 0 || idx === 2) {
        dutyType = "OPD Clinic";
      }

      return {
        dayName: idx === 0 ? "Today" : idx === 1 ? "Tomorrow" : dayName,
        dateStr,
        shiftName,
        hours,
        ward: isWeekendOff ? "—" : ward,
        location: isWeekendOff ? "Home" : loc,
        dutyType,
      };
    });
  }, [doctorShift, docLocation, doctorId]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-sky-400">
            Clinical Duty Roster
          </div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mt-0.5">
            <Calendar className="w-5 h-5 text-sky-400" />
            7-Day Schedule for {doctorShift?.name || docLocation?.name || doctorId}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Confirmed weekly rotations, operating theater assignments, and on-call escalation windows.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-slate-300 font-mono">
            Ward: <strong className="text-slate-100">{doctorShift?.assignedWard || "Emergency"}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-emerald-400 font-mono">
            Status: {doctorShift?.status || "On Duty"}
          </span>
        </div>
      </div>

      {/* 7-Day Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {weeklySchedule.map((day, idx) => {
          const isToday = idx === 0;
          const isOff = day.shiftName === "Off";
          const isSurgery = day.dutyType === "OR Surgery";
          const isOnCall = day.dutyType === "Emergency On-Call";

          const cardBorder = isToday
            ? "border-sky-500/70 shadow-lg shadow-sky-950/40"
            : isOff
              ? "border-slate-800/60 opacity-60"
              : isSurgery
                ? "border-amber-500/40"
                : isOnCall
                  ? "border-red-500/30"
                  : "border-slate-800";

          return (
            <div
              key={idx}
              className={`p-4 rounded-xl bg-[#0B1120] border ${cardBorder} flex flex-col justify-between gap-3`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-100">
                      {day.dayName}
                    </div>
                    <div className="text-xs font-mono text-slate-400">{day.dateStr}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      isToday
                        ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                        : isOff
                          ? "bg-slate-800 text-slate-400"
                          : isSurgery
                            ? "bg-amber-950/60 text-amber-300 border border-amber-800/80"
                            : isOnCall
                              ? "bg-red-950/60 text-red-300 border border-red-800/80"
                              : "bg-emerald-950/60 text-emerald-300 border border-emerald-800/80"
                    }`}
                  >
                    {day.dutyType}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300 font-mono">
                    <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>{day.hours}</span>
                  </div>
                  {!isOff && (
                    <>
                      <div className="flex items-center gap-1.5 text-slate-400 font-mono">
                        <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{day.location} ({day.ward} Ward)</span>
                      </div>
                      <div className="text-[11px] text-slate-500 pt-1">
                        Shift: <strong className="text-slate-300">{day.shiftName}</strong>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">
                  {isToday ? "Active Clinical Shift" : "Scheduled"}
                </span>
                <span className="font-semibold text-sky-400">
                  {isOff ? "Standby Off" : "Confirmed"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
