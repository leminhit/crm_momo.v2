import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { getTodayDateString } from './payroll';
import { generateFirestoreId } from './utils';
import { CRM_LIMITS } from './validators';
import type {
  CustomerNoteRecord,
  CustomerPriority,
  CustomerRecord,
  CustomerStatus,
  NoteInteractionType,
  OrderRecord,
  PhoneEntry,
  UserProfileRecord,
  WorkspaceRecord,
} from '../types/crm';

function toDateOrNull(val: unknown): Date | null {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return null;
}

export function mapCustomerDoc(id: string, data: Record<string, unknown>): CustomerRecord {
  const phonesRaw = Array.isArray(data.phones) ? data.phones : [];
  const phones: PhoneEntry[] = phonesRaw
    .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
    .map((p, idx) => ({
      number: String(p.number ?? ''),
      label: String(p.label ?? 'Di động'),
      isPrimary: typeof p.isPrimary === 'boolean' ? p.isPrimary : idx === 0,
      hasZalo: typeof p.hasZalo === 'boolean' ? p.hasZalo : true,
    }));

  return {
    id,
    workspaceId: String(data.workspaceId ?? ''),
    ownerId: String(data.ownerId ?? ''),
    assignedTo: String(data.assignedTo ?? ''),
    fullName: String(data.fullName ?? ''),
    company: String(data.company ?? ''),
    position: String(data.position ?? ''),
    phones:
      phones.length > 0
        ? phones
        : [{ number: '', label: 'Di động', isPrimary: true, hasZalo: true }],
    email: String(data.email ?? ''),
    address: String(data.address ?? ''),
    googleMapsUrl: String(data.googleMapsUrl ?? ''),
    status: (data.status as CustomerStatus) ?? 'lead',
    priority: (data.priority as CustomerPriority) ?? 'medium',
    source: String(data.source ?? ''),
    tags: Array.isArray(data.tags) ? data.tags.map((t) => String(t)) : [],
    quickNote: String(data.quickNote ?? ''),
    nextFollowUpAt: String(data.nextFollowUpAt ?? ''),
    estimatedValue: typeof data.estimatedValue === 'number' ? data.estimatedValue : 0,
    isStarred: Boolean(data.isStarred),
    soldAt: typeof data.soldAt === 'string' ? data.soldAt : '',
    machineCount:
      typeof data.machineCount === 'number' && Number.isFinite(data.machineCount)
        ? Math.max(0, Math.floor(data.machineCount))
        : 1,
    createdAt: toDateOrNull(data.createdAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export function mapNoteDoc(id: string, data: Record<string, unknown>): CustomerNoteRecord {
  return {
    id,
    workspaceId: String(data.workspaceId ?? ''),
    customerId: String(data.customerId ?? ''),
    authorId: String(data.authorId ?? ''),
    authorName: String(data.authorName ?? ''),
    type: (data.type as NoteInteractionType) ?? 'note',
    content: String(data.content ?? ''),
    createdAt: toDateOrNull(data.createdAt),
  };
}

export function mapOrderDoc(id: string, data: Record<string, unknown>): OrderRecord {
  return {
    id,
    workspaceId: String(data.workspaceId ?? ''),
    ownerId: String(data.ownerId ?? ''),
    customerId: String(data.customerId ?? ''),
    customerName: String(data.customerName ?? ''),
    customerPhone: String(data.customerPhone ?? ''),
    orderCode: String(data.orderCode ?? ''),
    address: String(data.address ?? ''),
    googleMapsUrl: String(data.googleMapsUrl ?? ''),
    soldAt: String(data.soldAt ?? ''),
    note: String(data.note ?? ''),
    machineCount:
      typeof data.machineCount === 'number' && Number.isFinite(data.machineCount)
        ? Math.max(1, Math.floor(data.machineCount))
        : 1,
    createdAt: toDateOrNull(data.createdAt),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

/**
 * Ensures the signed-in user has a User profile, Personal Workspace, and Owner Member doc.
 * Designed so expanding to a Team CRM later only requires inviting members to the workspace.
 */
export async function ensureUserWorkspace(user: User): Promise<{
  profile: UserProfileRecord;
  workspace: WorkspaceRecord;
}> {
  const uid = user.uid;
  const defaultWsId = `personal_${uid}`;
  const userRef = doc(db, 'users', uid);
  const defaultWsRef = doc(db, 'workspaces', defaultWsId);
  const defaultMemberRef = doc(db, 'workspaces', defaultWsId, 'members', uid);

  let existingUserSnap;
  let defaultWsSnap;
  let defaultMemberSnap;
  try {
    [existingUserSnap, defaultWsSnap, defaultMemberSnap] = await Promise.all([
      getDoc(userRef),
      getDoc(defaultWsRef),
      getDoc(defaultMemberRef),
    ]);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  }

  let workspaceId = defaultWsId;
  let wsSnap = defaultWsSnap;
  let memberSnap = defaultMemberSnap;

  if (existingUserSnap.exists()) {
    const uData = existingUserSnap.data();
    if (
      typeof uData.defaultWorkspaceId === 'string' &&
      uData.defaultWorkspaceId &&
      uData.defaultWorkspaceId !== defaultWsId
    ) {
      workspaceId = uData.defaultWorkspaceId;
      try {
        [wsSnap, memberSnap] = await Promise.all([
          getDoc(doc(db, 'workspaces', workspaceId)),
          getDoc(doc(db, 'workspaces', workspaceId, 'members', uid)),
        ]);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `workspaces/${workspaceId}`);
      }
    }
  }

  const wsRef = doc(db, 'workspaces', workspaceId);
  const memberRef = doc(db, 'workspaces', workspaceId, 'members', uid);
  const safeName = (
    user.displayName ||
    user.email?.split('@')[0] ||
    'Người dùng CRM'
  ).slice(0, 120);
  const safeEmail = (user.email || '').slice(0, 160);

  const needsCreate = !wsSnap.exists() || !memberSnap.exists() || !existingUserSnap.exists();
  if (needsCreate) {
    const batch = writeBatch(db);

    if (!wsSnap.exists()) {
      batch.set(wsRef, {
        id: workspaceId,
        name: 'CRM Cá Nhân',
        ownerId: uid,
        mode: 'personal',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (!memberSnap.exists()) {
      batch.set(memberRef, {
        uid,
        workspaceId,
        role: 'owner',
        displayName: safeName,
        email: safeEmail,
        joinedAt: serverTimestamp(),
      });
    }

    if (!existingUserSnap.exists()) {
      const userPayload: Record<string, unknown> = {
        uid,
        displayName: safeName,
        email: safeEmail,
        defaultWorkspaceId: workspaceId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (user.photoURL) {
        userPayload.photoURL = user.photoURL.slice(0, 500);
      }
      batch.set(userRef, userPayload);
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `workspaces/${workspaceId}`);
    }

    const [finalUserSnap, finalWsSnap] = await Promise.all([
      getDoc(userRef),
      getDoc(wsRef),
    ]);
    const uData = finalUserSnap.data() ?? {};
    const wData = finalWsSnap.data() ?? {};

    return {
      profile: {
        uid,
        displayName: String(uData.displayName ?? safeName),
        email: String(uData.email ?? safeEmail),
        photoURL:
          typeof uData.photoURL === 'string'
            ? uData.photoURL
            : user.photoURL ?? undefined,
        defaultWorkspaceId: String(uData.defaultWorkspaceId ?? workspaceId),
        createdAt: toDateOrNull(uData.createdAt),
        updatedAt: toDateOrNull(uData.updatedAt),
      },
      workspace: {
        id: workspaceId,
        name: String(wData.name ?? 'CRM Cá Nhân'),
        ownerId: String(wData.ownerId ?? uid),
        mode: wData.mode === 'team' ? 'team' : 'personal',
        createdAt: toDateOrNull(wData.createdAt),
        updatedAt: toDateOrNull(wData.updatedAt),
      },
    };
  }

  const uData = existingUserSnap.data() ?? {};
  const wData = wsSnap.data() ?? {};

  return {
    profile: {
      uid,
      displayName: String(uData.displayName ?? safeName),
      email: String(uData.email ?? safeEmail),
      photoURL:
        typeof uData.photoURL === 'string'
          ? uData.photoURL
          : user.photoURL ?? undefined,
      defaultWorkspaceId: String(uData.defaultWorkspaceId ?? workspaceId),
      createdAt: toDateOrNull(uData.createdAt),
      updatedAt: toDateOrNull(uData.updatedAt),
    },
    workspace: {
      id: workspaceId,
      name: String(wData.name ?? 'CRM Cá Nhân'),
      ownerId: String(wData.ownerId ?? uid),
      mode: wData.mode === 'team' ? 'team' : 'personal',
      createdAt: toDateOrNull(wData.createdAt),
      updatedAt: toDateOrNull(wData.updatedAt),
    },
  };
}

export async function renameWorkspace(
  workspaceId: string,
  name: string,
  mode: 'personal' | 'team'
): Promise<void> {
  const path = `workspaces/${workspaceId}`;
  try {
    await updateDoc(doc(db, 'workspaces', workspaceId), {
      name: name.trim().slice(0, CRM_LIMITS.WORKSPACE_NAME_MAX),
      mode,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export interface CustomerInputPayload {
  fullName: string;
  company: string;
  position: string;
  phones: PhoneEntry[];
  email: string;
  address: string;
  googleMapsUrl: string;
  status: CustomerStatus;
  priority: CustomerPriority;
  source: string;
  tags: string[];
  quickNote: string;
  nextFollowUpAt: string;
  estimatedValue: number;
  isStarred: boolean;
  soldAt?: string;
  machineCount?: number;
}

function sanitizePhones(phones: PhoneEntry[]): PhoneEntry[] {
  const cleaned = phones
    .map((p, index) => ({
      number: p.number.trim().slice(0, CRM_LIMITS.PHONE_MAX),
      label: (p.label.trim() || 'Di động').slice(0, CRM_LIMITS.PHONE_LABEL_MAX),
      isPrimary: Boolean(p.isPrimary),
      hasZalo: Boolean(p.hasZalo),
      _idx: index,
    }))
    .filter((p) => p.number.length >= CRM_LIMITS.PHONE_MIN)
    .slice(0, CRM_LIMITS.PHONES_MAX_ITEMS);

  if (cleaned.length === 0) {
    throw new Error('Cần ít nhất 1 số điện thoại hợp lệ.');
  }

  const hasPrimary = cleaned.some((p) => p.isPrimary);
  return cleaned.map((p, idx) => ({
    number: p.number,
    label: p.label,
    isPrimary: hasPrimary ? p.isPrimary : idx === 0,
    hasZalo: p.hasZalo,
  }));
}

function sanitizeCustomerFields(input: CustomerInputPayload) {
  const cleanSoldAt = (input.soldAt ?? '').trim().slice(0, CRM_LIMITS.SOLD_AT_MAX);
  const resolvedSoldAt =
    input.status === 'won' ? cleanSoldAt || getTodayDateString() : cleanSoldAt;
  const rawMachineCount =
    typeof input.machineCount === 'number' && Number.isFinite(input.machineCount)
      ? Math.min(CRM_LIMITS.MACHINE_COUNT_MAX, Math.max(0, Math.floor(input.machineCount)))
      : 1;
  const resolvedMachineCount =
    input.status === 'won' ? Math.max(1, rawMachineCount) : rawMachineCount;

  return {
    fullName: input.fullName.trim().slice(0, CRM_LIMITS.FULL_NAME_MAX),
    company: input.company.trim().slice(0, CRM_LIMITS.COMPANY_MAX),
    position: input.position.trim().slice(0, CRM_LIMITS.POSITION_MAX),
    phones: sanitizePhones(input.phones),
    email: input.email.trim().slice(0, CRM_LIMITS.EMAIL_MAX),
    address: input.address.trim().slice(0, CRM_LIMITS.ADDRESS_MAX),
    googleMapsUrl: input.googleMapsUrl.trim().slice(0, CRM_LIMITS.MAPS_URL_MAX),
    status: input.status,
    priority: input.priority,
    source: input.source.trim().slice(0, CRM_LIMITS.SOURCE_MAX),
    tags: input.tags
      .map((t) => t.trim().slice(0, CRM_LIMITS.TAG_MAX))
      .filter(Boolean)
      .slice(0, CRM_LIMITS.TAGS_MAX_ITEMS),
    quickNote: input.quickNote.trim().slice(0, CRM_LIMITS.QUICK_NOTE_MAX),
    nextFollowUpAt: input.nextFollowUpAt.trim().slice(0, CRM_LIMITS.NEXT_FOLLOWUP_MAX),
    estimatedValue: Math.max(0, Number(input.estimatedValue) || 0),
    isStarred: Boolean(input.isStarred),
    soldAt: resolvedSoldAt,
    machineCount: resolvedMachineCount,
  };
}

export async function createCustomer(
  workspaceId: string,
  ownerId: string,
  input: CustomerInputPayload,
  customId?: string
): Promise<string> {
  const id = customId && CRM_LIMITS.ID_PATTERN.test(customId)
    ? customId.slice(0, CRM_LIMITS.ID_MAX)
    : generateFirestoreId('cust');
  const path = `workspaces/${workspaceId}/customers/${id}`;
  const clean = sanitizeCustomerFields(input);

  try {
    await setDoc(doc(db, 'workspaces', workspaceId, 'customers', id), {
      id,
      workspaceId,
      ownerId,
      assignedTo: ownerId,
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCustomer(
  workspaceId: string,
  customerId: string,
  assignedTo: string,
  input: CustomerInputPayload
): Promise<void> {
  const path = `workspaces/${workspaceId}/customers/${customerId}`;
  const clean = sanitizeCustomerFields(input);

  try {
    await updateDoc(doc(db, 'workspaces', workspaceId, 'customers', customerId), {
      ...clean,
      assignedTo,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateCustomerStatus(
  workspaceId: string,
  customerId: string,
  status: CustomerStatus,
  existingCustomer?: Pick<CustomerRecord, 'soldAt' | 'machineCount'>
): Promise<void> {
  const path = `workspaces/${workspaceId}/customers/${customerId}`;
  const updatePayload: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (status === 'won') {
    updatePayload.soldAt = existingCustomer?.soldAt?.trim() || getTodayDateString();
    updatePayload.machineCount =
      existingCustomer && existingCustomer.machineCount >= 1
        ? Math.min(CRM_LIMITS.MACHINE_COUNT_MAX, Math.floor(existingCustomer.machineCount))
        : 1;
  }

  try {
    await updateDoc(doc(db, 'workspaces', workspaceId, 'customers', customerId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleCustomerStar(
  workspaceId: string,
  customerId: string,
  isStarred: boolean
): Promise<void> {
  const path = `workspaces/${workspaceId}/customers/${customerId}`;
  try {
    await updateDoc(doc(db, 'workspaces', workspaceId, 'customers', customerId), {
      isStarred,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateCustomerFollowUp(
  workspaceId: string,
  customerId: string,
  quickNote: string,
  nextFollowUpAt: string
): Promise<void> {
  const path = `workspaces/${workspaceId}/customers/${customerId}`;
  try {
    await updateDoc(doc(db, 'workspaces', workspaceId, 'customers', customerId), {
      quickNote: quickNote.trim().slice(0, CRM_LIMITS.QUICK_NOTE_MAX),
      nextFollowUpAt: nextFollowUpAt.trim().slice(0, CRM_LIMITS.NEXT_FOLLOWUP_MAX),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCustomer(
  workspaceId: string,
  customerId: string,
  uid: string
): Promise<void> {
  const notesPath = `workspaces/${workspaceId}/customers/${customerId}/notes`;
  const customerPath = `workspaces/${workspaceId}/customers/${customerId}`;
  try {
    const [notesSnap, ordersSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'workspaces', workspaceId, 'customers', customerId, 'notes'),
          where('authorId', '==', uid)
        )
      ),
      getDocs(
        query(
          collection(db, 'workspaces', workspaceId, 'orders'),
          where('ownerId', '==', uid)
        )
      ),
    ]);
    const matchingOrderDocs = ordersSnap.docs.filter(
      (d) => d.data().customerId === customerId
    );
    if (!notesSnap.empty || matchingOrderDocs.length > 0) {
      const batch = writeBatch(db);
      notesSnap.docs.forEach((d) => batch.delete(d.ref));
      matchingOrderDocs.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, 'workspaces', workspaceId, 'customers', customerId));
      await batch.commit();
    } else {
      await deleteDoc(doc(db, 'workspaces', workspaceId, 'customers', customerId));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${notesPath} -> ${customerPath}`);
  }
}

export async function bulkDeleteCustomers(
  workspaceId: string,
  customerIds: string[],
  uid: string
): Promise<void> {
  for (const customerId of customerIds) {
    await deleteCustomer(workspaceId, customerId, uid);
  }
}

export async function bulkUpdateCustomerStatus(
  workspaceId: string,
  customerIds: string[],
  status: CustomerStatus,
  existingCustomers?: CustomerRecord[]
): Promise<void> {
  const existingMap = new Map(existingCustomers?.map((c) => [c.id, c]) ?? []);
  const today = getTodayDateString();
  const chunkSize = 400;
  for (let i = 0; i < customerIds.length; i += chunkSize) {
    const slice = customerIds.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const id of slice) {
      const updatePayload: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
      };
      if (status === 'won') {
        const existing = existingMap.get(id);
        updatePayload.soldAt = existing?.soldAt?.trim() || today;
        updatePayload.machineCount =
          existing && existing.machineCount >= 1
            ? Math.min(CRM_LIMITS.MACHINE_COUNT_MAX, Math.floor(existing.machineCount))
            : 1;
      }
      batch.update(doc(db, 'workspaces', workspaceId, 'customers', id), updatePayload);
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `workspaces/${workspaceId}/customers`);
    }
  }
}

export async function addCustomerNote(
  workspaceId: string,
  customerId: string,
  authorId: string,
  authorName: string,
  type: NoteInteractionType,
  content: string
): Promise<string> {
  const noteId = generateFirestoreId('note');
  const path = `workspaces/${workspaceId}/customers/${customerId}/notes/${noteId}`;
  try {
    await setDoc(doc(db, 'workspaces', workspaceId, 'customers', customerId, 'notes', noteId), {
      id: noteId,
      workspaceId,
      customerId,
      authorId,
      authorName: authorName.trim().slice(0, CRM_LIMITS.FULL_NAME_MAX) || 'Tôi',
      type,
      content: content.trim().slice(0, CRM_LIMITS.NOTE_CONTENT_MAX),
      createdAt: serverTimestamp(),
    });
    return noteId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCustomerNote(
  workspaceId: string,
  customerId: string,
  noteId: string
): Promise<void> {
  const path = `workspaces/${workspaceId}/customers/${customerId}/notes/${noteId}`;
  try {
    await deleteDoc(doc(db, 'workspaces', workspaceId, 'customers', customerId, 'notes', noteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface OrderInputPayload {
  customerId: string;
  orderCode: string;
  soldAt: string;
  address: string;
  googleMapsUrl: string;
  note: string;
  machineCount?: number;
}

function getCustomerPrimaryPhone(customer: Pick<CustomerRecord, 'phones'>): string {
  const primary = customer.phones.find((p) => p.isPrimary) ?? customer.phones[0];
  return (primary?.number ?? '').trim().slice(0, CRM_LIMITS.PHONE_MAX);
}

function sanitizeOrderFields(customer: CustomerRecord, input: OrderInputPayload) {
  const cleanOrderCode =
    input.orderCode.trim().slice(0, CRM_LIMITS.ORDER_CODE_MAX) || 'DH-001';
  const cleanSoldAt =
    input.soldAt.trim().slice(0, CRM_LIMITS.SOLD_AT_MAX) || getTodayDateString();
  const cleanAddress = input.address.trim().slice(0, CRM_LIMITS.ADDRESS_MAX);
  const cleanMaps = input.googleMapsUrl.trim().slice(0, CRM_LIMITS.MAPS_URL_MAX);
  const cleanNote = input.note.trim().slice(0, CRM_LIMITS.ORDER_NOTE_MAX);
  const cleanMachines =
    typeof input.machineCount === 'number' && Number.isFinite(input.machineCount)
      ? Math.min(CRM_LIMITS.MACHINE_COUNT_MAX, Math.max(1, Math.floor(input.machineCount)))
      : 1;

  return {
    customerId: customer.id,
    customerName:
      customer.fullName.trim().slice(0, CRM_LIMITS.FULL_NAME_MAX) || 'Khách hàng',
    customerPhone: getCustomerPrimaryPhone(customer),
    orderCode: cleanOrderCode,
    address: cleanAddress,
    googleMapsUrl: cleanMaps,
    soldAt: cleanSoldAt,
    note: cleanNote,
    machineCount: cleanMachines,
  };
}

export async function createOrderWithCustomerSync(
  workspaceId: string,
  ownerId: string,
  customer: CustomerRecord,
  input: OrderInputPayload,
  options?: {
    migrateLegacyOrder?: boolean;
    legacySoldAt?: string;
    legacyMachineCount?: number;
  }
): Promise<string> {
  const orderId = generateFirestoreId('ord');
  const path = `workspaces/${workspaceId}/orders/${orderId}`;
  const clean = sanitizeOrderFields(customer, input);
  const batch = writeBatch(db);

  batch.set(doc(db, 'workspaces', workspaceId, 'orders', orderId), {
    id: orderId,
    workspaceId,
    ownerId,
    ...clean,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (options?.migrateLegacyOrder) {
    const legacyOrderId = generateFirestoreId('ord');
    const legacySoldAt =
      (options.legacySoldAt ?? '').trim().slice(0, CRM_LIMITS.SOLD_AT_MAX) ||
      getTodayDateString();
    const legacyMachines =
      typeof options.legacyMachineCount === 'number' &&
      Number.isFinite(options.legacyMachineCount)
        ? Math.min(
            CRM_LIMITS.MACHINE_COUNT_MAX,
            Math.max(1, Math.floor(options.legacyMachineCount))
          )
        : 1;
    const legacyCode = `${clean.orderCode}-CU`.slice(0, CRM_LIMITS.ORDER_CODE_MAX);
    batch.set(doc(db, 'workspaces', workspaceId, 'orders', legacyOrderId), {
      id: legacyOrderId,
      workspaceId,
      ownerId,
      customerId: customer.id,
      customerName: clean.customerName,
      customerPhone: clean.customerPhone,
      orderCode: legacyCode,
      address: customer.address.trim().slice(0, CRM_LIMITS.ADDRESS_MAX),
      googleMapsUrl: customer.googleMapsUrl.trim().slice(0, CRM_LIMITS.MAPS_URL_MAX),
      soldAt: legacySoldAt,
      note: 'Đơn cũ trước khi tách đơn hàng',
      machineCount: legacyMachines,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // Auto-transition customer from any non-won status (e.g., Chăm sóc sau) to Đã bán
  if (customer.status !== 'won') {
    batch.update(doc(db, 'workspaces', workspaceId, 'customers', customer.id), {
      status: 'won',
      soldAt: customer.soldAt?.trim() || clean.soldAt,
      machineCount: Math.max(1, customer.machineCount || 1),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return orderId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateOrder(
  workspaceId: string,
  orderId: string,
  customer: CustomerRecord,
  input: OrderInputPayload
): Promise<void> {
  const path = `workspaces/${workspaceId}/orders/${orderId}`;
  const clean = sanitizeOrderFields(customer, input);

  try {
    await updateDoc(doc(db, 'workspaces', workspaceId, 'orders', orderId), {
      ...clean,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteOrder(
  workspaceId: string,
  orderId: string
): Promise<void> {
  const path = `workspaces/${workspaceId}/orders/${orderId}`;
  try {
    await deleteDoc(doc(db, 'workspaces', workspaceId, 'orders', orderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface CrmBackupBundle {
  version: 1;
  exportedAt: string;
  workspaceName: string;
  customers: Array<
    CustomerInputPayload & {
      id: string;
      createdAtIso?: string;
      updatedAtIso?: string;
      notes?: Array<{
        id: string;
        type: NoteInteractionType;
        content: string;
        authorName: string;
        createdAtIso?: string;
      }>;
    }
  >;
  orders?: Array<{
    id: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    orderCode: string;
    address: string;
    googleMapsUrl: string;
    soldAt: string;
    note: string;
    machineCount: number;
    createdAtIso?: string;
    updatedAtIso?: string;
  }>;
}

export async function buildBackupBundle(
  workspace: WorkspaceRecord,
  customers: CustomerRecord[],
  orders: OrderRecord[],
  uid: string
): Promise<CrmBackupBundle> {
  const customersWithNotes = await Promise.all(
    customers.map(async (c) => {
      let notes: Array<{
        id: string;
        type: NoteInteractionType;
        content: string;
        authorName: string;
        createdAtIso?: string;
      }> = [];
      try {
        const snap = await getDocs(
          query(
            collection(db, 'workspaces', workspace.id, 'customers', c.id, 'notes'),
            where('authorId', '==', uid)
          )
        );
        notes = snap.docs.map((d) => {
          const mapped = mapNoteDoc(d.id, d.data());
          return {
            id: mapped.id,
            type: mapped.type,
            content: mapped.content,
            authorName: mapped.authorName,
            createdAtIso: mapped.createdAt ? mapped.createdAt.toISOString() : undefined,
          };
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `workspaces/${workspace.id}/customers/${c.id}/notes`
        );
      }
      return {
        id: c.id,
        fullName: c.fullName,
        company: c.company,
        position: c.position,
        phones: c.phones,
        email: c.email,
        address: c.address,
        googleMapsUrl: c.googleMapsUrl,
        status: c.status,
        priority: c.priority,
        source: c.source,
        tags: c.tags,
        quickNote: c.quickNote,
        nextFollowUpAt: c.nextFollowUpAt,
        estimatedValue: c.estimatedValue,
        isStarred: c.isStarred,
        soldAt: c.soldAt,
        machineCount: c.machineCount,
        createdAtIso: c.createdAt ? c.createdAt.toISOString() : undefined,
        updatedAtIso: c.updatedAt ? c.updatedAt.toISOString() : undefined,
        notes,
      };
    })
  );

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    workspaceName: workspace.name,
    customers: customersWithNotes,
    orders: orders.map((o) => ({
      id: o.id,
      customerId: o.customerId,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      orderCode: o.orderCode,
      address: o.address,
      googleMapsUrl: o.googleMapsUrl,
      soldAt: o.soldAt,
      note: o.note,
      machineCount: o.machineCount,
      createdAtIso: o.createdAt ? o.createdAt.toISOString() : undefined,
      updatedAtIso: o.updatedAt ? o.updatedAt.toISOString() : undefined,
    })),
  };
}

export async function restoreCustomersFromBackup(
  workspaceId: string,
  ownerId: string,
  authorName: string,
  bundle: CrmBackupBundle,
  existingCustomerIds: Set<string>,
  existingOrderIds: Set<string>,
  mode: 'skip-existing' | 'overwrite-existing'
): Promise<{ created: number; updated: number; skipped: number; ordersRestored: number }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let ordersRestored = 0;

  // Map original bundle customerId -> resolved Firestore customerId
  const customerIdMap = new Map<string, string>();
  const allValidCustomerIds = new Set<string>(existingCustomerIds);

  // Chunk customer writes safely under Firestore 500-op batch limit
  const batchOps: Array<{
    type: 'create' | 'update';
    id: string;
    payload: CustomerInputPayload;
    notes?: CrmBackupBundle['customers'][number]['notes'];
  }> = [];

  for (const item of bundle.customers) {
    const safeId =
      item.id && CRM_LIMITS.ID_PATTERN.test(item.id)
        ? item.id.slice(0, CRM_LIMITS.ID_MAX)
        : generateFirestoreId('cust');
    customerIdMap.set(item.id, safeId);
    allValidCustomerIds.add(safeId);

    const exists = existingCustomerIds.has(safeId);

    if (exists && mode === 'skip-existing') {
      skipped += 1;
      continue;
    }

    batchOps.push({
      type: exists ? 'update' : 'create',
      id: safeId,
      payload: item,
      notes: item.notes,
    });
  }

  const chunkSize = 250;
  for (let i = 0; i < batchOps.length; i += chunkSize) {
    const chunk = batchOps.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const op of chunk) {
      const clean = sanitizeCustomerFields(op.payload);
      const ref = doc(db, 'workspaces', workspaceId, 'customers', op.id);
      if (op.type === 'update') {
        batch.update(ref, {
          ...clean,
          assignedTo: ownerId,
          updatedAt: serverTimestamp(),
        });
        updated += 1;
      } else {
        batch.set(ref, {
          id: op.id,
          workspaceId,
          ownerId,
          assignedTo: ownerId,
          ...clean,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        created += 1;
      }
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `workspaces/${workspaceId}/customers`);
    }

    // Restore missing notes for newly created customers
    for (const op of chunk) {
      if (op.type === 'create' && op.notes && op.notes.length > 0) {
        const noteBatch = writeBatch(db);
        for (const n of op.notes.slice(0, 50)) {
          const noteId =
            n.id && CRM_LIMITS.ID_PATTERN.test(n.id)
              ? n.id.slice(0, CRM_LIMITS.ID_MAX)
              : generateFirestoreId('note');
          noteBatch.set(
            doc(db, 'workspaces', workspaceId, 'customers', op.id, 'notes', noteId),
            {
              id: noteId,
              workspaceId,
              customerId: op.id,
              authorId: ownerId,
              authorName: (n.authorName || authorName || 'Tôi').slice(0, CRM_LIMITS.FULL_NAME_MAX),
              type: ['note', 'call', 'zalo', 'meeting', 'visit'].includes(n.type) ? n.type : 'note',
              content: (n.content || '').slice(0, CRM_LIMITS.NOTE_CONTENT_MAX) || 'Ghi chú khôi phục',
              createdAt: serverTimestamp(),
            }
          );
        }
        try {
          await noteBatch.commit();
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.CREATE,
            `workspaces/${workspaceId}/customers/${op.id}/notes`
          );
        }
      }
    }
  }

  // Restore orders AFTER customers are committed so Firestore exists() check succeeds
  if (Array.isArray(bundle.orders) && bundle.orders.length > 0) {
    const orderOps: Array<{
      type: 'create' | 'update';
      id: string;
      customerId: string;
      data: NonNullable<CrmBackupBundle['orders']>[number];
    }> = [];

    for (const ord of bundle.orders) {
      const resolvedCustId = customerIdMap.get(ord.customerId) ?? ord.customerId;
      if (!CRM_LIMITS.ID_PATTERN.test(resolvedCustId) || !allValidCustomerIds.has(resolvedCustId)) {
        continue;
      }
      const safeOrderId =
        ord.id && CRM_LIMITS.ID_PATTERN.test(ord.id)
          ? ord.id.slice(0, CRM_LIMITS.ID_MAX)
          : generateFirestoreId('ord');
      const exists = existingOrderIds.has(safeOrderId);
      if (exists && mode === 'skip-existing') {
        continue;
      }
      orderOps.push({
        type: exists ? 'update' : 'create',
        id: safeOrderId,
        customerId: resolvedCustId,
        data: ord,
      });
    }

    for (let i = 0; i < orderOps.length; i += chunkSize) {
      const chunk = orderOps.slice(i, i + chunkSize);
      const batch = writeBatch(db);

      for (const op of chunk) {
        const ref = doc(db, 'workspaces', workspaceId, 'orders', op.id);
        const cleanPayload = {
          customerId: op.customerId,
          customerName: (op.data.customerName || 'Khách hàng').trim().slice(0, CRM_LIMITS.FULL_NAME_MAX),
          customerPhone: (op.data.customerPhone || '').trim().slice(0, CRM_LIMITS.PHONE_MAX),
          orderCode: (op.data.orderCode || 'DH-001').trim().slice(0, CRM_LIMITS.ORDER_CODE_MAX),
          address: (op.data.address || '').trim().slice(0, CRM_LIMITS.ADDRESS_MAX),
          googleMapsUrl: (op.data.googleMapsUrl || '').trim().slice(0, CRM_LIMITS.MAPS_URL_MAX),
          soldAt: (op.data.soldAt || getTodayDateString()).trim().slice(0, CRM_LIMITS.SOLD_AT_MAX),
          note: (op.data.note || '').trim().slice(0, CRM_LIMITS.ORDER_NOTE_MAX),
          machineCount: Math.min(
            CRM_LIMITS.MACHINE_COUNT_MAX,
            Math.max(1, Math.floor(Number(op.data.machineCount) || 1))
          ),
        };
        if (op.type === 'update') {
          batch.update(ref, {
            ...cleanPayload,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(ref, {
            id: op.id,
            workspaceId,
            ownerId,
            ...cleanPayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        ordersRestored += 1;
      }

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `workspaces/${workspaceId}/orders`);
      }
    }
  }

  return { created, updated, skipped, ordersRestored };
}
