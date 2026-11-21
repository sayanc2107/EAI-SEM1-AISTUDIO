import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Flame,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Stethoscope,
  User,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import { ApiRequestError, runAICopilotQuery } from "../services/aiClient";
import type { Patient } from "../types/hospital";

interface ChatMessage {
  id: string;
  sender: "doctor" | "ai";
  text: string;
  time: string;
  patientContextId?: string;
  suggestedSteps?: string[];
}

export function DoctorAIChatbotView() {
  const { patients, myShift, activeStaffId, doctorLocations } = useHospital();
  const myDoctorId = myShift?.staffId || activeStaffId || "DOC-01";

  // Doctor's allotted active patients
  const myPatients = useMemo(
    () => patients.filter((p) => p.assignedDoctorId === myDoctorId && p.status === "Admitted"),
    [patients, myDoctorId]
  );

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    myPatients[0]?.id || (patients[0]?.id ?? "")
  );

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "ai",
      text: `Hello ${myShift?.name || "Doctor"}. I am your Clinical Decision-Support Assistant. You can ask me any clinical questions, check drug regimens, or click "Auto-Analyze Patient" above to examine your active bedside patients.`,
      time: "Now",
    },
  ]);

  async function handleAutoAnalyzePatient() {
    if (!selectedPatient) return;
    setLoading(true);

    const prompt = `Perform an emergency clinical evaluation for patient ${selectedPatient.name} (Age: ${selectedPatient.age}, Gender: ${selectedPatient.gender}, Department: ${selectedPatient.department}, Bed: ${selectedPatient.assignedBedId}).
Chief Symptoms: ${selectedPatient.symptoms}
Current Vitals: HR ${selectedPatient.vitals.heartRate} bpm, BP ${selectedPatient.vitals.bloodPressure}, SpO2 ${selectedPatient.vitals.spo2}%, Temp ${selectedPatient.vitals.temperature}°F.
Severity: ${selectedPatient.severity}.
Prior AI Assessment: ${selectedPatient.aiSummary}.
Provide:
1. Clinical Impression & Risk Level
2. Immediate next diagnostic tests / imaging
3. Immediate pharmacotherapy or intervention
4. Critical escalation triggers`;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "doctor",
      text: `Analyze patient ${selectedPatient.name} (${selectedPatient.id}, Bed ${selectedPatient.assignedBedId}) and advise next clinical steps.`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      patientContextId: selectedPatient.id,
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await runAICopilotQuery({
        query: prompt,
        systemState: {
          criticalPatientsCount: patients.filter((p) => p.severity === "Critical").length,
          availableBedsCount: 4,
          onDutyDoctorsCount: doctorLocations.filter((d) => d.status === "On Duty").length,
          pendingPrescriptionsCount: 3,
        },
      });

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: response.answer,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestedSteps: response.suggestedFollowUps,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "ai",
        text:
          err instanceof ApiRequestError
            ? `${err.message} ${err.hint || ""}`
            : "Clinical analysis could not complete. Please check network connection.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage(customText?: string) {
    const textToSend = (customText || input).trim();
    if (!textToSend || loading) return;

    setInput("");
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "doctor",
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const queryWithContext = selectedPatient
        ? `[Patient Context: ${selectedPatient.name}, ${selectedPatient.age}y ${selectedPatient.gender}, Bed ${selectedPatient.assignedBedId}, HR ${selectedPatient.vitals.heartRate}, BP ${selectedPatient.vitals.bloodPressure}, SpO2 ${selectedPatient.vitals.spo2}%, Symptoms: ${selectedPatient.symptoms}]\nDoctor Query: ${textToSend}`
        : textToSend;

      const response = await runAICopilotQuery({
        query: queryWithContext,
        systemState: {
          criticalPatientsCount: patients.filter((p) => p.severity === "Critical").length,
          availableBedsCount: 4,
          onDutyDoctorsCount: doctorLocations.filter((d) => d.status === "On Duty").length,
          pendingPrescriptionsCount: 3,
        },
      });

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: response.answer,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestedSteps: response.suggestedFollowUps,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "ai",
        text:
          err instanceof ApiRequestError
            ? `${err.message} ${err.hint || ""}`
            : "Clinical query service unavailable. Please retry in a moment.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[760px] shadow-2xl">
      {/* Top Patient Context Bar */}
      <div className="p-4 bg-[#0B1120] border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Clinical Copilot & Patient AI Analyzer
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Gemini Medical Active
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Interactive clinical decision assistant and diagnostic workflow optimizer.
            </p>
          </div>
        </div>

        {/* Patient Selector + Quick Analyze Button */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.assignedBedId} · {p.severity})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleAutoAnalyzePatient}
            disabled={loading || !selectedPatient}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Auto-Analyze Patient
          </button>
        </div>
      </div>

      {/* Selected Patient Live Vitals Banner */}
      {selectedPatient && (
        <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 font-mono text-slate-300">
            <span>Patient: <strong className="text-slate-100">{selectedPatient.name}</strong></span>
            <span>·</span>
            <span>HR: <strong className={selectedPatient.vitals.heartRate > 100 ? "text-red-400" : "text-emerald-400"}>{selectedPatient.vitals.heartRate} bpm</strong></span>
            <span>·</span>
            <span>BP: <strong>{selectedPatient.vitals.bloodPressure}</strong></span>
            <span>·</span>
            <span>SpO2: <strong className={selectedPatient.vitals.spo2 < 93 ? "text-red-400" : "text-emerald-400"}>{selectedPatient.vitals.spo2}%</strong></span>
          </div>
          <div className="text-[11px] text-slate-400 truncate max-w-sm">
            Dx: {selectedPatient.symptoms}
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.sender === "doctor" ? "flex-row-reverse" : ""
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                msg.sender === "doctor"
                  ? "bg-sky-500 text-slate-950 font-bold text-xs"
                  : "bg-slate-800 text-sky-400"
              }`}
            >
              {msg.sender === "doctor" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-[82%] rounded-2xl p-4 text-xs leading-relaxed space-y-2 ${
                msg.sender === "doctor"
                  ? "bg-sky-600 text-white rounded-tr-none"
                  : "bg-[#0B1120] border border-slate-800 text-slate-200 rounded-tl-none"
              }`}
            >
              <div className="whitespace-pre-line">{msg.text}</div>
              <div className={`text-[10px] font-mono ${msg.sender === "doctor" ? "text-sky-200" : "text-slate-500"}`}>
                {msg.time}
              </div>

              {/* Follow-up suggestions */}
              {msg.suggestedSteps && msg.suggestedSteps.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1">
                  <div className="text-[10px] font-semibold text-sky-400 uppercase tracking-wider">
                    Suggested Next Inquiries:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.suggestedSteps.map((step, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(step)}
                        className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] font-medium border border-slate-700 cursor-pointer text-left"
                      >
                        {step}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 animate-pulse pl-10">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
            Gemini is synthesizing clinical guidelines & patient metrics...
          </div>
        )}
      </div>

      {/* Suggested Quick Inquiries */}
      <div className="px-4 py-2 bg-[#0B1120] border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] text-slate-500 uppercase font-semibold shrink-0">Prompts:</span>
        <button
          type="button"
          onClick={() => handleSendMessage("Evaluate patient vitals history for signs of acute decompensation.")}
          className="px-2.5 py-1 rounded-md bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-[11px] border border-slate-700 whitespace-nowrap cursor-pointer"
        >
          Decompensation Risk
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage("Suggest antibiotic dosage adjustments based on renal clearance.")}
          className="px-2.5 py-1 rounded-md bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-[11px] border border-slate-700 whitespace-nowrap cursor-pointer"
        >
          Renal Drug Sizing
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage("What are the discharge criteria and step-down protocol for this patient?")}
          className="px-2.5 py-1 rounded-md bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-[11px] border border-slate-700 whitespace-nowrap cursor-pointer"
        >
          Discharge Criteria
        </button>
      </div>

      {/* Message Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-[#0B1120] border-t border-slate-800 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a clinical question, check drug dosages, or ask for differential diagnosis..."
          className="flex-1 px-3.5 py-2 rounded-xl bg-[#111827] border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          Ask AI
        </button>
      </form>
    </div>
  );
}
