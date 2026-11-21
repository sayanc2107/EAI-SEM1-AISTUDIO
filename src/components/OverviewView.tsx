import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BedDouble,
  RefreshCw,
  Stethoscope,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import { ApiRequestError, runAIBriefing } from "../services/aiClient";
import type { BriefingAIResult, WardType, WorkspaceTab } from "../types/hospital";

interface OverviewViewProps {
  onNavigate: (tab: WorkspaceTab) => void;
}

const WARDS: WardType[] = ["ICU", "Emergency", "Cardiology", "General"];

export function OverviewView({ onNavigate }: OverviewViewProps) {
  const { patients, beds, doctors, inventory, activity } = useHospital();
  const [briefing, setBriefing] = useState<BriefingAIResult | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [briefingError, setBriefingError] = useState<{
    message: string;
    hint?: string;
  } | null>(null);

  const activePatients = patients.filter((p) => p.status === "Admitted");
  const criticalPatients = activePatients.filter((p) => p.severity === "Critical");
  const occupiedBeds = beds.filter((b) => b.status === "Occupied").length;
  const availableBeds = beds.filter((b) => b.status === "Available").length;
  const occupancyPct = beds.length > 0 ? Math.round((occupiedBeds / beds.length) * 100) : 0;
  const lowStockItems = inventory.filter((item) => item.stock <= item.minThreshold);
  const onDutyDoctors = doctors.filter((d) => d.status === "On Duty").length;

  async function handleGenerateBriefing() {
    setLoadingBriefing(true);
    setBriefingError(null);
    try {
      const wardBreakdown = WARDS.map((ward) => {
        const wBeds = beds.filter((b) => b.ward === ward);
        return {
          ward,
          occupied: wBeds.filter((b) => b.status === "Occupied").length,
          cleaning: wBeds.filter((b) => b.status === "Cleaning").length,
          available: wBeds.filter((b) => b.status === "Available").length,
          total: wBeds.length,
        };
      });

      const result = await runAIBriefing({
        activePatientCount: activePatients.length,
        criticalPatients: criticalPatients.map((p) => ({
          name: p.name,
          department: p.department,
          bed: p.assignedBedId,
          spo2: p.vitals.spo2,
          heartRate: p.vitals.heartRate,
        })),
        occupancyPct,
        wardBreakdown,
        doctorsOnDuty: onDutyDoctors,
        totalDoctors: doctors.length,
        lowStockSupplies: lowStockItems.map((i) => ({
          name: i.name,
          stock: i.stock,
          minThreshold: i.minThreshold,
          unit: i.unit,
        })),
      });
      setBriefing(result);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setBriefingError({ message: err.message, hint: err.hint });
      } else {
        setBriefingError({ message: "Unable to generate shift briefing." });
      }
    } finally {
      setLoadingBriefing(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* KPI Metric Strip — Flat 1px grid, tabular numerals */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Admitted Patients</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-semibold font-mono tabular-nums text-slate-50">
              {activePatients.length}
            </span>
            <span className="text-xs font-medium text-red-400 font-mono tabular-nums">
              {criticalPatients.length} Critical
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Across Emergency, ICU, Cardiology, and General wards
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Hospital Bed Occupancy</span>
            <BedDouble className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-semibold font-mono tabular-nums text-slate-50">
              {occupancyPct}%
            </span>
            <span className="text-xs font-medium text-emerald-400 font-mono tabular-nums">
              {availableBeds} Open
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 font-mono tabular-nums">
            {occupiedBeds} of {beds.length} beds currently occupied
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Attending Physicians</span>
            <Stethoscope className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-semibold font-mono tabular-nums text-slate-50">
              {onDutyDoctors}
              <span className="text-base text-slate-500 font-normal">/{doctors.length}</span>
            </span>
            <span className="text-xs font-medium text-sky-400">On Duty</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {doctors.filter((d) => d.status === "On Call").length} specialists available on call
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Pharmacy Supply Alerts</span>
            <AlertTriangle
              className={`w-4 h-4 ${
                lowStockItems.length > 0 ? "text-amber-400" : "text-emerald-400"
              }`}
            />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-semibold font-mono tabular-nums text-slate-50">
              {lowStockItems.length}
            </span>
            <span
              className={`text-xs font-medium ${
                lowStockItems.length > 0 ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {lowStockItems.length > 0 ? "Below Safety Level" : "Nominal Stock"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Tracked across {inventory.length} clinical catalog items
          </p>
        </div>
      </section>

      {/* Primary Focal Anchor: Live AI Executive Shift Briefing */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">
              Live AI Executive Shift Briefing
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Synthesizes real-time ER acuity, ward capacity, staffing, and pharmacy alerts via Gemini API.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateBriefing}
            disabled={loadingBriefing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loadingBriefing ? "animate-spin" : ""}`} />
            {loadingBriefing ? "Analyzing Live State..." : briefing ? "Refresh Briefing" : "Generate AI Briefing"}
          </button>
        </div>

        {briefingError && (
          <div className="mt-5 p-4 rounded-lg bg-red-950/40 border border-red-900/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-red-300">{briefingError.message}</p>
              {briefingError.hint && (
                <p className="text-xs text-red-400/90 mt-0.5">{briefingError.hint}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleGenerateBriefing}
              className="px-3 py-1.5 rounded-md border border-red-700 text-xs font-medium text-red-200 hover:bg-red-900/50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {loadingBriefing && (
          <div className="mt-5 space-y-3 animate-pulse">
            <div className="h-5 w-2/3 bg-slate-800 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2.5">
                <div className="h-4 w-full bg-slate-800/80 rounded" />
                <div className="h-4 w-5/6 bg-slate-800/80 rounded" />
                <div className="h-4 w-4/5 bg-slate-800/80 rounded" />
              </div>
              <div className="space-y-2.5">
                <div className="h-4 w-full bg-slate-800/80 rounded" />
                <div className="h-4 w-5/6 bg-slate-800/80 rounded" />
              </div>
            </div>
          </div>
        )}

        {!loadingBriefing && !briefing && !briefingError && (
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-slate-400">
            <p className="max-w-2xl leading-relaxed">
              Click <span className="text-slate-200 font-medium">Generate AI Briefing</span> to run live clinical risk analysis across {activePatients.length} active patients, {beds.length} hospital beds, and {lowStockItems.length} low-stock supply alerts.
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-400 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate("triage")}
                className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 font-medium whitespace-nowrap cursor-pointer"
              >
                Open ER Triage <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate("copilot")}
                className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white font-medium whitespace-nowrap cursor-pointer"
              >
                Open AI Copilot <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {!loadingBriefing && briefing && (
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-100">{briefing.headline}</h3>
              <span
                className={`text-xs font-medium ${
                  briefing.operationalMood === "High Alert"
                    ? "text-red-400"
                    : briefing.operationalMood === "Watchful"
                      ? "text-amber-400"
                      : "text-emerald-400"
                }`}
              >
                Status: {briefing.operationalMood}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2.5">Operational Highlights</p>
                <ul className="space-y-2 text-sm text-slate-300">
                  {briefing.keyHighlights.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
                      <span className="text-sky-400 font-mono text-xs mt-0.5">0{idx + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2.5">Immediate Priorities</p>
                <ul className="space-y-2 text-sm text-slate-200">
                  {briefing.immediatePriorities.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
                      <span className="text-amber-400 font-mono text-xs mt-0.5">0{idx + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Two-Column Operations Grid: Ward Occupancy & Critical Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ward Occupancy Breakdown */}
        <section className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-100">Ward Capacity Status</h2>
              <button
                type="button"
                onClick={() => onNavigate("wards")}
                className="text-xs font-medium text-sky-400 hover:text-sky-300 whitespace-nowrap cursor-pointer"
              >
                Manage Wards
              </button>
            </div>

            <div className="space-y-5">
              {WARDS.map((ward) => {
                const wardBeds = beds.filter((b) => b.ward === ward);
                const occ = wardBeds.filter((b) => b.status === "Occupied").length;
                const clean = wardBeds.filter((b) => b.status === "Cleaning").length;
                const avail = wardBeds.filter((b) => b.status === "Available").length;
                const pct = wardBeds.length ? Math.round((occ / wardBeds.length) * 100) : 0;

                return (
                  <div key={ward}>
                    <div className="flex items-baseline justify-between text-sm mb-1.5">
                      <span className="font-medium text-slate-200">{ward} Ward</span>
                      <span className="text-xs text-slate-400 font-mono tabular-nums">
                        {occ}/{wardBeds.length} occupied · {avail} open
                        {clean > 0 ? ` · ${clean} cleaning` : ""}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          pct >= 75
                            ? "bg-red-500"
                            : pct >= 50
                              ? "bg-amber-500"
                              : "bg-sky-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Total Hospital Beds</span>
            <span className="font-mono tabular-nums text-slate-200">
              {occupiedBeds} Occupied · {beds.filter((b) => b.status === "Cleaning").length} Cleaning · {availableBeds} Open
            </span>
          </div>
        </section>

        {/* High-Acuity Patient Watchlist */}
        <section className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-100">
              High-Acuity ER & ICU Watchlist
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("triage")}
              className="text-xs font-medium text-sky-400 hover:text-sky-300 whitespace-nowrap cursor-pointer"
            >
              View All Patients
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400">
                  <th className="py-2.5 pr-4 font-medium">Patient</th>
                  <th className="py-2.5 px-3 font-medium">Severity</th>
                  <th className="py-2.5 px-3 font-medium">Bed</th>
                  <th className="py-2.5 px-3 font-medium text-right">HR / SpO2</th>
                  <th className="py-2.5 pl-3 font-medium text-right">BP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-sm">
                {activePatients
                  .filter((p) => p.severity === "Critical" || p.severity === "Urgent")
                  .slice(0, 5)
                  .map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-100">{p.name}</div>
                        <div className="text-xs text-slate-400">
                          {p.department} · {p.age}y {p.gender}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-xs font-semibold ${
                            p.severity === "Critical" ? "text-red-400" : "text-amber-400"
                          }`}
                        >
                          {p.severity}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-slate-300 tabular-nums">
                        {p.assignedBedId}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs tabular-nums">
                        <span className="text-slate-200">{p.vitals.heartRate} bpm</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span
                          className={
                            p.vitals.spo2 < 93 ? "text-red-400 font-semibold" : "text-slate-300"
                          }
                        >
                          {p.vitals.spo2}%
                        </span>
                      </td>
                      <td className="py-3 pl-3 text-right font-mono text-xs text-slate-300 tabular-nums">
                        {p.vitals.bloodPressure}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Live Clinical Operations Log */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-100">Recent Clinical Activity</h2>
          <span className="text-xs text-slate-400">Updated in real time as staff & AI act</span>
        </div>
        <div className="divide-y divide-slate-800/70">
          {activity.slice(0, 5).map((entry) => (
            <div
              key={entry.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
                  {entry.timestamp}
                </span>
                <span className="text-xs font-medium text-sky-400 shrink-0 w-24">
                  {entry.actor}
                </span>
                <span className="text-slate-300">{entry.message}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
