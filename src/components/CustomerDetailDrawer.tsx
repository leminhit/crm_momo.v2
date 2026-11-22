import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Building2,
  CalendarClock,
  Copy,
  Edit3,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { ConfirmModal } from './ConfirmModal';
import { StatusBadge } from './StatusBadge';
import { Button } from './ui/button';
import { SelectField } from './ui/select-field';
import { Skeleton } from './ui/skeleton';
import { SlideDrawer } from './ui/modal';
import { Textarea } from './ui/textarea';
import { useCrm } from '../contexts/CrmContext';
import {
  addCustomerNote,
  deleteCustomer,
  deleteCustomerNote,
  mapNoteDoc,
  toggleCustomerStar,
  updateCustomerStatus,
} from '../lib/crm-service';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  formatDateShort,
  getCustomerMachineCount,
  getCustomerSaleDate,
} from '../lib/payroll';
import {
  formatCurrencyVnd,
  getInitials,
  getMapsHref,
  getZaloUrl,
  normalizePhoneForDial,
} from '../lib/utils';
import { CRM_LIMITS } from '../lib/validators';
import {
  CUSTOMER_PRIORITY_META,
  CUSTOMER_STATUS_META,
  NOTE_TYPE_META,
  type CustomerNoteRecord,
  type CustomerRecord,
  type CustomerStatus,
  type NoteInteractionType,
} from '../types/crm';

interface CustomerDetailDrawerProps {
  customer: CustomerRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (customer: CustomerRecord) => void;
}

