import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  LifeBuoy,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Wrench,
  X,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import type { HelpdeskTicket } from "../types/hospital";

export function HelpdeskView() {
  const {
    helpdeskTickets,
    raiseHelpdeskTicket,
    updateTicketStatus,
    userProfile,
    isActualAdmin,
    pushToast,
  } = useHospital();

  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [isRaising, setIsRaising] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Form State
  const [category, setCategory] = useState<HelpdeskTicket["category"]>("Equipment & Facilities");
  const [priority, setPriority] = useState<HelpdeskTicket["priority"]>("Medium");
  const [subject, setSubject] = useState("");
  const [location, setLocation] = useState("ICU Ward");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Resolution State
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolving, setResolving] = useState(false);

  const filteredTickets = useMemo(() => {
    return helpdeskTickets.filter((t) => {
      if (filterStatus !== "All" && t.status !== filterStatus) return false;
      if (filterCategory !== "All" && t.category !== filterCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          t.subject.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.ticketNumber.toLowerCase().includes(q) ||
          (t.raisedByStaffName || t.raisedByName || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [helpdeskTickets, filterStatus, filterCategory, search]);

  const selectedTicket = useMemo(
    () => helpdeskTickets.find((t) => t.id === selectedTicketId) || filteredTickets[0] || null,
    [helpdeskTickets, selectedTicketId, filteredTickets]
  );

  async function handleRaiseTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;

    setSubmitting(true);
    try {
      await raiseHelpdeskTicket({
        category,
        priority,
        subject: subject.trim(),
        description: description.trim(),
        location: location.trim() || "Hospital",
      });
      setIsRaising(false);
      setSubject("");
      setDescription("");
      pushToast("Issue Raised", "Your support ticket has been submitted to Hospital Administration.", "success");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateStatus(ticketId: string, status: HelpdeskTicket["status"]) {
    setResolving(true);
    try {
      await updateTicketStatus(ticketId, status, resolveNotes.trim() || undefined);
      setResolveNotes("");
      pushToast("Ticket Updated", `Status changed to ${status}`, "info");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-sky-400">
            Hospital Incident & Support Desk
          </div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mt-0.5">
            <LifeBuoy className="w-5 h-5 text-sky-400" />
            Hospital Helpdesk & Issue Resolution Center
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Report facility malfunctions, clinical IT issues, pharmacy restock blocks, and administration requests.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsRaising(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Raise New Issue
        </button>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Tickets List (7 cols) */}
        <div className="xl:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Hospital Tickets Log ({filteredTickets.length})
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search issues..."
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="All">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {filteredTickets.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No active incident tickets match your filters.
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                const priorityBadge =
                  t.priority === "Critical"
                    ? "bg-red-950/80 text-red-300 border-red-800/80"
                    : t.priority === "High"
                      ? "bg-amber-950/80 text-amber-300 border-amber-800/80"
                      : "bg-sky-950/80 text-sky-300 border-sky-800/80";

                const statusBadge =
                  t.status === "Resolved"
                    ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/80"
                    : t.status === "In Progress"
                      ? "bg-amber-950/60 text-amber-300 border-amber-800/80"
                      : "bg-red-950/60 text-red-300 border-red-800/80";

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className={`p-4 rounded-xl border transition-colors cursor-pointer space-y-2 ${
                      isSelected
                        ? "bg-[#0B1120] border-sky-500/70"
                        : "bg-[#0B1120] border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-mono text-sky-400 font-semibold">
                          {t.ticketNumber} · {t.category}
                        </div>
                        <h4 className="text-sm font-bold text-slate-100 mt-0.5">{t.subject}</h4>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${priorityBadge}`}>
                          {t.priority}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusBadge}`}>
                          {t.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {t.description}
                    </p>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Raised by: {t.raisedByStaffName || t.raisedByName || "Staff"} ({t.location})</span>
                      <span>{t.createdAt || t.raisedAtLabel}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Ticket Detail & Admin Resolution Panel (5 cols) */}
        <div className="xl:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
          {selectedTicket ? (
            <>
              <div className="pb-4 border-b border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-sky-400">
                    {selectedTicket.ticketNumber}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{selectedTicket.createdAt}</span>
                </div>
                <h3 className="text-base font-bold text-slate-100">{selectedTicket.subject}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{selectedTicket.category}</span>
                  <span>·</span>
                  <span>Location: <strong className="text-slate-200">{selectedTicket.location}</strong></span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Incident Description
                </div>
                <p className="text-xs text-slate-200 leading-relaxed bg-[#0B1120] border border-slate-800 rounded-lg p-3.5 whitespace-pre-line">
                  {selectedTicket.description}
                </p>
                <div className="text-xs text-slate-400">
                  Reported by: <strong className="text-slate-200">{selectedTicket.raisedByStaffName}</strong> ({selectedTicket.raisedByRole.toUpperCase()})
                </div>
              </div>

              {selectedTicket.status === "Resolved" && selectedTicket.resolutionNotes && (
                <div className="p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-800/60 space-y-1">
                  <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Resolution Record
                  </div>
                  <p className="text-xs text-emerald-200/90 leading-relaxed">
                    {selectedTicket.resolutionNotes}
                  </p>
                  <div className="text-[10px] text-emerald-400/80 font-mono">
                    Resolved by {selectedTicket.resolvedBy || "Administrator"} on {selectedTicket.resolvedAt}
                  </div>
                </div>
              )}

              {/* Admin Resolution Desk */}
              {isActualAdmin && selectedTicket.status !== "Resolved" && (
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="text-xs font-semibold text-slate-300">
                    Admin Resolution Actions
                  </div>
                  <textarea
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    placeholder="Enter resolution notes, technician dispatched, or repairs made..."
                    rows={3}
                    className="w-full p-2.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <div className="flex items-center gap-2">
                    {selectedTicket.status === "Open" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(selectedTicket.id, "In Progress")}
                        disabled={resolving}
                        className="flex-1 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Set In Progress
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(selectedTicket.id, "Resolved")}
                      disabled={resolving}
                      className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer transition-colors"
                    >
                      Mark Ticket Resolved
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-16 text-center text-xs text-slate-500">
              Select an issue ticket to inspect resolution details.
            </div>
          )}
        </div>
      </div>

      {/* Raise Ticket Modal */}
      {isRaising && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-sky-400" />
                Raise Support / Incident Ticket
              </h3>
              <button
                type="button"
                onClick={() => setIsRaising(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRaiseTicket} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as HelpdeskTicket["category"])}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="Equipment & Facilities">Equipment & Facilities</option>
                    <option value="Clinical IT / Software">Clinical IT / Software</option>
                    <option value="Pharmacy & Stock">Pharmacy & Stock</option>
                    <option value="Nursing & Bedding">Nursing & Bedding</option>
                    <option value="HR & Payroll">HR & Payroll</option>
                    <option value="Administrative">Administrative</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as HelpdeskTicket["priority"])}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical Emergency</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Incident Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. ICU-02 Patient Monitor screen flickering"
                  className="w-full px-3.5 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Specific Location / Ward</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. ICU Bed 02 or Cardiology Floor 2"
                  className="w-full px-3.5 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Description & Details</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe the issue, impact on patient care or workflow, and any immediate hazards..."
                  className="w-full p-3 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRaising(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold cursor-pointer transition-colors"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
