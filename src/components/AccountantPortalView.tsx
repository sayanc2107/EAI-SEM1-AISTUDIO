import React from "react";
import { HospitalFinancialsView } from "./HospitalFinancialsView";
import { PayrollSystemView } from "./PayrollSystemView";
import { StaffDirectoryView } from "./StaffDirectoryView";

interface AccountantPortalProps {
  subTab?: "overview" | "sales" | "payroll" | "staff";
}

export function AccountantPortalView({ subTab = "overview" }: AccountantPortalProps) {
  if (subTab === "payroll") {
    return <PayrollSystemView />;
  }

  if (subTab === "staff") {
    return <StaffDirectoryView />;
  }

  // overview and sales both use HospitalFinancialsView (which provides comprehensive charts and sales logs)
  return <HospitalFinancialsView />;
}