export function CustomerDetailDrawer({
  customer,
  open,
  onOpenChange,
  onEdit,
}: CustomerDetailDrawerProps) {
  const { user, profile, workspace } = useCrm();
  const [notes, setNotes] = useState<CustomerNoteRecord[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteType, setNoteType] = useState<NoteInteractionType>('note');
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(false);

  useEffect(() => {
    if (!open || !customer || !user || !workspace) {
      setNotes([]);
      return;
    }

    setLoadingNotes(true);
    const notesPath = `workspaces/${workspace.id}/customers/${customer.id}/notes`;
    const q = query(
      collection(db, 'workspaces', workspace.id, 'customers', customer.id, 'notes'),
      where('authorId', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => mapNoteDoc(d.id, d.data()));
        list.sort((a, b) => {
          const ta = a.createdAt ? a.createdAt.getTime() : 0;
          const tb = b.createdAt ? b.createdAt.getTime() : 0;
          return tb - ta;
        });
        setNotes(list);
        setLoadingNotes(false);
      },
      (error) => {
        setLoadingNotes(false);
        handleFirestoreError(error, OperationType.LIST, notesPath);
      }
    );

    return () => unsub();
  }, [open, customer, user, workspace]);

  if (!customer) return null;

  const primaryPhone =
    customer.phones.find((p) => p.isPrimary) ?? customer.phones[0];
  const primaryZaloUrl = primaryPhone ? getZaloUrl(primaryPhone.number) : '';
  const primaryDial = primaryPhone ? normalizePhoneForDial(primaryPhone.number) : '';
  const mapsHref = getMapsHref(customer.googleMapsUrl, customer.address);

  const handleCopyPhone = async (num: string) => {
    try {
      await navigator.clipboard.writeText(num);
      toast.success(`Đã sao chép ${num}`);
    } catch {
      toast.error('Không thể sao chép số điện thoại.');
    }
  };

  const handleStatusChange = async (nextStatus: CustomerStatus) => {
    if (!workspace) return;
    try {
      await updateCustomerStatus(workspace.id, customer.id, nextStatus, customer);
      toast.success(`Đã chuyển trạng thái sang ${CUSTOMER_STATUS_META[nextStatus].label}`);
    } catch {
      toast.error('Không thể cập nhật trạng thái.');
    }
  };

  const handleToggleStar = async () => {
    if (!workspace) return;
    try {
      await toggleCustomerStar(workspace.id, customer.id, !customer.isStarred);
    } catch {
      toast.error('Không thể cập nhật đánh dấu sao.');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !workspace) return;
    const trimmed = noteContent.trim();
    if (!trimmed) {
      toast.error('Vui lòng nhập nội dung ghi chú.');
      return;
    }

    setSavingNote(true);
    try {
      await addCustomerNote(
        workspace.id,
        customer.id,
        user.uid,
        profile?.displayName || user.displayName || 'Tôi',
        noteType,
        trimmed
      );
      setNoteContent('');
      toast.success('Đã lưu ghi chú tương tác');
    } catch {
      toast.error('Không thể lưu ghi chú.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!workspace) return;
    try {
      await deleteCustomerNote(workspace.id, customer.id, noteId);
      toast.success('Đã xóa ghi chú');
    } catch {
      toast.error('Không thể xóa ghi chú.');
    }
  };

  const handleConfirmDeleteCustomer = async () => {
    if (!workspace || !user) return;
    setDeletingCustomer(true);
    try {
      await deleteCustomer(workspace.id, customer.id, user.uid);
      toast.success(`Đã xóa khách hàng ${customer.fullName}`);
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    } catch {
      toast.error('Không thể xóa khách hàng.');
    } finally {
      setDeletingCustomer(false);
    }
  };

  return (
    <>
      <SlideDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={customer.fullName}
        subtitle={
          [customer.position, customer.company].filter(Boolean).join(' · ') ||
          'Khách hàng cá nhân'
        }
        headerActions={
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleToggleStar}
              aria-label="Đánh dấu sao"
            >
              <Star
                className={`h-4 w-4 ${
                  customer.isStarred
                    ? 'fill-amber-400 text-amber-500'
                    : 'text-muted-foreground'
                }`}
              />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 sm:h-9 px-3"
              onClick={() => {
                onOpenChange(false);
                onEdit(customer);
              }}
            >
              <Edit3 className="h-3.5 w-3.5" />
              Sửa
            </Button>
          </>
        }
      >
        <div className="space-y-6 pb-4">
          {/* Quick One-Tap Action Bar */}
          <div className="grid grid-cols-3 gap-2.5">
            {primaryDial ? (
              <a
                href={`tel:${primaryDial}`}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-muted/50 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Phone className="h-4 w-4 text-primary" />
                <span>Gọi ngay</span>
              </a>
            ) : (
              <div />
            )}

            {primaryZaloUrl ? (
              <a
                href={primaryZaloUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Mở Zalo</span>
              </a>
            ) : (
              <div />
            )}

            {mapsHref ? (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-muted/50 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Bản đồ</span>
              </a>
            ) : (
              <div className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>Chưa có vị trí</span>
              </div>
            )}
          </div>

          {/* Pipeline Status & Metrics */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary font-semibold text-sm">
                  {getInitials(customer.fullName)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={customer.status} />
                    <span className="text-xs text-muted-foreground">·</span>
                    <span
                      className={`text-xs ${CUSTOMER_PRIORITY_META[customer.priority].textClass}`}
                    >
                      Ưu tiên {CUSTOMER_PRIORITY_META[customer.priority].label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    Giá trị dự kiến:{' '}
                    <span className="font-mono font-medium text-foreground">
                      {formatCurrencyVnd(customer.estimatedValue)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-44">
                <SelectField
                  value={customer.status}
                  onChange={(e) => handleStatusChange(e.target.value as CustomerStatus)}
                  aria-label="Đổi trạng thái khách hàng"
                >
                  {Object.entries(CUSTOMER_STATUS_META).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1 border-t border-border">
              {customer.status === 'won' && (() => {
                const saleInfo = getCustomerSaleDate(customer);
                const machines = getCustomerMachineCount(customer);
                return (
                  <span className="font-medium text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {machines} loa · Ngày bán: {formatDateShort(saleInfo.dateStr)}
                    {saleInfo.isFallback ? ' (tạm tính)' : ''}
                  </span>
                );
              })()}
              {customer.source && <span>Nguồn: {customer.source}</span>}
              {customer.nextFollowUpAt && (
                <span className="inline-flex items-center gap-1 text-foreground font-medium">
                  <CalendarClock className="h-3.5 w-3.5 text-primary" />
                  Hẹn chăm sóc: {customer.nextFollowUpAt}
                </span>
              )}
              {customer.tags.length > 0 && (
                <span>Thẻ: {customer.tags.join(' · ')}</span>
              )}
            </div>
          </div>

          {/* All Phone Numbers */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Danh sách số điện thoại ({customer.phones.length})
            </h3>
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {customer.phones.map((phone, idx) => {
                const dial = normalizePhoneForDial(phone.number);
                const zalo = getZaloUrl(phone.number);
                return (
                  <div
                    key={`${phone.number}-${idx}`}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium text-foreground tabular-nums">
                        {phone.number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {phone.label || 'Di động'}
                        {phone.isPrimary ? ' · Số chính' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleCopyPhone(phone.number)}
                        title="Sao chép số"
                        aria-label="Sao chép số"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {dial && (
                        <Button asChild variant="ghost" size="icon-sm" title="Gọi">
                          <a href={`tel:${dial}`} aria-label={`Gọi ${phone.number}`}>
                            <Phone className="h-3.5 w-3.5 text-primary" />
                          </a>
                        </Button>
                      )}
                      {phone.hasZalo && zalo && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-xs text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-900"
                        >
                          <a href={zalo} target="_blank" rel="noopener noreferrer">
                            Zalo
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contact & Location Details */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Thông tin chi tiết
            </h3>
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5 text-sm">
              {customer.company && (
                <div className="flex items-start gap-2.5">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span>
                    {customer.company}
                    {customer.position ? ` — ${customer.position}` : ''}
                  </span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-start gap-2.5">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <a
                    href={`mailto:${customer.email}`}
                    className="text-primary hover:underline break-all"
                  >
                    {customer.email}
                  </a>
                </div>
              )}
              {(customer.address || customer.googleMapsUrl) && (
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-foreground break-words">
                      {customer.address || customer.googleMapsUrl}
                    </span>
                  </div>
                  {mapsHref && (
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
                    >
                      <span>Maps</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
              {customer.quickNote && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Ghi chú hồ sơ
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {customer.quickNote}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Interaction Notes Timeline */}
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nhật ký tương tác & Ghi chú
            </h3>

            <form onSubmit={handleAddNote} className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <SelectField
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value as NoteInteractionType)}
                  wrapperClassName="w-36 shrink-0"
                >
                  {Object.entries(NOTE_TYPE_META).map(([k, m]) => (
                    <option key={k} value={k}>
                      {m.label}
                    </option>
                  ))}
                </SelectField>
                <span className="text-xs text-muted-foreground">
                  Lưu lịch sử chăm sóc theo thời gian thực
                </span>
              </div>
              <Textarea
                rows={1}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Nhập nội dung cuộc gọi, trao đổi Zalo, báo giá..."
                maxLength={CRM_LIMITS.NOTE_CONTENT_MAX}
                className="min-h-[44px] sm:min-h-[76px] py-2.5"
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={savingNote} className="h-10 sm:h-9">
                  <Plus className="h-3.5 w-3.5" />
                  {savingNote ? 'Đang lưu...' : 'Thêm nhật ký'}
                </Button>
              </div>
            </form>

            {loadingNotes ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : notes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-xl">
                Chưa có nhật ký tương tác nào cho khách hàng này.
              </p>
            ) : (
              <div className="space-y-2">
                {notes.map((n) => (
                  <div
                    key={n.id}
                    className="group rounded-xl border border-border bg-card p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">
                          {NOTE_TYPE_META[n.type]?.label ?? 'Ghi chú'}
                        </span>
                        <span>·</span>
                        <span className="tabular-nums">
                          {n.createdAt
                            ? format(n.createdAt, 'dd/MM/yyyy HH:mm', { locale: vi })
                            : 'Vừa xong'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(n.id)}
                        className="opacity-70 hover:opacity-100 text-muted-foreground hover:text-destructive transition-colors p-1 cursor-pointer"
                        aria-label="Xóa ghi chú"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {n.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className="border-t border-border pt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Cập nhật:{' '}
              {customer.updatedAt
                ? format(customer.updatedAt, 'dd/MM/yyyy HH:mm')
                : '—'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Xóa khách hàng
            </Button>
          </div>
        </div>
      </SlideDrawer>

      <ConfirmModal
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Xóa khách hàng?"
        description={`Hồ sơ "${customer.fullName}" cùng toàn bộ nhật ký tương tác sẽ bị xóa vĩnh viễn khỏi Cloud Firestore.`}
        confirmLabel="Xóa vĩnh viễn"
        destructive
        loading={deletingCustomer}
        onConfirm={handleConfirmDeleteCustomer}
      />
    </>
  );
}
