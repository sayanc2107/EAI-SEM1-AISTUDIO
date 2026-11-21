import { useMemo, useState } from "react";
import {
  Check,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import { ApiRequestError, runAIOptimization } from "../services/aiClient";
import type {
  OptimizationAIResult,
  OptimizationRecommendation,
  WardType,
} from "../types/hospital";
import { DoctorAvatar } from "./DoctorAvatar";

const WARD_FILTERS: Array<"All" | WardType> = [
  "All",
  "ICU",
  "Emergency",
  "Cardiology",
  "General",
];

export function WardsView() {
  const {
    beds,
    doctors,
    patients,
    setBedStatus,
    clearAllCleaningBeds,
    cycleDoctorStatus,
    pushToast,
  } = useHospital();

  const [wardFilter, setWardFilter] = useState<"All" | WardType>("All");
  const [optimization, setOptimization] = useState<OptimizationAIResult | null>(null);
  const [appliedRecIds, setAppliedRecIds] = useState<string[]>([]);
  const [loadingOpt, setLoadingOpt] = useState(false);
  const [optError, setOptError] = useState<{ message: string; hint?: string } | null>(null);

  const visibleBeds = useMemo(
    () => (wardFilter === "All" ? beds : beds.filter((b) => b.ward === wardFilter)),
    [beds, wardFilter]
  );

  const cleaningCount = beds.filter((b) => b.status === "Cleaning").length;

  async function handleRunOptimizer() {
    setLoadingOpt(true);
    setOptError(null);
    setAppliedRecIds([]);
    try {
      const result = await runAIOptimization({ beds, doctors, patients });
      setOptimization(result);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setOptError({ message: err.message, hint: err.hint });
      } else {
        setOptError({ message: "Could not complete AI resource optimization." });
      }
    } finally {
      setLoadingOpt(false);
    }
  }

  async function handleApplyRecommendation(rec: OptimizationRecommendation) {
    if (rec.actionType === "clear_cleaning_beds") {
      const cleared = await clearAllCleaningBeds();
      if (cleared === 0) {
        pushToast("No beds in cleaning queue", "All sanitized beds are already open.", "info");
      }
    } else if (rec.actionType === "activate_oncall_doctor") {
      const targetDoc =
        doctors.find((d) => d.id === rec.targetId) ||
        doctors.find((d) => d.status === "On Call");
      if (targetDoc) {
        await cycleDoctorStatus(targetDoc.id, "On Duty");
      } else {
        pushToast("No On-Call doctor waiting", "All eligible specialists are already active.", "info");
      }
    } else {
      pushToast("Advisory acknowledged", rec.title, "info");
    }
    setAppliedRecIds((prev) => [...prev, rec.id]);
  }

  return (
    <div className="space-y-8">
      {/* AI Resource Optimizer Command Panel */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              AI Ward & Shift Resource Optimizer
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Audits live bed utilization, cleaning turnarounds, and doctor-to-patient ratios using Gemini API.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {cleaningCount > 0 && (
              <button
                type="button"
                onClick={() => clearAllCleaningBeds()}
                className="px-3.5 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
              >
                Finish {cleaningCount} Cleaning Bed{cleaningCount > 1 ? "s" : ""}
              </button>
            )}
            <button
              type="button"
              onClick={handleRunOptimizer}
              disabled={loadingOpt}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              {loadingOpt ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {loadingOpt ? "Auditing Capacity..." : "Optimize Resources with AI"}
            </button>
          </div>
        </div>

        {optError && (
          <div className="mt-5 p-4 rounded-lg bg-red-950/40 border border-red-900/70 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-red-300">{optError.message}</p>
              {optError.hint && <p className="text-xs text-red-400 mt-0.5">{optError.hint}</p>}
            </div>
            <button
              type="button"
              onClick={handleRunOptimizer}
              className="px-3 py-1.5 rounded-md border border-red-700 text-xs font-medium text-red-200 hover:bg-red-900/40 whitespace-nowrap cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {loadingOpt && (
          <div className="mt-5 space-y-3 animate-pulse">
            <div className="h-4 w-2/3 bg-slate-800 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="h-28 bg-slate-800/70 rounded-lg" />
              <div className="h-28 bg-slate-800/70 rounded-lg" />
              <div className="h-28 bg-slate-800/70 rounded-lg" />
            </div>
          </div>
        )}

        {!loadingOpt && !optimization && !optError && (
          <p className="mt-5 text-sm text-slate-400 leading-relaxed">
            Run the live optimizer to inspect all {beds.length} beds and {doctors.length} physicians for overcrowding risks, sanitation delays, and shift rebalancing actions.
          </p>
        )}

        {!loadingOpt && optimization && (
          <div className="mt-5 space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-slate-200 max-w-3xl leading-relaxed">
                {optimization.riskSummary}
              </p>
              <span
                className={`text-xs font-semibold ${
                  optimization.overallStatus === "High Strain"
                    ? "text-red-400"
                    : optimization.overallStatus === "Elevated Load"
                      ? "text-amber-400"
                      : "text-emerald-400"
                }`}
              >
                Load Status: {optimization.overallStatus}
              </span>
            </div>

            {optimization.bottlenecks.length > 0 && (
              <div className="text-xs text-slate-400 space-y-1">
                <span className="font-medium text-slate-300">Observed Bottlenecks:</span>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-amber-300/90">
                  {optimization.bottlenecks.map((b, i) => (
                    <span key={i}>
                      {i + 1}. {b}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {optimization.recommendations.map((rec) => {
                const isApplied = appliedRecIds.includes(rec.id);
                return (
                  <div
                    key={rec.id}
                    className="p-4 rounded-lg bg-[#0B1120] border border-slate-800 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="text-sm font-semibold text-slate-100">{rec.title}</div>
                      <p className="text-xs text-slate-400 leading-relaxed">{rec.detail}</p>
                      <p className="text-xs text-sky-400 font-medium pt-1">
                        Expected Impact: {rec.impact}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isApplied}
                      onClick={() => handleApplyRecommendation(rec)}
                      className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        isApplied
                          ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/70"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"
                      }`}
                    >
                      {isApplied ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Applied to Hospital State
                        </>
                      ) : rec.actionType === "clear_cleaning_beds" ? (
                        "Mark Cleaning Beds Available"
                      ) : rec.actionType === "activate_oncall_doctor" ? (
                        "Move Specialist to On Duty"
                      ) : (
                        "Acknowledge Recommendation"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Interactive Bed Occupancy Matrix */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Interactive Ward & Bed Matrix
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any Cleaning bed to mark it sanitized and Available for ER triage.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B1120] border border-slate-800 overflow-x-auto">
            {WARD_FILTERS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWardFilter(w)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  wardFilter === w
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {visibleBeds.map((bed) => {
            const occupant = bed.patientId
              ? patients.find((p) => p.id === bed.patientId)
              : null;

            const statusColor =
              bed.status === "Occupied"
                ? "text-sky-400"
                : bed.status === "Cleaning"
                  ? "text-amber-400"
                  : "text-emerald-400";

            return (
              <div
                key={bed.id}
                className="p-4 rounded-lg bg-[#0B1120] border border-slate-800 flex flex-col justify-between gap-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-100 tabular-nums">
                    {bed.id}
                  </span>
                  <span className={`text-xs font-semibold ${statusColor}`}>{bed.status}</span>
                </div>

                <div className="text-xs text-slate-400 min-h-[2.25rem]">
                  {occupant ? (
                    <>
                      <div className="text-slate-200 font-medium truncate">{occupant.name}</div>
                      <div className="mt-0.5 truncate">
                        {occupant.severity} · {occupant.department}
                      </div>
                    </>
                  ) : bed.status === "Cleaning" ? (
                    <span>Sanitization in progress before next admission</span>
                  ) : (
                    <span>Ready for immediate {bed.ward} intake</span>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-500">{bed.ward} Ward</span>
                  {bed.status === "Cleaning" && (
                    <button
                      type="button"
                      onClick={() => setBedStatus(bed.id, "Available")}
                      className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap cursor-pointer"
                    >
                      <Wrench className="w-3 h-3" /> Mark Ready
                    </button>
                  )}
                  {bed.status === "Available" && (
                    <button
                      type="button"
                      onClick={() => setBedStatus(bed.id, "Cleaning")}
                      className="text-slate-400 hover:text-slate-200 whitespace-nowrap cursor-pointer"
                    >
                      Queue Cleaning
                    </button>
                  )}
                  {bed.status === "Occupied" && occupant && (
                    <span className="font-mono tabular-nums text-slate-400">
                      SpO2 {occupant.vitals.spo2}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Attending Doctor Shift Roster */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Attending Physicians & Shift Roster
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Click a physician's status action to update live shift coverage.
            </p>
          </div>
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
        </div>

        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400">
                <th className="py-3 pr-4 font-medium">Physician</th>
                <th className="py-3 px-3 font-medium">Specialty & Shift</th>
                <th className="py-3 px-3 font-medium">Status</th>
                <th className="py-3 px-3 font-medium text-right">Active Patient Load</th>
                <th className="py-3 pl-3 font-medium text-right">Shift Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-sm">
              {doctors.map((doc) => {
                const loadPct = Math.min(
                  100,
                  Math.round((doc.activePatientsCount / doc.maxCapacity) * 100)
                );
                const statusColor =
                  doc.status === "On Duty"
                    ? "text-emerald-400"
                    : doc.status === "On Call"
                      ? "text-sky-400"
                      : doc.status === "In Surgery"
                        ? "text-amber-400"
                        : "text-slate-500";

                return (
                  <tr key={doc.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <DoctorAvatar
                          name={doc.name}
                          initials={doc.initials}
                          avatarUrl={doc.avatarUrl}
                        />
                        <div>
                          <div className="font-medium text-slate-100">{doc.name}</div>
                          <div className="text-xs text-slate-500 font-mono">{doc.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="text-slate-200">{doc.specialty}</div>
                      <div className="text-xs text-slate-400">{doc.shift} Shift</div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`text-xs font-semibold ${statusColor}`}>{doc.status}</span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <div className="inline-flex flex-col items-end gap-1">
                        <span className="font-mono text-xs tabular-nums text-slate-200">
                          {doc.activePatientsCount} / {doc.maxCapacity} patients
                        </span>
                        <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              loadPct >= 80 ? "bg-amber-500" : "bg-sky-500"
                            }`}
                            style={{ width: `${loadPct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => cycleDoctorStatus(doc.id)}
                        className="px-3 py-1.5 rounded-md border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Cycle Status
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
