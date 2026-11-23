import { useMemo, useState } from 'react';
import {
  Edit3,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmModal } from '../components/ConfirmModal';
import { OrderFormModal } from '../components/OrderFormModal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { useCrm } from '../contexts/CrmContext';
import {
  backfillOrdersFromWonCustomers,
  deleteOrder,
  getSkippedBackfillCustomerIds,
  getUnsyncedWonCustomers,
  markCustomerSkippedFromBackfill,
} from '../lib/crm-service';
import {
  formatDateShort,
  formatMonthLabel,
  getOrderMachineCount,
  getOrderSaleDate,
} from '../lib/payroll';
import {
  getMapsHref,
  getZaloUrl,
  normalizePhoneForDial,
} from '../lib/utils';
import type { CustomerRecord, OrderRecord } from '../types/crm';

interface OrdersPageProps {
  onSelectCustomer: (customer: CustomerRecord) => void;
}

export function OrdersPage({ onSelectCustomer }: OrdersPageProps) {
  const { user, customers, orders, workspace, loadingData } = useCrm();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<OrderRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [syncingWonOrders, setSyncingWonOrders] = useState(false);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers]
  );

  const monthSummaries = useMemo(() => {
    const map = new Map<string, { orderCount: number; machineCount: number }>();
    for (const ord of orders) {
      const { monthKey } = getOrderSaleDate(ord);
      const machines = getOrderMachineCount(ord);
      const cur = map.get(monthKey);
      if (cur) {
        cur.orderCount += 1;
        cur.machineCount += machines;
      } else {
        map.set(monthKey, { orderCount: 1, machineCount: machines });
      }
    }
    return Array.from(map.entries())
      .map(([monthKey, counts]) => ({
        monthKey,
        label: formatMonthLabel(monthKey),
        ...counts,
      }))
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [orders]);

  const totalMachinesAll = useMemo(
    () => orders.reduce((s, o) => s + getOrderMachineCount(o), 0),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((ord) => {
      if (selectedMonth !== 'all' && getOrderSaleDate(ord).monthKey !== selectedMonth) {
        return false;
      }
      if (!q) return true;
      const cust = customerMap.get(ord.customerId);
      const customerName = (cust?.fullName || ord.customerName).toLowerCase();
      const customerPhone = (
        cust
          ? (cust.phones.find((p) => p.isPrimary) ?? cust.phones[0])?.number ?? ''
          : ord.customerPhone
      ).toLowerCase();
      return (
        ord.orderCode.toLowerCase().includes(q) ||
        customerName.includes(q) ||
        customerPhone.includes(q) ||
        ord.address.toLowerCase().includes(q) ||
        ord.note.toLowerCase().includes(q)
      );
    });
  }, [orders, selectedMonth, searchQuery, customerMap]);

  const filteredMachinesTotal = useMemo(
    () => filteredOrders.reduce((s, o) => s + getOrderMachineCount(o), 0),
    [filteredOrders]
  );

  const groupedOrdersByMonth = useMemo(() => {
    const map = new Map<
      string,
      {
        monthKey: string;
        label: string;
        orders: OrderRecord[];
        orderCount: number;
        machineCount: number;
      }
    >();

    for (const ord of filteredOrders) {
      const { monthKey } = getOrderSaleDate(ord);
      const machines = getOrderMachineCount(ord);
      const existing = map.get(monthKey);
      if (existing) {
        existing.orders.push(ord);
        existing.orderCount += 1;
        existing.machineCount += machines;
      } else {
        map.set(monthKey, {
          monthKey,
          label: formatMonthLabel(monthKey),
          orders: [ord],
          orderCount: 1,
          machineCount: machines,
        });
      }
    }

    const groups = Array.from(map.values()).sort((a, b) =>
      b.monthKey.localeCompare(a.monthKey)
    );
    for (const group of groups) {
      group.orders.sort((a, b) => {
        const sa = getOrderSaleDate(a).dateStr;
        const sb = getOrderSaleDate(b).dateStr;
        if (sa !== sb) return sb.localeCompare(sa);
        const ta = a.createdAt ? a.createdAt.getTime() : 0;
        const tb = b.createdAt ? b.createdAt.getTime() : 0;
        return tb - ta;
      });
    }
    return groups;
  }, [filteredOrders]);

  const unsyncedWonCount = useMemo(() => {
    if (!workspace) return 0;
    return getUnsyncedWonCustomers(
      customers,
      orders,
      getSkippedBackfillCustomerIds(workspace.id)
    ).length;
  }, [workspace, customers, orders]);

  const handleOpenCreateOrder = () => {
    setEditingOrder(null);
    setOrderModalOpen(true);
  };

  const handleOpenEditOrder = (order: OrderRecord) => {
    setEditingOrder(order);
    setOrderModalOpen(true);
  };

  const handleSyncWonCustomers = async () => {
    if (!workspace || !user || unsyncedWonCount === 0) return;
    setSyncingWonOrders(true);
    try {
      const result = await backfillOrdersFromWonCustomers(
        workspace.id,
        user.uid,
        customers,
        orders,
        { skipCustomerIds: getSkippedBackfillCustomerIds(workspace.id) }
      );
      if (result.created > 0) {
        toast.success(
          `Đã tạo ${result.created} đơn hàng từ khách Đã bán và phân theo ${result.monthCount} tháng`
        );
      } else {
        toast.info('Tất cả khách Đã bán đều đã có đơn hàng.');
      }
    } catch {
      toast.error('Không thể đồng bộ đơn hàng từ khách Đã bán.');
    } finally {
      setSyncingWonOrders(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!workspace || !deletingOrder) return;
    setDeleteLoading(true);
    try {
      await deleteOrder(workspace.id, deletingOrder.id);
      if (deletingOrder.customerId) {
        markCustomerSkippedFromBackfill(workspace.id, deletingOrder.customerId);
      }
      toast.success(`Đã xóa đơn hàng ${deletingOrder.orderCode}`);
      setDeletingOrder(null);
    } catch {
      toast.error('Không thể xóa đơn hàng.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search, Filter & Exclusive Create Order Bar */}
      <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã đơn, tên khách hàng, SĐT, địa chỉ, ghi chú..."
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {unsyncedWonCount > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSyncWonCustomers}
                disabled={syncingWonOrders}
                className="h-11 sm:h-10 shrink-0 whitespace-nowrap"
              >
                {syncingWonOrders ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span>Đồng bộ {unsyncedWonCount} khách Đã bán</span>
              </Button>
            )}
            <Button
              type="button"
              onClick={handleOpenCreateOrder}
              className="h-11 sm:h-10 shrink-0 whitespace-nowrap flex-1 sm:flex-initial"
            >
              <Plus className="h-4 w-4" />
              <span>Tạo đơn</span>
            </Button>
          </div>
        </div>

        {/* Month Tabs */}
        {monthSummaries.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 border-t border-border">
            <button
              type="button"
              onClick={() => setSelectedMonth('all')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                selectedMonth === 'all'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Tất cả tháng</span>
              <span className="font-mono tabular-nums text-[11px] opacity-85">
                · {orders.length} đơn · {totalMachinesAll} loa
              </span>
            </button>
            {monthSummaries.map((m) => {
              const active = selectedMonth === m.monthKey;
              return (
                <button
                  key={m.monthKey}
                  type="button"
                  onClick={() => setSelectedMonth(m.monthKey)}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{m.label}</span>
                  <span className="font-mono tabular-nums text-[11px] opacity-85">
                    · {m.orderCount} đơn
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Summary Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border text-xs text-muted-foreground">
          <span className="tabular-nums">
            Hiển thị <strong className="text-foreground">{filteredOrders.length}</strong> /{' '}
            {orders.length} đơn hàng ({filteredMachinesTotal} loa)
          </span>
          {(searchQuery || selectedMonth !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedMonth('all');
              }}
              className="text-primary hover:underline font-medium cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Empty or Populated Order List */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 sm:p-10 text-center space-y-3">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {orders.length === 0
                ? 'Chưa có đơn hàng nào được tạo'
                : 'Không tìm thấy đơn hàng phù hợp'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Mỗi cửa hàng lắp đặt là 1 đơn hàng riêng. Khi bấm Tạo đơn và chọn khách hàng, hệ thống tự chuyển khách sang Đã bán và cộng loa vào bảng lương theo tháng bán.
            </p>
          </div>
          <Button type="button" size="sm" onClick={handleOpenCreateOrder}>
            <Plus className="h-4 w-4" />
            {orders.length === 0 ? 'Tạo đơn đầu tiên' : 'Tạo đơn mới'}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedOrdersByMonth.map((group) => (
            <section key={group.monthKey} className="space-y-3">
              {/* Monthly Section Header */}
              <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {group.label}
                </h2>
                <p className="text-xs font-mono tabular-nums text-muted-foreground">
                  {group.orderCount} đơn ·{' '}
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {group.machineCount} loa
                  </span>
                </p>
              </div>

              {/* Mobile Cards for this Month */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {group.orders.map((ord) => {
                  const cust = customerMap.get(ord.customerId) ?? null;
                  const displayName = cust?.fullName || ord.customerName;
                  const phone = cust
                    ? (cust.phones.find((p) => p.isPrimary) ?? cust.phones[0])?.number ?? ''
                    : ord.customerPhone;
                  const dial = phone ? normalizePhoneForDial(phone) : '';
                  const zalo = phone ? getZaloUrl(phone) : '';
                  const mapsHref = getMapsHref(ord.googleMapsUrl, ord.address);
                  const saleInfo = getOrderSaleDate(ord);
                  const machines = getOrderMachineCount(ord);

                  return (
                    <article
                      key={ord.id}
                      className="min-w-0 rounded-xl border border-border bg-card p-3.5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-mono tabular-nums text-muted-foreground">
                            <span className="font-semibold text-primary">
                              {ord.orderCode}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{formatDateShort(saleInfo.dateStr)}</span>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                              {machines} loa
                            </span>
                          </div>
                          {cust ? (
                            <button
                              type="button"
                              onClick={() => onSelectCustomer(cust)}
                              className="mt-1 text-left text-sm font-semibold text-foreground hover:text-primary transition-colors truncate block w-full cursor-pointer"
                            >
                              {displayName}
                            </button>
                          ) : (
                            <p className="mt-1 text-sm font-semibold text-foreground truncate">
                              {displayName}
                            </p>
                          )}
                          {phone && (
                            <p className="text-xs font-mono tabular-nums text-muted-foreground">
                              {phone}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleOpenEditOrder(ord)}
                            aria-label={`Sửa đơn ${ord.orderCode}`}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeletingOrder(ord)}
                            aria-label={`Xóa đơn ${ord.orderCode}`}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {(ord.address || ord.note) && (
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {ord.address && <p className="break-words">{ord.address}</p>}
                          {ord.note && (
                            <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                              {ord.note}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                        {dial ? (
                          <a
                            href={`tel:${dial}`}
                            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/40 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                          >
                            <Phone className="h-3.5 w-3.5 text-primary" />
                            <span>Gọi</span>
                          </a>
                        ) : (
                          <span className="flex min-h-[44px] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                            —
                          </span>
                        )}

                        {zalo ? (
                          <a
                            href={zalo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-sky-600/10 text-xs font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-600/20 transition-colors"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>Zalo</span>
                          </a>
                        ) : (
                          <span className="flex min-h-[44px] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                            —
                          </span>
                        )}

                        {mapsHref ? (
                          <a
                            href={mapsHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/40 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                          >
                            <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Maps</span>
                          </a>
                        ) : (
                          <span className="flex min-h-[44px] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Desktop Table for this Month */}
              <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 whitespace-nowrap">Mã đơn</th>
                        <th className="px-4 py-3 whitespace-nowrap">Ngày bán</th>
                        <th className="px-4 py-3 whitespace-nowrap">Khách hàng</th>
                        <th className="px-4 py-3 whitespace-nowrap">Địa chỉ &amp; Định vị</th>
                        <th className="px-4 py-3 whitespace-nowrap">Ghi chú đơn</th>
                        <th className="px-4 py-3 whitespace-nowrap text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {group.orders.map((ord) => {
                        const cust = customerMap.get(ord.customerId) ?? null;
                        const displayName = cust?.fullName || ord.customerName;
                        const phone = cust
                          ? (cust.phones.find((p) => p.isPrimary) ?? cust.phones[0])?.number ?? ''
                          : ord.customerPhone;
                        const dial = phone ? normalizePhoneForDial(phone) : '';
                        const zalo = phone ? getZaloUrl(phone) : '';
                        const mapsHref = getMapsHref(ord.googleMapsUrl, ord.address);
                        const saleInfo = getOrderSaleDate(ord);
                        const machines = getOrderMachineCount(ord);

                        return (
                          <tr key={ord.id} className="hover:bg-muted/35 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="font-mono text-xs font-semibold text-primary tabular-nums">
                                {ord.orderCode}
                              </p>
                              <p className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 tabular-nums">
                                {machines} loa
                              </p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                              {formatDateShort(saleInfo.dateStr)}
                            </td>
                            <td className="px-4 py-3 min-w-[200px]">
                              {cust ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectCustomer(cust)}
                                  className="text-left group cursor-pointer"
                                >
                                  <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                                    {displayName}
                                  </p>
                                </button>
                              ) : (
                                <p className="font-medium text-foreground">{displayName}</p>
                              )}
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                  {phone || '—'}
                                </span>
                                {dial && (
                                  <a
                                    href={`tel:${dial}`}
                                    title={`Gọi ${phone}`}
                                    className="text-primary hover:underline text-xs"
                                  >
                                    Gọi
                                  </a>
                                )}
                                {zalo && (
                                  <a
                                    href={zalo}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sky-600 dark:text-sky-400 hover:underline text-xs"
                                  >
                                    Zalo
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 max-w-[240px]">
                              {mapsHref ? (
                                <a
                                  href={mapsHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline truncate max-w-full"
                                  title={ord.address || ord.googleMapsUrl}
                                >
                                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">
                                    {ord.address || 'Mở Google Maps'}
                                  </span>
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {ord.address || '—'}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 max-w-[240px]">
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {ord.note || '—'}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleOpenEditOrder(ord)}
                                  title="Chỉnh sửa đơn hàng"
                                  aria-label={`Sửa ${ord.orderCode}`}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => setDeletingOrder(ord)}
                                  title="Xóa đơn hàng"
                                  aria-label={`Xóa ${ord.orderCode}`}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Create / Edit Order Modal (exclusively inside Orders tab) */}
      <OrderFormModal
        open={orderModalOpen}
        onOpenChange={setOrderModalOpen}
        editingOrder={editingOrder}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        open={Boolean(deletingOrder)}
        onOpenChange={(open) => {
          if (!open) setDeletingOrder(null);
        }}
        title="Xóa đơn hàng?"
        description={`Đơn hàng "${deletingOrder?.orderCode ?? ''}" của "${deletingOrder?.customerName ?? ''}" sẽ bị xóa khỏi hệ thống và bảng lương tháng tương ứng.`}
        confirmLabel="Xóa đơn hàng"
        destructive
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
