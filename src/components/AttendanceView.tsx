import React, { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  History,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  UserCheck,
  Users,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import type { AttendanceRecord, UserRole } from "../types/hospital";

export function AttendanceView() {
  const {
    attendanceRecords,
    clockIn,
    clockOut,
    userProfile,
    isActualAdmin,
    activeRole,
    staffDirectory,
  } = useHospital();

  const [filterRole, setFilterRole] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [clocking, setClocking] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];

  // Find current user's today attendance status
  const myTodayRecord = useMemo(() => {
    if (!userProfile) return null;
    return (
      attendanceRecords.find(
        (r) =>
          r.staffId === userProfile.linkedStaffId &&
          (r.date === todayStr || r.date === "Today")
      ) || null
    );
  }, [attendanceRecords, userProfile, todayStr]);

  const isClockedIn = myTodayRecord?.status === "Clocked In";

  async function handleToggleClock() {
    setClocking(true);
    try {
      if (isClockedIn && myTodayRecord) {
        await clockOut(myTodayRecord.id);
      } else {
        await clockIn();
      }
    } finally {
      setClocking(false);
    }
  }

  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter((r) => {
      if (filterRole !== "All" && r.role !== filterRole) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.staffName.toLowerCase().includes(q) ||
          r.staffId.toLowerCase().includes(q) ||
          r.role.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [attendanceRecords, filterRole, search]);

  const totalPresentToday = useMemo(
    () => attendanceRecords.filter((r) => r.status === "Clocked In").length,
    [attendanceRecords]
  );

  return (
    <div className="space-y-6">
      {/* Attendance Punch Card */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-sky-400">
            Biometric & Shift Attendance
          </div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mt-0.5">
            <Clock className="w-5 h-5 text-sky-400" />
            Duty Punch-In & Shift Attendance Tracker
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Logged hours and shifts directly sync with monthly payroll hours, overtime bonuses, and duty verification.
          </p>
        </div>

        {/* User Punch Button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-xs text-slate-400">Your Current Status:</div>
            <div className={`text-xs font-semibold ${isClockedIn ? "text-emerald-400" : "text-amber-400"}`}>
              {isClockedIn
                ? `Clocked In (${myTodayRecord?.clockInTime || "Today"})`
                : "Clocked Out"}
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleClock}
            disabled={clocking}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isClockedIn
                ? "bg-red-500 hover:bg-red-400 text-slate-950"
                : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
            }`}
          >
            {clocking ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : isClockedIn ? (
              <LogOut className="w-4 h-4" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {isClockedIn ? "Clock Out Now" : "Clock In / Punch In"}
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Currently On Duty (Clocked In)</div>
          <div className="mt-1 text-2xl font-bold font-mono text-emerald-400">
            {totalPresentToday}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Active across hospital departments</div>
        </div>
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Total Registered Staff</div>
          <div className="mt-1 text-2xl font-bold font-mono text-slate-100">
            {staffDirectory.length || 14}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Doctors, nurses, ward staff & accountants</div>
        </div>
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Payroll Calculation Method</div>
          <div className="mt-1 text-sm font-semibold text-sky-300">
            Automated Biometric Sync
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Verified daily shift completion</div>
        </div>
      </div>

      {/* Hospital-Wide Attendance Records List */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Staff Attendance & Shift Hours Register
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live timestamps of staff check-in, check-out, and total duty hours.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff name or ID..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="All">All Roles</option>
              <option value="doctor">Doctors</option>
              <option value="nurse">Nurses</option>
              <option value="ward_staff">Ward Staff</option>
              <option value="pharmacist">Pharmacists</option>
              <option value="accountant">Accountants</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-[#0B1120] text-slate-400 font-medium">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Clock-In</th>
                <th className="py-3 px-4">Clock-Out</th>
                <th className="py-3 px-4">Total Hours</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredRecords.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-100">
                    {r.staffName}
                    <div className="text-[11px] text-slate-500 font-mono font-normal">
                      {r.staffId}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-300 capitalize">{r.role.replace("_", " ")}</td>
                  <td className="py-3 px-4 font-mono text-slate-400">{r.date}</td>
                  <td className="py-3 px-4 font-mono text-emerald-400">{r.clockInTime}</td>
                  <td className="py-3 px-4 font-mono text-slate-300">{r.clockOutTime || "—"}</td>
                  <td className="py-3 px-4 font-mono text-sky-400">{r.totalHours ? `${r.totalHours} hrs` : "In Progress"}</td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        r.status === "Clocked In"
                          ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/80"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
