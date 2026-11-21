/**
 * Phase 0 TDD Security Rules Specification Test Suite
 * Validates MedCore AI's "Dirty Dozen" adversarial payloads against firestore.rules.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  operation: "get" | "list" | "create" | "update" | "delete";
  actorRole: string;
  payload: Record<string, unknown>;
  expectedOutcome: "PERMISSION_DENIED";
  enforcedRule: string;
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: "Self-Assigned Admin Role on Registration",
    collection: "users/attackerUid",
    operation: "create",
    actorRole: "unassigned_user",
    payload: { uid: "attackerUid", email: "attacker@example.com", role: "admin" },
    expectedOutcome: "PERMISSION_DENIED",
    enforcedRule: "users.create requires bootstrapped admin or matching staffDirectory entry",
  },
  {
    id: 2,
    name: "Shadow Role Escalation on Profile Update",
    collection: "users/doctorUid",
    operation: "update",
    actorRole: "doctor",
    payload: { role: "admin" },
    expectedOutcome: "PERMISSION_DENIED",
    enforcedRule: "users.update allows only displayName and updatedAt for non-admins",
  },
  {
    id: 3,
    name: "Cross-User PII Read on users/{uid}",
    collection: "users/otherUid",
    operation: "get",
    actorRole: "nurse",
    payload: {},
    expectedOutcome: "PERMISSION_DENIED",
    enforcedRule: "users.get restricts read strictly to owner or admin",
  },
  {
    id: 4,
    name: "Shadow Ghost Field Injection on Inventory Update",
    collection: "inventory/INV-101",
    operation: "update",
    actorRole: "pharmacist",
    payload: { stock: 50, isVerified: true },
    expectedOutcome: "PERMISSION_DENIED",
    enforcedRule: "isValidInventoryItem hasOnly() rejects unexpected fields",
  },
  {
    id: 5,
    name: "Unverified Admin Email Spoof Attack",
    collection: "staffDirectory/STAFF-99",
    operation: "create",
    actorRole: "spoofed_unverified_email",
    payload: { email: "evil@example.com", role: "admin" },
    expectedOutcome: "PERMISSION_DENIED",
    enforcedRule: "isVerified() enforces request.auth.token.email_verified == true",
  },
  {
    id: 6,
    name: "Path Variable ID Poisoning",
    collection: "patients/../../malicious$id",
    operation: "create",
    actorRole: "doctor",
    payload: { id: "../../malicious$id" },
    expectedOutcome: "PERMISSION_DENIED",
    enforcedRule: "isValidId() regex ^[a-zA-Z0-9_\\-]+$ rejects special chars",
  },
  {
    id: 7,
    name: "Oversized String Denial-of-Wallet Payload",
    collection: "patients/PT-9999",
    operation: "create",
    actorRole: "doctor",
    payload: { symptoms: "A".repeat(2000) },
    expectedOutcome: "PERMISSION_DENIED",
    enforcedRule: "isValidPatient enforces symptoms.size() <= 600",
  },
  {
    id: 8,
    name: "Unbounded Array Injection on Prescription",
    collection: "prescriptions/RX-999",
    operation: "create",
    actorRole: "doctor",
    payload: { items: Array.from({ length: 20 }, () => ({ name: "Drug" })) },
    expectedOutcome: "PERMISSION_DENIED",
    enforcedRule: "isValidPrescription enforces items.size() <= 10",
  },
  {
    id: 9,
    name: "Terminal State Tampering on Dispensed Prescription",
    collection: "prescriptions/RX-101",
    operation: "update",
    actorRole: "pharmacist",
    payload: { status: "Pending" },
    expectedOutcome: "PERMISSION_DENIED",
    enforcedRule: "prescriptions.update blocks non-admin updates when existing().status == 'Dispensed'",
  },
  {
    id: 10,
    name: "Cross-Role Write: Pharmacist Admitting Patient",
    collection: "patients/PT-8888",
    operation: "create",
    actorRole: "pharmacist",
    payload: { name: "Unauthorized Patient" },
    expectedOutcome: "PERMISSION_DENIED",
    enforcedRule: "patients.create strictly requires isAdmin() || hasRole('doctor')",
  },
  {
    id: 11,
    name: "Cross-Role Read: Ward Staff Reading Pharmacy Sales",
    collection: "pharmacySales/SALE-101",
    operation: "get",
    actorRole: "ward_staff",
    payload: {},
    expectedOutcome: "PERMISSION_DENIED",
    enforcedRule: "pharmacySales.get restricts read strictly to admin or pharmacist",
  },
  {
    id: 12,
    name: "Client Backdated Timestamp Forgery",
    collection: "pharmacySales/SALE-999",
    operation: "create",
    actorRole: "pharmacist",
    payload: { createdAt: "2020-01-01T00:00:00Z" },
    expectedOutcome: "PERMISSION_DENIED",
    enforcedRule: "pharmacySales.create enforces incoming().createdAt == request.time",
  },
];
