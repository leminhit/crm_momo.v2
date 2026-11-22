import type { Timestamp } from 'firebase/firestore';

export type CustomerStatus =
  | 'lead'
  | 'contacted'
  | 'negotiating'
  | 'won'
  | 'care'
  | 'lost';

export type CustomerPriority = 'low' | 'medium' | 'high';

export type NoteInteractionType = 'note' | 'call' | 'zalo' | 'meeting' | 'visit';

export interface PhoneEntry {
  number: string;
  label: string;
  isPrimary: boolean;
  hasZalo: boolean;
}

export interface CustomerRecord {
  id: string;
  workspaceId: string;
  ownerId: string;
  assignedTo: string;
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
  soldAt: string;
  machineCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CustomerFirestoreDoc {
  id: string;
  workspaceId: string;
  ownerId: string;
  assignedTo: string;
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OrderRecord {
  id: string;
  workspaceId: string;
  ownerId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  orderCode: string;
  address: string;
  googleMapsUrl: string;
  soldAt: string;
  note: string;
  machineCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface OrderFirestoreDoc {
  id: string;
  workspaceId: string;
  ownerId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  orderCode: string;
  address: string;
  googleMapsUrl: string;
  soldAt: string;
  note: string;
  machineCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CustomerNoteRecord {
  id: string;
  workspaceId: string;
  customerId: string;
  authorId: string;
  authorName: string;
  type: NoteInteractionType;
  content: string;
  createdAt: Date | null;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  ownerId: string;
  mode: 'personal' | 'team';
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface UserProfileRecord {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  defaultWorkspaceId: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export const CUSTOMER_STATUS_META: Record<
  CustomerStatus,
  {
    label: string;
    shortLabel: string;
    description: string;
    dotColor: string;
    badgeClass: string;
  }
> = {
  lead: {
    label: 'Tiềm năng',
    shortLabel: 'Tiềm năng',
    description: 'Khách hàng mới tiếp cận hoặc vừa thu thập thông tin',
    dotColor: 'bg-sky-600 dark:bg-sky-400',
    badgeClass: 'text-sky-700 bg-sky-500/10 dark:text-sky-300 dark:bg-sky-500/15',
  },
  contacted: {
    label: 'Đã liên hệ',
    shortLabel: 'Đã liên hệ',
    description: 'Đã gọi điện, nhắn Zalo hoặc gửi báo giá sơ bộ',
    dotColor: 'bg-indigo-600 dark:bg-indigo-400',
    badgeClass: 'text-indigo-700 bg-indigo-500/10 dark:text-indigo-300 dark:bg-indigo-500/15',
  },
  negotiating: {
    label: 'Đang thương lượng',
    shortLabel: 'Thương lượng',
    description: 'Đang trao đổi chi tiết, chốt điều khoản hoặc hợp đồng',
    dotColor: 'bg-amber-600 dark:bg-amber-400',
    badgeClass: 'text-amber-700 bg-amber-500/10 dark:text-amber-300 dark:bg-amber-500/15',
  },
  won: {
    label: 'Đã bán',
    shortLabel: 'Đã bán',
    description: 'Đã chốt đơn hoặc hoàn tất giao dịch',
    dotColor: 'bg-emerald-600 dark:bg-emerald-400',
    badgeClass: 'text-emerald-700 bg-emerald-500/10 dark:text-emerald-300 dark:bg-emerald-500/15',
  },
  care: {
    label: 'Chăm sóc sau',
    shortLabel: 'Chăm sóc sau',
    description: 'Khách cần theo dõi, tư vấn thêm hoặc chăm sóc định kỳ',
    dotColor: 'bg-teal-600 dark:bg-teal-400',
    badgeClass: 'text-teal-700 bg-teal-500/10 dark:text-teal-300 dark:bg-teal-500/15',
  },
  lost: {
    label: 'Ngưng theo dõi',
    shortLabel: 'Ngưng',
    description: 'Chưa phù hợp nhu cầu hiện tại hoặc đã tạm dừng',
    dotColor: 'bg-slate-500 dark:bg-slate-400',
    badgeClass: 'text-slate-600 bg-slate-500/10 dark:text-slate-300 dark:bg-slate-500/15',
  },
};

export const CUSTOMER_PRIORITY_META: Record<
  CustomerPriority,
  { label: string; textClass: string }
> = {
  high: { label: 'Cao', textClass: 'text-rose-600 dark:text-rose-400 font-medium' },
  medium: { label: 'Trung bình', textClass: 'text-amber-600 dark:text-amber-400 font-medium' },
  low: { label: 'Thấp', textClass: 'text-muted-foreground' },
};

export const NOTE_TYPE_META: Record<
  NoteInteractionType,
  { label: string }
> = {
  note: { label: 'Ghi chú' },
  call: { label: 'Cuộc gọi' },
  zalo: { label: 'Nhắn Zalo' },
  meeting: { label: 'Gặp mặt' },
  visit: { label: 'Ghé tận nơi' },
};

export const DEFAULT_SOURCES = [
  'Zalo',
  'Giới thiệu',
  'Facebook',
  'Website',
  'Gọi trực tiếp',
  'Đi thị trường',
  'Khác',
];

export const PHONE_LABEL_OPTIONS = [
  'Di động',
  'Zalo',
  'Công việc',
  'Hotline',
  'Nhà riêng',
  'Khác',
];
