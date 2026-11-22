# Security Specification — Personal CRM (Team-Ready Workspace Architecture)

## 1. Data Invariants
1. **Strict Ownership & Master Gate**: Every customer and note resides under `/workspaces/{workspaceId}`. Access requires verified authentication (`email_verified == true`), valid path IDs (`^[a-zA-Z0-9_\-]+$`), and membership in `/workspaces/{workspaceId}/members/{request.auth.uid}` (or ownership for root workspace creation).
2. **No Self-Assigned Escalation**: Users cannot assign themselves to another user's workspace or elevate a member role without being the workspace owner.
3. **Strict Schema Keys**: Every document create requires exact required keys and rejects any shadow/ghost fields via `hasAll` + `hasOnly`. Every update uses `affectedKeys().hasOnly(...)` inside named action branches AND re-validates the full entity via `isValid[Entity]()`.
4. **Immutable Ownership & Temporal Integrity**: `ownerId`, `workspaceId`, `customerId`, and `createdAt` cannot be mutated after creation. `createdAt` and `updatedAt` must equal `request.time`.
5. **Bounded Arrays & Numeric/String Limits**: `phones` is bounded to 1–10 items with validated first element shape; `tags` is bounded to 0–10 items; `machineCount` is bounded to `0..1000`; all string fields (including `soldAt` max 32 chars) enforce explicit `.size()` caps.
6. **PII & List Isolation**: Customer PII (phone numbers, email, address) is readable only by the owner/assignee (`resource.data.ownerId == request.auth.uid || resource.data.assignedTo == request.auth.uid`), enforced directly inside `allow list` without `get()` lookups.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Create**: Creating a customer with `auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: Creating a customer when `request.auth.token.email_verified == false` -> `PERMISSION_DENIED`.
3. **Identity Spoofing**: Creating a customer with `ownerId: "victim-uid"` while authenticated as `"attacker-uid"` -> `PERMISSION_DENIED`.
4. **Shadow / Ghost Field Injection**: Creating or updating a customer with extra key `{ isAdmin: true }` or `{ shadowFlag: "x" }` -> `PERMISSION_DENIED`.
5. **ID Poisoning (1.5KB Document ID)**: Creating a customer at `/workspaces/ws1/customers/<1500-char-id>` or invalid characters `../admin` -> `PERMISSION_DENIED`.
6. **Timestamp Spoofing**: Creating a customer with client-forged `createdAt` (`Timestamp.fromDate(new Date('2020-01-01'))`) instead of `request.time` -> `PERMISSION_DENIED`.
7. **Immortal Field Mutation**: Updating `ownerId`, `workspaceId`, or `createdAt` on an existing customer -> `PERMISSION_DENIED`.
8. **Cross-Tenant List Scraping**: Querying `collection(db, 'workspaces/victim_ws/customers')` without `where('ownerId', '==', attackerUid)` -> `PERMISSION_DENIED`.
9. **Cross-Tenant Note Injection**: Creating a note inside `/workspaces/victim_ws/customers/c1/notes/n1` where parent workspace member does not exist for attacker -> `PERMISSION_DENIED`.
10. **Array Exhaustion (Denial of Wallet)**: Creating a customer with 50 phone entries or 25 tags -> `PERMISSION_DENIED`.
11. **Value Poisoning on Update**: Updating `status` to `"hacked_status"` or `fullName` to a 5,000-character string -> `PERMISSION_DENIED`.
12. **PII Read Leak on Users**: Reading `/users/otherUserUid` as `"attacker-uid"` -> `PERMISSION_DENIED`.
