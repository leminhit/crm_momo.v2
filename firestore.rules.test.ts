/**
 * Security Rules Verification Suite — Dirty Dozen Adversarial Payloads
 * Intended for execution against Firebase Emulator Suite (@firebase/rules-unit-testing)
 * when running local emulator verification.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'create' | 'update' | 'get' | 'list';
  path: string;
  expected: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Customer Create',
    operation: 'create',
    path: 'workspaces/personal_u1/customers/c1',
    expected: 'PERMISSION_DENIED',
    payload: { fullName: 'Unauth User' },
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    operation: 'create',
    path: 'workspaces/personal_u1/customers/c1',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'u1', fullName: 'Unverified' },
  },
  {
    id: 3,
    name: 'Identity Spoofing on OwnerId',
    operation: 'create',
    path: 'workspaces/personal_u1/customers/c1',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'victim_uid', workspaceId: 'personal_u1' },
  },
  {
    id: 4,
    name: 'Shadow Field Injection (isVerified/isAdmin)',
    operation: 'create',
    path: 'workspaces/personal_u1/customers/c1',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'u1', shadowAdmin: true },
  },
  {
    id: 5,
    name: 'ID Poisoning (>128 chars or invalid regex)',
    operation: 'create',
    path: `workspaces/personal_u1/customers/${'a'.repeat(200)}`,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Client-Forged Timestamp Spoofing',
    operation: 'create',
    path: 'workspaces/personal_u1/customers/c1',
    expected: 'PERMISSION_DENIED',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
  },
  {
    id: 7,
    name: 'Immortal Field Mutation (ownerId / createdAt)',
    operation: 'update',
    path: 'workspaces/personal_u1/customers/c1',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'attacker_uid' },
  },
  {
    id: 8,
    name: 'Cross-Tenant List Scraping',
    operation: 'list',
    path: 'workspaces/personal_victim/customers',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Cross-Tenant Note Subcollection Injection',
    operation: 'create',
    path: 'workspaces/personal_victim/customers/c1/notes/n1',
    expected: 'PERMISSION_DENIED',
    payload: { authorId: 'attacker_uid', content: 'Injected' },
  },
  {
    id: 10,
    name: 'Array Exhaustion (>10 phones or >10 tags)',
    operation: 'create',
    path: 'workspaces/personal_u1/customers/c1',
    expected: 'PERMISSION_DENIED',
    payload: {
      phones: Array.from({ length: 15 }, (_, i) => ({
        number: `09000000${i}`,
        label: 'Mobile',
        isPrimary: i === 0,
        hasZalo: true,
      })),
    },
  },
  {
    id: 11,
    name: 'Value Poisoning on Status Enum',
    operation: 'update',
    path: 'workspaces/personal_u1/customers/c1',
    expected: 'PERMISSION_DENIED',
    payload: { status: 'invalid_enum_stage' },
  },
  {
    id: 12,
    name: 'Cross-User PII Profile Read',
    operation: 'get',
    path: 'users/victim_uid',
    expected: 'PERMISSION_DENIED',
  },
];
