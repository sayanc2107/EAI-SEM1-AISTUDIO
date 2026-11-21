import React, { useMemo, useState } from "react";
import {
  Check,
  CheckCheck,
  Inbox,
  Mail,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import { runAICopilotQuery } from "../services/aiClient";
import type { InternalMail, UserRole } from "../types/hospital";

export function InternalMailView() {
  const {
    internalMails,
    sendInternalMail,
    markMailRead,
    userProfile,
    staffDirectory,
    pushToast,
  } = useHospital();

  const [activeTab, setActiveTab] = useState<"inbox" | "sent">("inbox");
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [search, setSearch] = useState("");

  // Compose State
  const [toEmail, setToEmail] = useState(
    staffDirectory.find((s) => s.email.toLowerCase() !== userProfile?.email.toLowerCase())?.email || ""
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<InternalMail["priority"]>("Normal");
  const [sending, setSending] = useState(false);

  // AI Drafting State
  const [aiPrompt, setAiPrompt] = useState("");
  const [draftingWithAi, setDraftingWithAi] = useState(false);
  const [showAiDraftModal, setShowAiDraftModal] = useState(false);

  const currentUserEmail = userProfile?.email.toLowerCase() || "";

  const inboxMails = useMemo(
    () =>
      internalMails.filter(
        (m) =>
          m.toEmail.toLowerCase() === currentUserEmail ||
          m.toEmail.toLowerCase() === "all@medcore.org" ||
          currentUserEmail === "admin@medcore.org"
      ),
    [internalMails, currentUserEmail]
  );

  const sentMails = useMemo(
    () => internalMails.filter((m) => m.fromEmail.toLowerCase() === currentUserEmail),
    [internalMails, currentUserEmail]
  );

  const currentList = activeTab === "inbox" ? inboxMails : sentMails;

  const filteredMails = useMemo(() => {
    return currentList.filter((m) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        m.subject.toLowerCase().includes(q) ||
        m.body.toLowerCase().includes(q) ||
        m.fromName.toLowerCase().includes(q) ||
        m.toName.toLowerCase().includes(q)
      );
    });
  }, [currentList, search]);

  const selectedMail = useMemo(
    () => internalMails.find((m) => m.id === selectedMailId) || filteredMails[0] || null,
    [internalMails, selectedMailId, filteredMails]
  );

  async function handleSelectMail(mail: InternalMail) {
    setSelectedMailId(mail.id);
    if (!mail.isRead && mail.toEmail.toLowerCase() === currentUserEmail) {
      await markMailRead(mail.id);
    }
  }

  async function handleSendMail(e: React.FormEvent) {
    e.preventDefault();
    if (!toEmail || !subject.trim() || !body.trim()) return;

    setSending(true);
    try {
      const recipient = staffDirectory.find((s) => s.email.toLowerCase() === toEmail.toLowerCase());
      await sendInternalMail({
        toEmail: toEmail.toLowerCase(),
        toName: recipient?.fullName || toEmail.split("@")[0],
        toRole: recipient?.role || "doctor",
        subject: subject.trim(),
        body: body.trim(),
        priority,
      });

      setIsComposing(false);
      setSubject("");
      setBody("");
      pushToast("Message Sent", `Internal memo delivered to ${recipient?.fullName || toEmail}`, "success");
    } finally {
      setSending(false);
    }
  }

  async function handleGenerateAiDraft(intentType: string) {
    setDraftingWithAi(true);
    try {
      let promptText = "";
      if (intentType === "handoff") {
        promptText = "Write a concise, professional hospital clinical handoff memo from attending doctor to night nurse detailing unstable patient in ICU-01 with SpO2 drops, pending cardiac biomarkers, and alert thresholds.";
      } else if (intentType === "oncall") {
        promptText = "Write a formal urgent request for on-call doctor coverage due to high volume of trauma admissions in the ER tonight.";
      } else if (intentType === "pharma") {
        promptText = "Write an urgent hospital pharmacy restock requisition for Epinephrine vials and Normal Saline IV bags for emergency and ICU bays.";
      } else if (intentType === "payroll") {
        promptText = "Write a courteous inquiry to the Chief Hospital Accountant requesting review of emergency on-call bonus and weekend overtime calculation.";
      } else {
        promptText = aiPrompt.trim() || "Write a clinical memorandum to hospital administration.";
      }

      const res = await runAICopilotQuery({
        query: `${promptText}\nFormat with a clear 'Subject:' line at top, followed by 2-3 concise paragraphs. Keep tone clinically precise and courteous.`,
        systemState: {
          criticalPatientsCount: 3,
          availableBedsCount: 4,
          onDutyDoctorsCount: 5,
          pendingPrescriptionsCount: 2,
        },
      });

      const fullText = res.answer;
      const lines = fullText.split("\n");
      const subjectLine = lines.find((l: string) => l.toLowerCase().startsWith("subject:"));
      if (subjectLine) {
        setSubject(subjectLine.replace(/subject:\s*/i, "").trim());
        setBody(lines.filter((l: string) => !l.toLowerCase().startsWith("subject:")).join("\n").trim());
      } else {
        setSubject("Clinical Handoff & Patient Update");
        setBody(fullText);
      }
      setShowAiDraftModal(false);
    } catch {
      pushToast("AI Assistant Offline", "Could not generate automated draft. You can type manually.", "warning");
    } finally {
      setDraftingWithAi(false);
    }
  }

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl h-[780px] flex flex-col">
      {/* Top Header */}
      <div className="p-4 bg-[#0B1120] border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Internal Hospital Mail & Secure Communications
            </h3>
            <p className="text-xs text-slate-400">
              HIPAA-compliant inter-departmental memos, clinical consultations & alerts.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsComposing(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4" />
          Compose Memo
        </button>
      </div>

      {/* Main Mailbox Workspace Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Mail List (380px) */}
        <div className="w-[380px] border-r border-slate-800 flex flex-col bg-[#0B1120]/50 shrink-0">
          {/* Sub Tabs + Search */}
          <div className="p-3 border-b border-slate-800 space-y-2.5">
            <div className="flex items-center gap-1 p-1 bg-[#111827] border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab("inbox")}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === "inbox" ? "bg-slate-800 text-sky-300" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Inbox ({inboxMails.filter((m) => !m.isRead).length} new)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("sent")}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === "sent" ? "bg-slate-800 text-sky-300" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Sent ({sentMails.length})
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search memos..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#111827] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Mails Scroll */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
            {filteredMails.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No internal memos in this view.
              </div>
            ) : (
              filteredMails.map((m) => {
                const isSelected = selectedMail?.id === m.id;
                const isUnread = !m.isRead && activeTab === "inbox";
                return (
                  <div
                    key={m.id}
                    onClick={() => handleSelectMail(m)}
                    className={`p-3.5 cursor-pointer transition-colors space-y-1 ${
                      isSelected
                        ? "bg-slate-800/80 border-l-2 border-sky-400"
                        : isUnread
                          ? "bg-sky-950/20 hover:bg-slate-800/50"
                          : "hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-semibold truncate max-w-[190px] ${isUnread ? "text-slate-50 font-bold" : "text-slate-300"}`}>
                        {activeTab === "inbox" ? m.fromName : `To: ${m.toName}`}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{m.sentAt}</span>
                    </div>

                    <div className={`text-xs truncate ${isUnread ? "font-semibold text-slate-100" : "text-slate-300"}`}>
                      {m.subject}
                    </div>

                    <p className="text-[11px] text-slate-500 truncate">{m.body}</p>

                    <div className="flex items-center gap-2 pt-1">
                      {m.priority === "Urgent" && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-950/80 text-red-300 border border-red-800/80">
                          Urgent
                        </span>
                      )}
                      {m.priority === "Clinical Memo" && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-950/80 text-sky-300 border border-sky-800/80">
                          Clinical
                        </span>
                      )}
                      {m.aiAssisted && (
                        <span className="inline-flex items-center gap-1 text-[9px] text-amber-300">
                          <Sparkles className="w-2.5 h-2.5" /> AI Drafted
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail Pane */}
        <div className="flex-1 flex flex-col bg-[#111827] overflow-y-auto">
          {selectedMail ? (
            <div className="p-6 space-y-6 flex-1 flex flex-col">
              <div className="space-y-3 pb-4 border-b border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-bold text-slate-100">{selectedMail.subject}</h2>
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      selectedMail.priority === "Urgent"
                        ? "bg-red-950/60 text-red-300 border border-red-800/80"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {selectedMail.priority}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
                  <div className="space-y-0.5">
                    <div>
                      From: <strong className="text-slate-200">{selectedMail.fromName}</strong> ({selectedMail.fromEmail})
                    </div>
                    <div>
                      To: <strong className="text-slate-200">{selectedMail.toName}</strong> ({selectedMail.toEmail})
                    </div>
                  </div>
                  <div className="text-right font-mono text-slate-500">
                    {selectedMail.sentAt}
                  </div>
                </div>
              </div>

              {/* Message Body */}
              <div className="flex-1 text-xs text-slate-200 leading-relaxed whitespace-pre-line bg-[#0B1120] border border-slate-800/80 rounded-xl p-5">
                {selectedMail.body}
              </div>

              {/* Quick Reply Bar */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setToEmail(selectedMail.fromEmail);
                    setSubject(`Re: ${selectedMail.subject}`);
                    setIsComposing(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs text-slate-200 font-medium cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Reply to Memo
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <Inbox className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-xs">Select an internal memo to read details.</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {isComposing && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-400" />
                Compose Hospital Internal Memo
              </h3>
              <button
                type="button"
                onClick={() => setIsComposing(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendMail} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Recipient Mail ID (@medcore.org)
                  </label>
                  <input
                    type="email"
                    required
                    list="staff-mail-suggestions"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    placeholder="doctor@medcore.org"
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                  />
                  <datalist id="staff-mail-suggestions">
                    {staffDirectory.map((s) => (
                      <option key={s.id} value={s.email}>
                        {s.fullName} ({s.role.replace("_", " ")}) · {s.department}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as InternalMail["priority"])}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgent">Urgent Escalation</option>
                    <option value="Clinical Memo">Clinical Memo / Handoff</option>
                    <option value="Administrative">Administrative</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Critical Patient Handoff / Cardiac Bed 01"
                  className="w-full px-3.5 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-400">Message Body</label>
                  <button
                    type="button"
                    onClick={() => setShowAiDraftModal(true)}
                    className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Draft with AI Assistant
                  </button>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  placeholder="Type message content, clinical orders, handover observations or administrative notices..."
                  className="w-full p-3 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsComposing(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                >
                  {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send Memo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Draft Selector Dialog */}
      {showAiDraftModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-semibold text-slate-100">AI Medical Correspondence Assistant</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAiDraftModal(false)}
                className="text-slate-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Select a quick clinical scenario to have Gemini write a complete, professional draft:
            </p>

            <div className="space-y-2">
              <button
                type="button"
                disabled={draftingWithAi}
                onClick={() => handleGenerateAiDraft("handoff")}
                className="w-full text-left p-3 rounded-xl bg-[#0B1120] border border-slate-800 hover:border-slate-700 text-xs space-y-1 cursor-pointer transition-colors"
              >
                <div className="font-semibold text-slate-200">Patient Clinical Handoff Memo</div>
                <div className="text-[11px] text-slate-400">Transfers care observations, unstable vitals & pending stat labs.</div>
              </button>

              <button
                type="button"
                disabled={draftingWithAi}
                onClick={() => handleGenerateAiDraft("oncall")}
                className="w-full text-left p-3 rounded-xl bg-[#0B1120] border border-slate-800 hover:border-slate-700 text-xs space-y-1 cursor-pointer transition-colors"
              >
                <div className="font-semibold text-slate-200">Emergency On-Call Escalation</div>
                <div className="text-[11px] text-slate-400">Requests urgent specialist coverage for sudden trauma surge.</div>
              </button>

              <button
                type="button"
                disabled={draftingWithAi}
                onClick={() => handleGenerateAiDraft("pharma")}
                className="w-full text-left p-3 rounded-xl bg-[#0B1120] border border-slate-800 hover:border-slate-700 text-xs space-y-1 cursor-pointer transition-colors"
              >
                <div className="font-semibold text-slate-200">Pharmacy Emergency Restock Requisition</div>
                <div className="text-[11px] text-slate-400">Requests immediate restock of critical care ampoules and IV fluids.</div>
              </button>

              <button
                type="button"
                disabled={draftingWithAi}
                onClick={() => handleGenerateAiDraft("payroll")}
                className="w-full text-left p-3 rounded-xl bg-[#0B1120] border border-slate-800 hover:border-slate-700 text-xs space-y-1 cursor-pointer transition-colors"
              >
                <div className="font-semibold text-slate-200">Finance & Payroll Allowance Inquiry</div>
                <div className="text-[11px] text-slate-400">Inquires regarding consultation incentives or overtime disbursal.</div>
              </button>
            </div>

            {draftingWithAi && (
              <div className="flex items-center gap-2 text-xs text-amber-300 justify-center py-2 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Gemini AI is composing clinical correspondence...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
