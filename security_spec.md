# MedCore AI — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **No Self-Assigned Roles**: A newly signing-in user can only create `/users/{uid}` with `role == 'admin'` if their verified Google email matches the bootstrapped admin (`sayan2008c@gmail.com`), OR with the exact `role` and `linkedStaffId` pre-authorized for their verified email in `/staffDirectory/{emailKey}`.
2. **PII Isolation**: `/users/{uid}` and `/staffDirectory/{emailKey}` are strictly isolated—no non-admin user can read another user's profile or list the user directory.
3. **Role-Scoped Operational Access**:
   - **Pharmacist**: Can manage `/inventory`, process `/prescriptions` (status transitions up to terminal `Dispensed`), and create/read `/pharmacySales`. Cannot read `/staffShifts` of doctors or modify `/beds`/`/patients`.
   - **Doctor**: Can read their own `/staffShifts/{staffId}`, read `/doctorLocations`, manage `/patients` allotted to them or manually admitted by them, and create `/prescriptions`. Cannot modify `/inventory` or `/pharmacySales`.
   - **Ward Staff**: Can read their own `/staffShifts/{staffId}`, read `/doctorLocations` (for on-duty presence & shift end times), read/update `/beds`, and read active `/patients` for ward coordination. Cannot access `/inventory` or `/pharmacySales`.
   - **Nurse**: Can read their own `/staffShifts/{staffId}`, read `/doctorLocations` (all doctors' current status), and read/update vitals on `/patients` allotted to them. Cannot access `/inventory` or `/pharmacySales`.
   - **Admin**: Full administrative oversight across all collections including `/staffDirectory`.
4. **Terminal State Locking**: Once a `/prescriptions/{id}` reaches `status == 'Dispensed'` or a `/patients/{id}` reaches `status == 'Discharged'`, non-admin updates are strictly blocked.
5. **Immutable Audit Fields & Server Timestamps**: `createdAt`, `uid`, `createdByUid`, `doctorUid`, and `pharmacistUid` are immutable after creation and validated against `request.time` and `request.auth.uid`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Role Escalation on Registration**: Non-admin tries to create `/users/{uid}` with `role: "admin"`. -> MUST FAIL (`PERMISSION_DENIED`).
2. **Shadow Role Update**: Authenticated doctor tries to update `/users/{uid}` changing `role` to `"admin"`. -> MUST FAIL.
3. **PII Leak (`users` cross-read)**: Authenticated nurse attempts `get(/users/otherUid)`. -> MUST FAIL.
4. **Ghost Field Injection (Shadow Update)**: Pharmacist tries to add `{ isVerified: true }` to an `/inventory/{id}` update. -> MUST FAIL (`hasOnly` rejection).
5. **Unverified Email Spoofing**: Token claiming admin email with `email_verified: false` attempts write. -> MUST FAIL.
6. **ID Poisoning**: Creating `/patients/` with a 200-char ID containing invalid characters (`../hack`). -> MUST FAIL (`isValidId`).
7. **Oversized String DoW Attack**: Creating `/patients/{id}` with a 5,000-char `symptoms` field. -> MUST FAIL (`.size() <= 600`).
8. **Unbounded Array Injection**: Creating `/prescriptions/{id}` with 25 items in `items`. -> MUST FAIL (`items.size() <= 10`).
9. **Terminal State Tampering**: Pharmacist tries to edit a prescription already marked `status: "Dispensed"`. -> MUST FAIL.
10. **Cross-Role Unauthorized Write (Pharmacy -> Patients)**: Pharmacist attempts to create or discharge a `/patients/{id}` document. -> MUST FAIL.
11. **Cross-Role Unauthorized Read (Ward Staff -> Pharmacy Sales)**: Ward staff attempts to read `/pharmacySales/{id}`. -> MUST FAIL.
12. **Client Timestamp Forgery**: Creating `/pharmacySales/{id}` with a backdated client timestamp instead of `request.time`. -> MUST FAIL.
