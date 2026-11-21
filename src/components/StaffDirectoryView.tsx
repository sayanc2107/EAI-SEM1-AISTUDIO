import React, { useState } from "react";
import {
  CheckCircle2,
  Database,
  Edit2,
  ExternalLink,
  KeyRound,
  PhoneCall,
  RefreshCw,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useHospital } from "../context/HospitalContext";
import { SAMPLE_STAFF_CREDENTIALS } from "../data/seedData";
import type { UserRole } from "../types/hospital";
import firebaseConfig from "../../firebase-applet-config.json";
import { CallDoctorModal } from "./CallDoctorModal";

const FIREBASE_AUTH_PROVIDERS_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "doctor", label: "Doctor" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "ward_staff", label: "Ward Staff" },
  { value: "nurse", label: "Nurse" },
  { value: "accountant", label: "Accountant" },
  { value: "admin", label: "Hospital Admin" },
];

export function StaffDirectoryView() {
  const {
    staffDirectory,
    saveStaffDirectoryEntry,
    deleteStaffMember,
    provisionAllSampleStaffAccounts,
    isActualAdmin,
    pushToast,
  } = useHospital();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("doctor");
  const [linkedStaffId, setLinkedStaffId] = useState("DOC-07");
  const [department, setDepartment] = useState("Emergency Medicine");
  const [initialPassword, setInitialPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCallDoctor, setShowCallDoctor] = useState(false);

  const [provisioningAll, setProvisioningAll] = useState(false);
  const [provisionSummary, setProvisionSummary] = useState<{
    firestoreSynced: number;
    authCreated: number;
    authExisting: number;
    providerDisabled: boolean;
  } | null>(null);

  function handleFullNameChange(val: string) {
    setFullName(val);
    const cleaned = val
      .replace(/^(dr\.|dr|rn|prof\.|nurse|cpa)\s+/i, "")
      .trim()
      .toLowerCase();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0].replace(/[^a-z0-9]/g, "");
      const last = parts[parts.length - 1].replace(/[^a-z0-9]/g, "");
      if (first && last) {
        setEmail(`${first}.${last}@medcore.org`);
      }
    } else if (parts.length === 1) {
      const single = parts[0].replace(/[^a-z0-9]/g, "");
      if (single) {
        setEmail(`${single}@medcore.org`);
      }
    }
  }

  async function handleDelete(staffId: string, name: string) {
    if (!window.confirm(`Are you sure you want to remove employee "${name}" (${staffId}) from MedCore AI?`)) {
      return;
    }
    await deleteStaffMember(staffId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !fullName.trim() || !linkedStaffId.trim()) return;
    setSaving(true);
    try {
      await saveStaffDirectoryEntry(
        {
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          role,
          linkedStaffId: linkedStaffId.trim(),
          department: department.trim() || "Hospital Operations",
        },
        initialPassword.trim() || undefined
      );
      setEmail("");
      setFullName("");
      setInitialPassword("");
    } finally {
      setSaving(false);
    }
  }

  async function handleProvisionAll() {
    setProvisioningAll(true);
    try {
      const res = await provisionAllSampleStaffAccounts();
      setProvisionSummary(res);
    } finally {
      setProvisioningAll(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Database Staff Directory & Login Credentials
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Sync all 11 @medcore.org staff profiles to Firestore & Firebase Authentication, or add new staff with Email ID + Password.
            </p>
          </div>
          <button
            type="button"
            onClick={handleProvisionAll}
            disabled={provisioningAll}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {provisioningAll ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Database className="w-3.5 h-3.5" />
            )}
            {provisioningAll
              ? "Syncing Staff to Database..."
              : "Sync & Provision All 11 @medcore.org Staff"}
          </button>
        </div>

        {provisionSummary && (
          <div
            className={`p-4 rounded-lg border text-xs space-y-1.5 ${
              provisionSummary.providerDisabled
                ? "bg-amber-950/30 border-amber-800/60 text-amber-200"
                : "bg-emerald-950/30 border-emerald-800/60 text-emerald-200"
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Firestore Staff Directory synced ({provisionSummary.firestoreSynced} accounts).
                {!provisionSummary.providerDisabled &&
                  ` Firebase Auth: ${provisionSummary.authCreated} created, ${provisionSummary.authExisting} already active.`}
              </span>
            </div>
            {provisionSummary.providerDisabled && (
              <p className="pl-6 text-amber-200/90 leading-relaxed">
                Email/Password sign-in is not yet enabled in Firebase Console. Enable it once at{" "}
                <a
                  href={FIREBASE_AUTH_PROVIDERS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 underline font-medium"
                >
                  Firebase Auth Providers <ExternalLink className="w-3 h-3" />
                </a>{" "}
                then click <strong>Sync & Provision</strong> again.
              </p>
            )}
          </div>
        )}

        {/* Add Custom Staff Member — strictly restricted to Hospital Admin */}
        {isActualAdmin ? (
          <form
            onSubmit={handleSubmit}
            className="p-4 rounded-lg bg-[#0B1120] border border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
          >
            <div>
              <label className="block text-xs text-slate-400 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => handleFullNameChange(e.target.value)}
                placeholder="Dr. Vikram Shah"
                className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">
                Auto-Generated Staff Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="firstname.lastname@medcore.org"
                className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-slate-800 text-xs font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Database Role</label>
              <select
                value={role}
                onChange={(e) => {
                  const nextRole = e.target.value as UserRole;
                  setRole(nextRole);
                  if (nextRole === "doctor") setLinkedStaffId("DOC-07");
                  if (nextRole === "pharmacist") setLinkedStaffId("PHM-02");
                  if (nextRole === "ward_staff") setLinkedStaffId("WRD-02");
                  if (nextRole === "nurse") setLinkedStaffId("NUR-03");
                  if (nextRole === "accountant") setLinkedStaffId("ACC-02");
                  if (nextRole === "admin") setLinkedStaffId("ADM-02");
                }}
                className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-slate-800 text-xs text-slate-100"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Linked Staff ID</label>
              <input
                type="text"
                required
                value={linkedStaffId}
                onChange={(e) => setLinkedStaffId(e.target.value)}
                placeholder="DOC-07 / PHM-02"
                className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-slate-800 text-xs font-mono text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Emergency / Pharmacy / Accounts"
                className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-slate-800 text-xs text-slate-100"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-xs text-slate-400 mb-1">
                Login Password (min 6 chars)
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  minLength={6}
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  placeholder="e.g., Doctor@123"
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#111827] border border-slate-800 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="lg:col-span-3 flex items-end justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 text-xs font-semibold cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {saving ? "Registering Employee..." : "Add Employee & Provision Credentials"}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
            <span className="text-amber-400 font-semibold">Staff Management Policy:</span>
            New hospital employee accounts can only be added by the Hospital Administrator. Accountants configure salary breakdowns and bank account details.
          </div>
        )}

        {/* Live Firestore Staff Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400">
                <th className="py-3 pr-4 font-medium">Staff ID & Name</th>
                <th className="py-3 px-3 font-medium">Registered Email ID</th>
                <th className="py-3 px-3 font-medium">Sample Default Password</th>
                <th className="py-3 px-3 font-medium">Assigned Role</th>
                <th className="py-3 px-3 font-medium">Department</th>
                <th className="py-3 pl-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-sm">
              {staffDirectory.map((entry) => {
                const sampleCred = SAMPLE_STAFF_CREDENTIALS.find(
                  (c) => c.email.toLowerCase() === entry.email.toLowerCase()
                );
                return (
                  <tr key={entry.id} className="hover:bg-slate-800/30">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-slate-100">{entry.fullName}</div>
                      <div className="text-xs font-mono text-slate-500">
                        {entry.linkedStaffId}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-200">
                      {entry.email}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-400">
                      {sampleCred ? sampleCred.password : "Custom / Google Auth"}
                    </td>
                    <td className="py-3 px-3 text-xs font-semibold text-sky-400 capitalize">
                      {entry.role.replace("_", " ")}
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-400">
                      {entry.department}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {entry.role === "doctor" && (
                          <button
                            type="button"
                            onClick={() => setShowCallDoctor(true)}
                            className="p-1.5 rounded bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800 text-emerald-400 transition-colors cursor-pointer"
                            title="Call Doctor"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEmail(entry.email);
                            setFullName(entry.fullName);
                            setRole(entry.role);
                            setLinkedStaffId(entry.linkedStaffId);
                            setDepartment(entry.department);
                          }}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Edit Staff Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.linkedStaffId, entry.fullName)}
                          className="p-1.5 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-400 transition-colors cursor-pointer"
                          title="Remove Employee from Directory"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <CallDoctorModal
        isOpen={showCallDoctor}
        onClose={() => setShowCallDoctor(false)}
        callerRole="admin"
      />
    </div>
  );
}
