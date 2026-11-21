/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import {
  Activity,
  BedDouble,
  ClipboardCheck,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Pill,
  Plus,
  RotateCcw,
  ShieldPlus,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import { CopilotView } from "./components/CopilotView";
import { DoctorPortalView } from "./components/DoctorPortalView";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoginView } from "./components/LoginView";
import { NursePortalView } from "./components/NursePortalView";
import { OverviewView } from "./components/OverviewView";
import { PharmacistPortalView } from "./components/PharmacistPortalView";
import { StaffDirectoryView } from "./components/StaffDirectoryView";
import { TriageView } from "./components/TriageView";
import { WardsView } from "./components/WardsView";
import { WardStaffPortalView } from "./components/WardStaffPortalView";
import { HospitalProvider, useHospital } from "./context/HospitalContext";
import type { UserRole, WorkspaceTab } from "./types/hospital";

interface NavItem {
  id: WorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "triage", label: "ER Triage", icon: Activity },
  { id: "wards", label: "Wards & Doctors", icon: BedDouble },
  { id: "pharmacy", label: "Pharmacy & Billing", icon: Pill },
  { id: "copilot", label: "AI Copilot", icon: MessageSquareText },
  { id: "staff_admin", label: "Staff & Roles", icon: Users },
];

const ROLE_PORTAL_NAV: Record<Exclude<UserRole, "admin">, NavItem> = {
  doctor: { id: "doctor_portal", label: "Doctor Workspace", icon: Stethoscope },
  pharmacist: { id: "pharmacist_portal", label: "Pharmacy & Billing", icon: Pill },
  ward_staff: { id: "ward_portal", label: "Ward Operations", icon: ClipboardCheck },
  nurse: { id: "nurse_portal", label: "Nursing Station", icon: HeartPulse },
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Hospital Admin",
  doctor: "Doctor",
  pharmacist: "Pharmacist",
  ward_staff: "Ward Staff",
  nurse: "Nurse",
};

const VIEW_BREADCRUMBS: Record<WorkspaceTab, { section: string; title: string }> = {
  overview: { section: "Admin", title: "Command Overview" },
  triage: { section: "Admin", title: "ER Triage & Patients" },
  wards: { section: "Admin", title: "Wards & Doctor Roster" },
  pharmacy: { section: "Admin", title: "Pharmacy & Billing Desk" },
  copilot: { section: "Admin", title: "AI Operations Copilot" },
  staff_admin: { section: "Admin", title: "Staff Directory & Role Access" },
  doctor_portal: { section: "Doctor", title: "My Shift, Locations & Patients" },
  pharmacist_portal: { section: "Pharmacy", title: "Prescriptions, Billing & Stock" },
  ward_portal: { section: "Ward Staff", title: "My Shift, On-Duty Doctors & AI Predictor" },
  nurse_portal: { section: "Nursing", title: "My Shift, Allotted Care & AI Predictor" },
};

function defaultTabForRole(role: UserRole): WorkspaceTab {
  switch (role) {
    case "doctor":
      return "doctor_portal";
    case "pharmacist":
      return "pharmacist_portal";
    case "ward_staff":
      return "ward_portal";
    case "nurse":
      return "nurse_portal";
    case "admin":
    default:
      return "overview";
  }
}

