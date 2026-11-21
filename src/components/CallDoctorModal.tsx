import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  MapPin,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  Search,
  Stethoscope,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import { DoctorAvatar } from "./DoctorAvatar";

interface CallDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDoctorId?: string;
  contextNote?: string;
  callerRole?: string;
}

export function CallDoctorModal({
  isOpen,
  onClose,
  defaultDoctorId,
  contextNote,
  callerRole,
}: CallDoctorModalProps) {
  const { doctorLocations, userProfile, pushToast } = useHospital();
  const [search, setSearch] = useState("");
  const [activeCallDocId, setActiveCallDocId] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callNote, setCallNote] = useState(contextNote || "");
  const [callStatus, setCallStatus] = useState<"dialing" | "connected" | "ended">("dialing");

  const activeDoc = useMemo(() => {
    if (!activeCallDocId) return null;
    return doctorLocations.find((d) => d.doctorId === activeCallDocId) || null;
  }, [activeCallDocId, doctorLocations]);

  useEffect(() => {
    if (defaultDoctorId && isOpen) {
      handleInitiateCall(defaultDoctorId);
    }
  }, [defaultDoctorId, isOpen]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeCallDocId && callStatus === "connected") {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeCallDocId, callStatus]);

  if (!isOpen) return null;

  const filteredDoctors = doctorLocations.filter((d) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      d.name.toLowerCase().includes(q) ||
      d.specialty.toLowerCase().includes(q) ||
      d.location.toLowerCase().includes(q)
    );
  });

  function handleInitiateCall(docId: string) {
    setActiveCallDocId(docId);
    setCallStatus("dialing");
    setCallDuration(0);

    setTimeout(() => {
      setCallStatus("connected");
      pushToast(
        "Call Connected",
        `Direct hospital tele-line connected with ${doctorLocations.find((d) => d.doctorId === docId)?.name || docId}`,
        "success"
      );
    }, 1400);
  }

  function handleEndCall() {
    setCallStatus("ended");
    setTimeout(() => {
      setActiveCallDocId(null);
      setCallDuration(0);
      setCallStatus("dialing");
    }, 600);
  }

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Hospital Tele-Directory & Emergency Call
              </h3>
              <p className="text-xs text-slate-400">
                Connect directly with attending and on-duty doctors across hospital wings.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Active Call Screen vs Directory */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeDoc ? (
            /* Active Call In-Progress Screen */
            <div className="py-6 flex flex-col items-center justify-center space-y-6 text-center">
              <div className="relative">
                <DoctorAvatar
                  name={activeDoc.name}
                  initials={activeDoc.initials}
                  avatarUrl={activeDoc.avatarUrl}
                  size="md"
                />
                {callStatus === "connected" && (
                  <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#111827] animate-pulse" />
                )}
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-100">{activeDoc.name}</h4>
                <p className="text-xs text-sky-400 font-medium mt-0.5">
                  {activeDoc.specialty} · Unit: {activeDoc.location}
                </p>
                <div className="mt-2 text-sm font-mono text-slate-300">
                  {callStatus === "dialing" ? (
                    <span className="text-amber-400 animate-pulse">Connecting secure line...</span>
                  ) : callStatus === "connected" ? (
                    <span className="text-emerald-400 font-semibold">
                      Connected ({formatTime(callDuration)})
                    </span>
                  ) : (
                    <span className="text-slate-500">Call Ended</span>
                  )}
                </div>
              </div>

              {/* Call Controls */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setIsMuted((prev) => !prev)}
                  className={`p-3 rounded-full border transition-colors cursor-pointer ${
                    isMuted
                      ? "bg-red-500/20 border-red-500/40 text-red-400"
                      : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                  }`}
                  aria-label="Toggle Mute"
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  onClick={handleEndCall}
                  className="p-4 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg transition-transform active:scale-95 cursor-pointer"
                  aria-label="End Call"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsSpeakerOn((prev) => !prev)}
                  className={`p-3 rounded-full border transition-colors cursor-pointer ${
                    !isSpeakerOn
                      ? "bg-slate-800 border-slate-700 text-slate-400"
                      : "bg-sky-500/20 border-sky-500/40 text-sky-300"
                  }`}
                  aria-label="Toggle Speaker"
                >
                  {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>
              </div>

              {/* Quick Clinical Handover Note Input */}
              <div className="w-full max-w-md text-left pt-4 border-t border-slate-800/80 space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Call Handover Notes & Directives (Transcribed)
                </label>
                <textarea
                  value={callNote}
                  onChange={(e) => setCallNote(e.target.value)}
                  placeholder="Record verbal advice, stat prescription authorizations, or bed transfer approvals..."
                  rows={2}
                  className="w-full p-2.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          ) : (
            /* Doctors List for Calling */
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search doctor by name, specialty, or ward location..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {filteredDoctors.map((doc) => {
                  const isAvailable = doc.status === "On Duty" || doc.status === "On Call";
                  const statusBg =
                    doc.status === "On Duty"
                      ? "text-emerald-400"
                      : doc.status === "In Surgery"
                        ? "text-amber-400"
                        : "text-sky-400";

                  return (
                    <div
                      key={doc.doctorId}
                      className="p-3.5 rounded-xl bg-[#0B1120] border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
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
                          <div className="text-xs text-slate-400 truncate">
                            {doc.specialty} · <span className={statusBg}>{doc.status}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 font-mono">
                            <MapPin className="w-3 h-3 text-sky-400" /> {doc.location} · Shift ends {doc.shiftEnd}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleInitiateCall(doc.doctorId)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                          doc.status === "In Surgery"
                            ? "bg-amber-950/60 text-amber-300 border border-amber-800/70 hover:bg-amber-900/60"
                            : "bg-sky-500 hover:bg-sky-400 text-slate-950"
                        }`}
                      >
                        <Phone className="w-3 h-3" />
                        {doc.status === "In Surgery" ? "Emergency Page" : "Call Now"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#0B1120]/50 flex items-center justify-between text-xs text-slate-400">
          <span>Logged in as: <strong className="text-slate-200">{userProfile?.displayName}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md border border-slate-700 hover:bg-slate-800 text-slate-300 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
