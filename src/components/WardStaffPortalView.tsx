import { useMemo, useState } from "react";
import {
  Check,
  Clock,
  MapPin,
  Navigation,
  RefreshCw,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import { ApiRequestError, runAIWardPredict } from "../services/aiClient";
import type { WardCallPredictAIResult, WardType } from "../types/hospital";
import { DoctorAvatar } from "./DoctorAvatar";

const WARD_FILTERS: Array<"All" | WardType> = [
  "All",
  "ICU",
  "Emergency",
  "Cardiology",
  "General",
];

export function WardStaffPortalView() {
  const {
    myShift,
    doctorLocations,
    beds,
    patients,
    setBedStatus,
    clearAllCleaningBeds,
    pushToast,
  } = useHospital();

  const [wardFilter, setWardFilter] = useState<"All" | WardType>("All");
  const [prediction, setPrediction] = useState<WardCallPredictAIResult | null>(null);
  const [loadingPredict, setLoadingPredict] = useState(false);
  const [predictError, setPredictError] = useState<{
    message: string;
    hint?: string;
  } | null>(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>([]);

  // Strictly ONLY doctors currently "On Duty" + where they are + when their shift ends
  const onDutyDoctors = useMemo(
    () => doctorLocations.filter((d) => d.status === "On Duty"),
    [doctorLocations]
  );

  const activePatients = useMemo(
    () => patients.filter((p) => p.status === "Admitted"),
    [patients]
  );

  const visibleBeds = useMemo(
    () => (wardFilter === "All" ? beds : beds.filter((b) => b.ward === wardFilter)),
    [beds, wardFilter]
  );

  const cleaningCount = useMemo(
    () => beds.filter((b) => b.status === "Cleaning").length,
    [beds]
  );

  async function handleRunWardPredictor() {
    setLoadingPredict(true);
    setPredictError(null);
    setAcknowledgedIds([]);
    try {
      const result = await runAIWardPredict({
        wardStaffShift: myShift,
        beds,
        activePatients,
        onDutyDoctors,
      });
      setPrediction(result);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setPredictError({ message: err.message, hint: err.hint });
      } else {
        setPredictError({ message: "Could not run AI ward call prediction." });
      }
    } finally {
      setLoadingPredict(false);
    }
  }

  function handlePrePosition(id: string, zone: string) {
    setAcknowledgedIds((prev) => [...prev, id]);
    pushToast("Marked En Route", `Pre-positioning early at ${zone} to prevent delay`, "success");
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Ward Staff Full Shift Card (ONLY own shift) */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wider text-sky-400">
            My Full Shift Schedule
          </div>
          <h2 className="text-lg font-semibold text-slate-50">
            {myShift?.name || "Ward Support Staff"}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
            <span>{myShift?.specialty || "Ward Operations & Turnover"}</span>
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
              Assigned Zone:{" "}
              <strong className="text-slate-200">
                {myShift?.location || "Emergency & ICU Corridor"}
              </strong>
            </span>
          </div>
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
            onClick={handleRunWardPredictor}
            disabled={loadingPredict}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            {loadingPredict ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {loadingPredict ? "Detecting Upcoming Calls..." : "Predict Where I'll Be Called"}
          </button>
        </div>
      </section>

      {/* Row 2: Proactive AI Early-Call Predictor */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              AI Early-Call & Pre-Positioning Predictor
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Detects critical patient transfers, bed sanitizations, and shift handovers early so you arrive before a call is even placed.
            </p>
          </div>
          <Navigation className="w-4 h-4 text-sky-400 shrink-0 mt-1" />
        </div>

        {predictError && (
          <div className="p-4 rounded-lg bg-red-950/40 border border-red-900/70 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-red-300">{predictError.message}</p>
              {predictError.hint && (
                <p className="text-xs text-red-400 mt-0.5">{predictError.hint}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleRunWardPredictor}
              className="px-3 py-1.5 rounded-md border border-red-700 text-xs font-medium text-red-200 hover:bg-red-900/40 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {loadingPredict && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
            <div className="h-32 bg-slate-800/70 rounded-lg" />
            <div className="h-32 bg-slate-800/70 rounded-lg" />
            <div className="h-32 bg-slate-800/70 rounded-lg" />
          </div>
        )}

        {!loadingPredict && !prediction && !predictError && (
          <p className="text-sm text-slate-400 leading-relaxed">
            Click <strong className="text-slate-200">Predict Where I'll Be Called</strong> to scan
            live bed turnarounds, critical admissions, and on-duty doctor movements for likely
            upcoming ward calls.
          </p>
        )}

        {!loadingPredict && prediction && (
          <div className="space-y-4">
            <p className="text-sm text-slate-200 leading-relaxed">{prediction.summary}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {prediction.predictions.map((item) => {
                const isAck = acknowledgedIds.includes(item.id);
                const urgencyColor =
                  item.urgency === "Immediate"
                    ? "text-red-400"
                    : item.urgency === "Soon"
                      ? "text-amber-400"
                      : "text-sky-400";
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg bg-[#0B1120] border border-slate-800 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-100">
                            {item.targetZone}
                          </div>
                          <div className="text-xs font-mono text-slate-400">
                            {item.bedOrRoom} · Est. call in ~{item.etaMinutes} min
                          </div>
                        </div>
                        <span className={`text-xs font-semibold shrink-0 ${urgencyColor}`}>
                          {item.urgency}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{item.reason}</p>
                      <p className="text-xs text-sky-400">
                        Bring / Prep: {item.recommendedPrep}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isAck}
                      onClick={() => handlePrePosition(item.id, item.targetZone)}
                      className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        isAck
                          ? "bg-emerald-950/60 border border-emerald-800/70 text-emerald-300"
                          : "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100"
                      }`}
                    >
                      {isAck ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> En Route Early
                        </>
                      ) : (
                        "Mark En Route Early"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Row 3: On-Duty Doctors (Location + Shift End ONLY) + Ward Bed Turnover Board */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* On-Duty Doctors ONLY */}
        <section className="xl:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="pb-4 border-b border-slate-800">
            <h2 className="text-base font-semibold text-slate-100">
              Currently On-Duty Doctors ({onDutyDoctors.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live unit locations and shift end times for doctors currently on duty.
            </p>
          </div>

          {onDutyDoctors.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No doctors are currently marked On Duty.
            </div>
          ) : (
            <div className="space-y-2.5">
              {onDutyDoctors.map((doc) => (
                <div
                  key={doc.doctorId}
                  className="p-3.5 rounded-lg bg-[#0B1120] border border-slate-800 flex items-center justify-between gap-3"
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
                      <MapPin className="w-3 h-3" />
                      {doc.location}
                    </div>
                    <div className="text-xs font-mono tabular-nums text-amber-300 mt-0.5">
                      Shift ends {doc.shiftEnd}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Ward Bed Turnover Matrix */}
        <section className="xl:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Ward Bed Turnover Queue
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Sanitize Cleaning beds and mark them Available for ER admissions.
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B1120] border border-slate-800 overflow-x-auto">
              {WARD_FILTERS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWardFilter(w)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleBeds.map((bed) => {
              const statusColor =
                bed.status === "Occupied"
                  ? "text-sky-400"
                  : bed.status === "Cleaning"
                    ? "text-amber-400"
                    : "text-emerald-400";
              return (
                <div
                  key={bed.id}
                  className="p-3.5 rounded-lg bg-[#0B1120] border border-slate-800 flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-sm font-semibold text-slate-100">
                      {bed.id}
                    </span>
                    <span className={`text-xs font-semibold ${statusColor}`}>{bed.status}</span>
                  </div>
                  <div className="text-xs text-slate-400">{bed.ward} Ward</div>
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end">
                    {bed.status === "Cleaning" ? (
                      <button
                        type="button"
                        onClick={() => setBedStatus(bed.id, "Available")}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                      >
                        <Wrench className="w-3 h-3" /> Mark Ready
                      </button>
                    ) : bed.status === "Available" ? (
                      <button
                        type="button"
                        onClick={() => setBedStatus(bed.id, "Cleaning")}
                        className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        Queue Cleaning
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">Patient Admitted</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