function MedCoreShell() {
  const {
    firebaseUser,
    userProfile,
    authLoading,
    accessDeniedEmail,
    activeRole,
    activeStaffId,
    isActualAdmin,
    setAdminRolePreview,
    logout,
    patients,
    inventory,
    prescriptions,
    staffShifts,
    toasts,
    dismissToast,
    resetDemoData,
  } = useHospital();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync activeTab strictly to the activeRole whenever role changes
  useEffect(() => {
    setActiveTab(defaultTabForRole(activeRole));
  }, [activeRole]);

  // Auth gate: strictly render LoginView (with ZERO designation picker) until DB role is resolved
  if (authLoading || !firebaseUser || !userProfile || accessDeniedEmail) {
    return <LoginView />;
  }

  const currentProfile = userProfile;

  const navItems: NavItem[] =
    activeRole === "admin" ? ADMIN_NAV_ITEMS : [ROLE_PORTAL_NAV[activeRole]];

  const criticalCount = patients.filter(
    (p) => p.status === "Admitted" && p.severity === "Critical"
  ).length;
  const pendingRxCount = prescriptions.filter((rx) => rx.status !== "Dispensed").length;
  const lowStockCount = inventory.filter((i) => i.stock <= i.minThreshold).length;

  const crumb = VIEW_BREADCRUMBS[activeTab] ?? VIEW_BREADCRUMBS.overview;

  const doctorShiftOptions = staffShifts.filter((s) => s.role === "doctor");
  const nurseShiftOptions = staffShifts.filter((s) => s.role === "nurse");

  function handleSelectTab(tab: WorkspaceTab) {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  }

  function renderSidebarContent() {
    return (
      <div className="flex flex-col h-full justify-between">
        <div className="space-y-6 overflow-y-auto">
          {/* Brand Wordmark */}
          <div className="px-4 pt-5 pb-3 border-b border-slate-800/80 flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleSelectTab(defaultTabForRole(activeRole))}
              className="flex items-center gap-2.5 text-left cursor-pointer"
            >
              <ShieldPlus className="w-5 h-5 text-sky-400 shrink-0" />
              <span className="text-base font-bold tracking-tight text-slate-50 whitespace-nowrap font-display">
                MedCore AI
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white cursor-pointer"
              aria-label="Close navigation menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Role-Scoped Navigation */}
          <div className="px-3 space-y-1">
            <div className="px-3 pb-1.5 text-xs font-medium text-slate-500">
              {ROLE_LABELS[activeRole]} Workspace
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-sky-500/15 text-sky-300"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.id === "triage" && criticalCount > 0 && (
                    <span className="text-xs font-mono tabular-nums text-red-400">
                      {criticalCount}
                    </span>
                  )}
                  {(item.id === "pharmacy" || item.id === "pharmacist_portal") &&
                    (pendingRxCount > 0 || lowStockCount > 0) && (
                      <span className="text-xs font-mono tabular-nums text-amber-400">
                        {pendingRxCount > 0 ? pendingRxCount : lowStockCount}
                      </span>
                    )}
                </button>
              );
            })}
          </div>

          {/* Admin-Only Live Role Preview Switcher (Hidden from all non-admin staff) */}
          {isActualAdmin && (
            <div className="px-3 pt-4 border-t border-slate-800/80 space-y-2.5">
              <div className="px-3 text-xs font-medium text-slate-500">
                Admin Role View Switcher
              </div>
              <div className="px-2 space-y-2">
                <select
                  value={activeRole}
                  onChange={(e) => setAdminRolePreview(e.target.value as UserRole)}
                  className="w-full px-2.5 py-2 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                  aria-label="Preview clinical role"
                >
                  <option value="admin">Admin Command Center</option>
                  <option value="doctor">Doctor Portal</option>
                  <option value="pharmacist">Pharmacist Portal</option>
                  <option value="ward_staff">Ward Staff Portal</option>
                  <option value="nurse">Nurse Portal</option>
                </select>

                {activeRole === "doctor" && doctorShiftOptions.length > 0 && (
                  <select
                    value={activeStaffId}
                    onChange={(e) => setAdminRolePreview("doctor", e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-300 focus:border-sky-500 focus:outline-none"
                    aria-label="Preview specific doctor"
                  >
                    {doctorShiftOptions.map((d) => (
                      <option key={d.staffId} value={d.staffId}>
                        {d.name} ({d.location})
                      </option>
                    ))}
                  </select>
                )}

                {activeRole === "nurse" && nurseShiftOptions.length > 0 && (
                  <select
                    value={activeStaffId}
                    onChange={(e) => setAdminRolePreview("nurse", e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B1120] border border-slate-800 text-xs text-slate-300 focus:border-sky-500 focus:outline-none"
                    aria-label="Preview specific nurse"
                  >
                    {nurseShiftOptions.map((n) => (
                      <option key={n.staffId} value={n.staffId}>
                        {n.name} ({n.assignedWard})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Account & Admin Reset Footer */}
        <div className="p-4 border-t border-slate-800/80 space-y-3">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-slate-100 truncate">
              {currentProfile.displayName}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {ROLE_LABELS[currentProfile.role]} · {currentProfile.email}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {isActualAdmin && (
              <button
                type="button"
                onClick={resetDemoData}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-800 hover:border-slate-700 hover:bg-slate-800/70 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Demo Data
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-800 hover:border-slate-700 hover:bg-slate-800/70 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ambient-canvas text-slate-100 flex">
      {/* Persistent Desktop Sidebar (260px) */}
      <aside className="hidden lg:block w-[260px] shrink-0 bg-[#0E1525] border-r border-slate-800/90 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-slate-950/80 flex"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            className="w-[260px] max-w-[82vw] bg-[#0E1525] border-r border-slate-800 h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Contextual Top Bar */}
        <header className="sticky top-0 z-30 h-16 px-4 sm:px-8 border-b border-slate-800/90 bg-[#0B1120]/90 backdrop-blur-md flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-sm truncate"
            >
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">
                MedCore AI
              </span>
              <span className="text-slate-600 hidden sm:inline">/</span>
              <span className="text-slate-400 hidden md:inline whitespace-nowrap">
                {crumb.section}
              </span>
              <span className="text-slate-600 hidden md:inline">/</span>
              <h1 className="font-semibold text-slate-100 truncate">{crumb.title}</h1>
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeRole === "admin" && activeTab !== "triage" && (
              <button
                type="button"
                onClick={() => handleSelectTab("triage")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Admit Patient
              </button>
            )}
            {activeRole === "admin" && activeTab === "triage" && (
              <button
                type="button"
                onClick={() => handleSelectTab("wards")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                View Ward Beds
              </button>
            )}
            {isActualAdmin && activeRole !== "admin" && (
              <button
                type="button"
                onClick={() => setAdminRolePreview("admin")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Return to Admin View
              </button>
            )}
          </div>
        </header>

        {/* Strictly Role-Scoped Active Workspace */}
        <main className="flex-1 w-full max-w-[1380px] mx-auto px-4 sm:px-8 py-7">
          {activeRole === "admin" && (
            <>
              {activeTab === "overview" && <OverviewView onNavigate={handleSelectTab} />}
              {activeTab === "triage" && <TriageView />}
              {activeTab === "wards" && <WardsView />}
              {activeTab === "pharmacy" && <PharmacistPortalView />}
              {activeTab === "copilot" && <CopilotView />}
              {activeTab === "staff_admin" && <StaffDirectoryView />}
            </>
          )}

          {activeRole === "doctor" && <DoctorPortalView />}
          {activeRole === "pharmacist" && <PharmacistPortalView />}
          {activeRole === "ward_staff" && <WardStaffPortalView />}
          {activeRole === "nurse" && <NursePortalView />}
        </main>
      </div>

      {/* Non-Intrusive Toast Notification Stack */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto bg-[#162033] border border-slate-700 rounded-xl px-4 py-3 shadow-lg flex items-start justify-between gap-3"
            >
              <div>
                <div className="text-xs font-semibold text-slate-100">{toast.title}</div>
                {toast.detail && (
                  <div className="text-xs text-slate-400 mt-0.5">{toast.detail}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-slate-500 hover:text-slate-200 cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HospitalProvider>
        <MedCoreShell />
      </HospitalProvider>
    </ErrorBoundary>
  );
}
