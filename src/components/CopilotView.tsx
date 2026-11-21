import React, { useState } from "react";
import { ArrowUpRight, Database, RotateCcw, Send } from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import { ApiRequestError, askAICopilot } from "../services/aiClient";
import type { CopilotMessage } from "../types/hospital";

const STARTER_PROMPTS = [
  "Which ward is closest to full capacity right now?",
  "Summarize our Critical ER & ICU patients for a 30-second shift handover.",
  "Which pharmacy supplies will run out first based on daily usage?",
  "Which specialist doctor has the lightest patient load right now?",
];

export function CopilotView() {
  const { patients, beds, doctors, inventory } = useHospital();

  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: "msg-welcome",
      role: "assistant",
      content:
        "I am connected to MedCore AI's live hospital operations database—tracking active patients, ward beds, attending physicians, and pharmacy stock. Ask any operational question below.",
      timestamp: "Live",
      referencedFacts: [
        `${patients.filter((p) => p.status === "Admitted").length} admitted patients synced`,
        `${beds.length} hospital beds tracked across 4 wards`,
        `${inventory.length} clinical supply items monitored`,
      ],
      suggestedFollowUps: STARTER_PROMPTS.slice(0, 2),
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  function buildLiveHospitalSnapshot() {
    return {
      activePatients: patients
        .filter((p) => p.status === "Admitted")
        .map((p) => ({
          id: p.id,
          name: p.name,
          age: p.age,
          severity: p.severity,
          department: p.department,
          bed: p.assignedBedId,
          vitals: p.vitals,
        })),
      beds: beds.map((b) => ({ id: b.id, ward: b.ward, status: b.status })),
      doctors: doctors.map((d) => ({
        name: d.name,
        specialty: d.specialty,
        status: d.status,
        activePatients: d.activePatientsCount,
        maxCapacity: d.maxCapacity,
      })),
      lowAndTrackedInventory: inventory.map((i) => ({
        name: i.name,
        stock: i.stock,
        unit: i.unit,
        minThreshold: i.minThreshold,
        dailyUsage: i.dailyUsage,
      })),
    };
  }

  async function sendQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    setError(null);
    setLastQuestion(trimmed);
    const nowTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const userMsg: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: nowTime,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);

    try {
      const response = await askAICopilot({
        question: trimmed,
        history: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        hospitalState: buildLiveHospitalSnapshot(),
      });

      const assistantMsg: CopilotMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: response.answer,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        referencedFacts: response.referencedFacts,
        suggestedFollowUps: response.suggestedFollowUps,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError({ message: err.message, hint: err.hint });
      } else {
        setError({ message: "Unable to reach the AI Operations Copilot." });
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendQuestion(input);
  }

  function handleClearChat() {
    setMessages((prev) => prev.slice(0, 1));
    setError(null);
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Main Conversational Copilot Workspace */}
      <section className="xl:col-span-8 bg-[#111827] border border-slate-800 rounded-xl flex flex-col min-h-[600px]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              AI Hospital Operations Copilot
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Context-grounded Natural Language Processing over live hospital records.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearChat}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-400 hover:text-slate-200 whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear Thread
          </button>
        </div>

        {/* Messages Feed */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[520px]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                <span className="font-medium text-slate-400">
                  {msg.role === "user" ? "Operations Staff" : "MedCore AI Copilot"}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-2xl rounded-xl px-4 py-3.5 text-sm leading-relaxed whitespace-pre-line ${
                  msg.role === "user"
                    ? "bg-sky-500/15 border border-sky-500/30 text-slate-100"
                    : "bg-[#0B1120] border border-slate-800 text-slate-200"
                }`}
              >
                {msg.content}

                {msg.referencedFacts && msg.referencedFacts.length > 0 && (
                  <div className="mt-3.5 pt-3 border-t border-slate-800/90 space-y-1">
                    <div className="text-xs font-medium text-slate-400">
                      Grounded in Live Hospital Data:
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-sky-400 font-mono tabular-nums">
                      {msg.referencedFacts.map((fact, idx) => (
                        <span key={idx}>
                          {fact}
                          {idx < msg.referencedFacts!.length - 1 ? " ·" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {msg.suggestedFollowUps.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendQuestion(q)}
                      disabled={loading}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      <span>{q}</span>
                      <ArrowUpRight className="w-3 h-3 text-sky-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="max-w-xl rounded-xl p-4 bg-[#0B1120] border border-slate-800 space-y-2 animate-pulse">
              <div className="h-3.5 w-1/3 bg-slate-800 rounded" />
              <div className="h-3.5 w-full bg-slate-800/80 rounded" />
              <div className="h-3.5 w-4/5 bg-slate-800/70 rounded" />
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-red-950/40 border border-red-900/70 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-red-300">{error.message}</p>
                {error.hint && <p className="text-xs text-red-400 mt-0.5">{error.hint}</p>}
              </div>
              {lastQuestion && (
                <button
                  type="button"
                  onClick={() => sendQuestion(lastQuestion)}
                  className="px-3 py-1.5 rounded-md border border-red-700 text-xs font-medium text-red-200 hover:bg-red-900/40 whitespace-nowrap cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          )}
        </div>

        {/* Input Composer */}
        <form
          onSubmit={handleSubmit}
          className="p-4 border-t border-slate-800 flex items-center gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about ward capacity, critical patients, doctor loads, or low-stock supplies..."
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#0B1120] border border-slate-800 focus:border-sky-500 focus:outline-none text-sm text-slate-100"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            Ask AI
          </button>
        </form>
      </section>

      {/* Right Column: Live Context Inspector + Quick Classroom Demo Prompts */}
      <aside className="xl:col-span-4 space-y-6">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Live Synced Grounding Context
            </h3>
            <Database className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every question automatically attaches a real-time JSON snapshot of your current hospital state so Gemini answers factually without hallucinating.
          </p>
          <div className="divide-y divide-slate-800 text-xs">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Admitted Patients</span>
              <span className="font-mono tabular-nums text-slate-100">
                {patients.filter((p) => p.status === "Admitted").length} records
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Open Hospital Beds</span>
              <span className="font-mono tabular-nums text-emerald-400">
                {beds.filter((b) => b.status === "Available").length} of {beds.length}
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Doctors On Duty</span>
              <span className="font-mono tabular-nums text-slate-100">
                {doctors.filter((d) => d.status === "On Duty").length} physicians
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-400">Low-Stock Supplies</span>
              <span className="font-mono tabular-nums text-amber-400">
                {inventory.filter((i) => i.stock <= i.minThreshold).length} items
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-100">
            Suggested Operational Queries
          </h3>
          <div className="space-y-2">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={loading}
                onClick={() => sendQuestion(prompt)}
                className="w-full text-left p-3 rounded-lg bg-[#0B1120] hover:bg-slate-800/80 border border-slate-800 text-xs text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
