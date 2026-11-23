import { useEffect, useMemo, useState } from 'react';
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  LayoutGrid,
  List as ListIcon,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmModal } from '../components/ConfirmModal';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { SelectField } from '../components/ui/select-field';
import { Skeleton } from '../components/ui/skeleton';
import { useCrm } from '../contexts/CrmContext';
import {
  bulkDeleteCustomers,
  bulkUpdateCustomerStatus,
  toggleCustomerStar,
  updateCustomerStatus,
} from '../lib/crm-service';
import { exportCustomersToExcel } from '../lib/excel';
import {
  compareCustomersByCreatedDate,
  formatDateShort,
  getCustomerCreatedDate,
  groupWonCustomersByMonth,
} from '../lib/payroll';
import {
  formatCurrencyVnd,
  getInitials,
  getMapsHref,
  getZaloUrl,
  normalizePhoneForDial,
} from '../lib/utils';
import {
  CUSTOMER_PRIORITY_META,
  CUSTOMER_STATUS_META,
  type CustomerPriority,
  type CustomerRecord,
  type CustomerStatus,
} from '../types/crm';

interface CustomersPageProps {
  onAddCustomer: () => void;
  onEditCustomer: (customer: CustomerRecord) => void;
  onSelectCustomer: (customer: CustomerRecord) => void;
}

const features = tableFeatures({
  rowSelectionFeature,
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
  },
});

const columnHelper = createColumnHelper<typeof features, CustomerRecord>();

export function CustomersPage({
  onAddCustomer,
  onEditCustomer,
  onSelectCustomer,
}: CustomersPageProps) {
  const { user, workspace, customers, orders, loadingData } = useCrm();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [saleTab, setSaleTab] = useState<'push' | 'won' | 'lost'>(() => {
    const param = searchParams.get('status');
    if (param === 'won') return 'won';
    if (param === 'lost') return 'lost';
    return 'push';
  });
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const param = searchParams.get('status');
    return param && param !== 'won' && param !== 'lost' ? param : 'all';
  });
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [starredOnly, setStarredOnly] = useState(false);
  const [selectedWonMonth, setSelectedWonMonth] = useState<string>('all');
  const [createdSortDir, setCreatedSortDir] = useState<'desc' | 'asc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  });
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    const paramStatus = searchParams.get('status');
    if (paramStatus === 'won') {
      setSaleTab('won');
      setStatusFilter('all');
    } else if (paramStatus === 'lost') {
      setSaleTab('lost');
      setStatusFilter('all');
    } else if (paramStatus) {
      setSaleTab('push');
      setStatusFilter(paramStatus);
    } else {
      setSaleTab('push');
      setStatusFilter('all');
    }
  }, [searchParams]);

  const handleSaleTabChange = (nextTab: 'push' | 'won' | 'lost') => {
    setSaleTab(nextTab);
    setStatusFilter('all');
    setSelectedWonMonth('all');
    setRowSelection({});
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    if (nextTab === 'won') {
      setSearchParams({ status: 'won' }, { replace: true });
    } else if (nextTab === 'lost') {
      setSearchParams({ status: 'lost' }, { replace: true });
    } else {
      searchParams.delete('status');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    if (val === 'all') {
      searchParams.delete('status');
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ status: val }, { replace: true });
    }
  };

  const wonMonthGroupsAll = useMemo(
    () => groupWonCustomersByMonth(customers, orders),
    [customers, orders]
  );

  const customerWonMonthsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const group of wonMonthGroupsAll) {
      for (const entry of group.entries) {
        let months = map.get(entry.customer.id);
        if (!months) {
          months = new Set<string>();
          map.set(entry.customer.id, months);
        }
        months.add(group.monthKey);
      }
    }
    return map;
  }, [wonMonthGroupsAll]);

  const ordersByCustomerId = useMemo(() => {
    const map = new Map<string, typeof orders>();
    for (const order of orders) {
      const list = map.get(order.customerId);
      if (list) {
        list.push(order);
      } else {
        map.set(order.customerId, [order]);
      }
    }
    return map;
  }, [orders]);

  const pushCount = useMemo(
    () =>
      customers.filter(
        (c) =>
          c.status !== 'won' &&
          c.status !== 'lost' &&
          !customerWonMonthsMap.has(c.id)
      ).length,
    [customers, customerWonMonthsMap]
  );
  const wonCount = customerWonMonthsMap.size;
  const lostCount = useMemo(
    () =>
      customers.filter(
        (c) => c.status === 'lost' && !customerWonMonthsMap.has(c.id)
      ).length,
    [customers, customerWonMonthsMap]
  );

  const totalWonMachinesAll = useMemo(
    () => wonMonthGroupsAll.reduce((sum, g) => sum + g.totalMachines, 0),
    [wonMonthGroupsAll]
  );

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = customers.filter((c) => {
      if (saleTab === 'won') {
        const months = customerWonMonthsMap.get(c.id);
        if (!months || months.size === 0) return false;
        if (selectedWonMonth !== 'all' && !months.has(selectedWonMonth)) {
          return false;
        }
      } else if (saleTab === 'lost') {
        if (c.status !== 'lost' || customerWonMonthsMap.has(c.id)) return false;
      } else {
        if (c.status === 'won' || c.status === 'lost' || customerWonMonthsMap.has(c.id)) {
          return false;
        }
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      }

      if (priorityFilter !== 'all' && c.priority !== priorityFilter) return false;
      if (starredOnly && !c.isStarred) return false;

      if (!q) return true;

      const phoneMatch = c.phones.some((p) =>
        p.number.toLowerCase().includes(q)
      );
      const tagMatch = c.tags.some((t) => t.toLowerCase().includes(q));
      const orderMatch = (ordersByCustomerId.get(c.id) ?? []).some(
        (o) =>
          o.orderCode.toLowerCase().includes(q) ||
          o.address.toLowerCase().includes(q) ||
          o.note.toLowerCase().includes(q)
      );
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.quickNote.toLowerCase().includes(q) ||
        phoneMatch ||
        tagMatch ||
        orderMatch
      );
    });
    list.sort((a, b) => compareCustomersByCreatedDate(a, b, createdSortDir));
    return list;
  }, [
    customers,
    customerWonMonthsMap,
    ordersByCustomerId,
    saleTab,
    selectedWonMonth,
    searchQuery,
    statusFilter,
    priorityFilter,
    starredOnly,
    createdSortDir,
  ]);

  const filteredWonGroups = useMemo(() => {
    if (saleTab !== 'won') return [];
    const groups = groupWonCustomersByMonth(filteredCustomers, orders);
    if (selectedWonMonth === 'all') return groups;
    return groups.filter((g) => g.monthKey === selectedWonMonth);
  }, [saleTab, filteredCustomers, orders, selectedWonMonth]);

  const filteredWonOrdersCount = useMemo(
    () => filteredWonGroups.reduce((sum, g) => sum + g.orderCount, 0),
    [filteredWonGroups]
  );

  const filteredWonMachinesCount = useMemo(
    () => filteredWonGroups.reduce((sum, g) => sum + g.totalMachines, 0),
    [filteredWonGroups]
  );

  const handleToggleStar = async (customer: CustomerRecord) => {
    if (!workspace) return;
    try {
      await toggleCustomerStar(workspace.id, customer.id, !customer.isStarred);
    } catch {
      toast.error('Không thể cập nhật đánh dấu sao.');
    }
  };

  const handleRestoreToCare = async (customer: CustomerRecord) => {
    if (!workspace) return;
    try {
      await updateCustomerStatus(workspace.id, customer.id, 'care');
      toast.success(`Đã chuyển "${customer.fullName}" sang Chăm sóc sau`);
    } catch {
      toast.error('Không thể cập nhật trạng thái khách hàng.');
    }
  };

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            aria-label="Chọn tất cả trang này"
            className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            aria-label={`Chọn ${row.original.fullName}`}
            className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
          />
        ),
      }),
      columnHelper.accessor('fullName', {
        header: 'Khách hàng',
        cell: (info) => {
          const c = info.row.original;
          return (
            <div className="flex items-center gap-2.5 min-w-[200px]">
              <button
                type="button"
                onClick={() => handleToggleStar(c)}
                aria-label="Đánh dấu sao"
                className="text-muted-foreground hover:text-amber-500 transition-colors cursor-pointer shrink-0"
              >
                <Star
                  className={`h-4 w-4 ${
                    c.isStarred ? 'fill-amber-400 text-amber-500' : ''
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => onSelectCustomer(c)}
                className="text-left min-w-0 cursor-pointer group"
              >
                <p className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                  {c.fullName}
                </p>
                {(c.company || c.position) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.position, c.company].filter(Boolean).join(' · ')}
                  </p>
                )}
              </button>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'phones',
        header: 'Số điện thoại & Zalo',
        cell: (info) => {
          const c = info.row.original;
          const primary = c.phones.find((p) => p.isPrimary) ?? c.phones[0];
          const extra = c.phones.length - 1;
          const dial = primary ? normalizePhoneForDial(primary.number) : '';
          const zalo = primary ? getZaloUrl(primary.number) : '';
          return (
            <div className="flex items-center gap-2 min-w-[180px]">
              <div className="min-w-0">
                <p className="font-mono text-xs font-medium text-foreground tabular-nums">
                  {primary?.number || '—'}
                </p>
                {extra > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    +{extra} số khác
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {dial && (
                  <a
                    href={`tel:${dial}`}
                    title={`Gọi ${primary?.number}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-primary hover:bg-muted transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                )}
                {primary?.hasZalo && zalo && (
                  <a
                    href={zalo}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Mở Zalo"
                    className="flex h-7 items-center justify-center rounded-md border border-sky-200 dark:border-sky-900 bg-sky-500/10 px-2 text-[11px] font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 transition-colors"
                  >
                    Zalo
                  </a>
                )}
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor('status', {
        header: 'Trạng thái',
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor('priority', {
        header: 'Ưu tiên',
        cell: (info) => {
          const p = info.getValue() as CustomerPriority;
          return (
            <span className={`text-xs ${CUSTOMER_PRIORITY_META[p]?.textClass}`}>
              {CUSTOMER_PRIORITY_META[p]?.label ?? p}
            </span>
          );
        },
      }),
      columnHelper.accessor('estimatedValue', {
        header: () => <div className="text-right">Giá trị dự kiến</div>,
        cell: (info) => (
          <div className="text-right font-mono text-xs tabular-nums text-foreground">
            {info.getValue() > 0 ? formatCurrencyVnd(info.getValue()) : '—'}
          </div>
        ),
      }),
      columnHelper.display({
        id: 'location',
        header: 'Vị trí',
        cell: (info) => {
          const c = info.row.original;
          const href = getMapsHref(c.googleMapsUrl, c.address);
          if (!c.address && !href) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <div className="flex items-center gap-1.5 max-w-[200px]">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline truncate"
                  title={c.address || c.googleMapsUrl}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{c.address || 'Mở Google Maps'}</span>
                </a>
              ) : (
                <span className="text-xs text-muted-foreground truncate">
                  {c.address}
                </span>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('nextFollowUpAt', {
        header: 'Hẹn chăm sóc',
        cell: (info) => (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {info.getValue() || '—'}
          </span>
        ),
      }),
      columnHelper.accessor((row) => getCustomerCreatedDate(row), {
        id: 'createdDate',
        header: 'Ngày tạo',
        cell: (info) => (
          <span className="font-mono text-xs tabular-nums text-muted-foreground whitespace-nowrap">
            {formatDateShort(info.getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => {
          const c = info.row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              {c.status === 'lost' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRestoreToCare(c)}
                  title="Chuyển về Chăm sóc sau"
                  className="h-8 px-2 text-xs text-primary"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Chăm sóc lại</span>
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onEditCustomer(c)}
                title="Chỉnh sửa"
                aria-label={`Sửa ${c.fullName}`}
              >
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        },
      }),
    ]),
    [onEditCustomer, onSelectCustomer, workspace]
  );

  const table = useTable({
    features,
    data: filteredCustomers,
    columns,
    getRowId: (row) => row.id,
    state: {
      sorting,
      rowSelection,
      pagination,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
  });

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const selectedCustomers = useMemo(
    () => filteredCustomers.filter((c) => selectedIds.includes(c.id)),
    [filteredCustomers, selectedIds]
  );

  const handleBulkStatus = async (status: CustomerStatus) => {
    if (!workspace || !user || selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      const result = await bulkUpdateCustomerStatus(
        workspace.id,
        selectedIds,
        status,
        selectedCustomers,
        {
          ownerId: user.uid,
          existingOrders: orders,
        }
      );
      if (result.autoOrdersCreated > 0) {
        toast.success(
          `Đã chuyển ${selectedIds.length} khách sang "${CUSTOMER_STATUS_META[status].label}" & tự động tạo ${result.autoOrdersCreated} đơn hàng`
        );
      } else {
        toast.success(
          `Đã chuyển ${selectedIds.length} khách hàng sang "${CUSTOMER_STATUS_META[status].label}"`
        );
      }
      setRowSelection({});
    } catch {
      toast.error('Không thể cập nhật hàng loạt.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!workspace || !user || selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      await bulkDeleteCustomers(workspace.id, selectedIds, user.uid);
      toast.success(`Đã xóa ${selectedIds.length} khách hàng`);
      setRowSelection({});
      setBulkDeleteOpen(false);
    } catch {
      toast.error('Không thể xóa khách hàng đã chọn.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExportCurrent = async () => {
    const target =
      selectedCustomers.length > 0 ? selectedCustomers : filteredCustomers;
    if (target.length === 0) {
      toast.error('Không có dữ liệu để xuất Excel.');
      return;
    }
    try {
      await exportCustomersToExcel(target);
      toast.success(`Đã xuất ${target.length} khách hàng ra file Excel`);
    } catch {
      toast.error('Không thể xuất file Excel. Vui lòng thử lại.');
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    handleStatusFilterChange('all');
    setPriorityFilter('all');
    setStarredOnly(false);
    setSelectedWonMonth('all');
  };

  const tabTotal =
    saleTab === 'won' ? wonCount : saleTab === 'lost' ? lostCount : pushCount;

  const toggleSingleRowSelection = (id: string) => {
    setRowSelection((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = true;
      }
      return next;
    });
  };

  const toggleGroupSelection = (items: CustomerRecord[]) => {
    const allSelected = items.every((item) => Boolean(rowSelection[item.id]));
    setRowSelection((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (allSelected) {
          delete next[item.id];
        } else {
          next[item.id] = true;
        }
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Three-Tab Sales Segmentation: Cần push sale · Đã bán · Ngưng theo dõi */}
      <div
        role="tablist"
        aria-label="Phân loại khách hàng theo tiến trình bán hàng"
        className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/70 p-1 sm:inline-flex sm:w-auto"
      >
        <button
          type="button"
          role="tab"
          aria-selected={saleTab === 'push'}
          onClick={() => handleSaleTabChange('push')}
          className={`flex min-h-[44px] sm:min-h-[40px] items-center justify-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            saleTab === 'push'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="sm:hidden">Push sale</span>
          <span className="hidden sm:inline">Cần push sale</span>
          <span className="font-mono text-xs tabular-nums text-primary font-semibold">
            {pushCount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={saleTab === 'won'}
          onClick={() => handleSaleTabChange('won')}
          className={`flex min-h-[44px] sm:min-h-[40px] items-center justify-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            saleTab === 'won'
              ? 'bg-card text-emerald-700 dark:text-emerald-300 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>Đã bán</span>
          <span className="font-mono text-xs tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
            {wonCount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={saleTab === 'lost'}
          onClick={() => handleSaleTabChange('lost')}
          className={`flex min-h-[44px] sm:min-h-[40px] items-center justify-center gap-1.5 sm:gap-2 rounded-lg px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            saleTab === 'lost'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="sm:hidden">Ngưng</span>
          <span className="hidden sm:inline">Ngưng theo dõi</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground font-semibold">
            {lostCount}
          </span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                saleTab === 'won'
                  ? 'Tìm khách đã bán theo tên, SĐT, địa chỉ...'
                  : saleTab === 'lost'
                    ? 'Tìm khách ngưng theo dõi theo tên, SĐT...'
                    : 'Tìm tên, số điện thoại, công ty, địa chỉ, ghi chú...'
              }
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

          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            {saleTab === 'push' && (
              <SelectField
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                wrapperClassName="sm:w-44"
                aria-label="Lọc theo trạng thái"
              >
                <option value="all">Tất cả cần push</option>
                {Object.entries(CUSTOMER_STATUS_META)
                  .filter(([k]) => k !== 'won' && k !== 'lost')
                  .map(([k, m]) => (
                    <option key={k} value={k}>
                      {m.label}
                    </option>
                  ))}
              </SelectField>
            )}

            <SelectField
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              wrapperClassName={saleTab !== 'push' ? 'col-span-2 sm:w-36' : 'sm:w-36'}
              aria-label="Lọc theo ưu tiên"
            >
              <option value="all">Mọi ưu tiên</option>
              <option value="high">Ưu tiên cao</option>
              <option value="medium">Trung bình</option>
              <option value="low">Thấp</option>
            </SelectField>

            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => {
                setCreatedSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
                setSorting([]);
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
              }}
              className="col-span-2 sm:col-span-1 h-11 sm:h-10 gap-1.5 whitespace-nowrap"
              title="Đổi chiều sắp xếp theo ngày tạo khách hàng"
            >
              {createdSortDir === 'desc' ? (
                <ArrowDown className="h-3.5 w-3.5 text-primary" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5 text-primary" />
              )}
              <span>
                {createdSortDir === 'desc' ? 'Ngày tạo: Mới nhất' : 'Ngày tạo: Cũ nhất'}
              </span>
            </Button>

            <Button
              type="button"
              variant={starredOnly ? 'default' : 'outline'}
              size="default"
              onClick={() => setStarredOnly((v) => !v)}
              className="col-span-1 h-11 sm:h-10"
            >
              <Star className={`h-4 w-4 ${starredOnly ? 'fill-current' : ''}`} />
              <span>Gắn sao</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleExportCurrent}
              className="col-span-1 h-11 sm:h-10"
            >
              <Download className="h-4 w-4" />
              <span>Xuất Excel</span>
            </Button>
          </div>
        </div>

        {/* Monthly Quick Filter when in Đã bán Tab */}
        {saleTab === 'won' && wonMonthGroupsAll.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 border-t border-border">
            <button
              type="button"
              onClick={() => setSelectedWonMonth('all')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                selectedWonMonth === 'all'
                  ? 'border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500 dark:text-emerald-300'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Tất cả tháng</span>
              <span className="font-mono tabular-nums text-[11px] opacity-85">
                · {totalWonMachinesAll} loa
              </span>
            </button>
            {wonMonthGroupsAll.map((g) => {
              const active = selectedWonMonth === g.monthKey;
              return (
                <button
                  key={g.monthKey}
                  type="button"
                  onClick={() => setSelectedWonMonth(g.monthKey)}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500 dark:text-emerald-300'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{g.label}</span>
                  <span className="font-mono tabular-nums text-[11px] opacity-85">
                    · {g.totalMachines} loa
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Summary & Desktop View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular-nums">
              Hiển thị <strong className="text-foreground">{filteredCustomers.length}</strong> / {tabTotal}{' '}
              {saleTab === 'won'
                ? `khách đã bán (${filteredWonOrdersCount} đơn · ${filteredWonMachinesCount} loa)`
                : saleTab === 'lost'
                  ? 'khách ngưng theo dõi'
                  : 'khách cần push sale'}
            </span>
            {saleTab === 'won' && (
              <Link
                to="/orders"
                className="text-primary hover:underline font-medium"
              >
                Xem mục Đơn hàng →
              </Link>
            )}
            {saleTab === 'lost' && filteredCustomers.length > 0 && (
              <span className="hidden sm:inline text-muted-foreground">
                · Có thể bấm Chăm sóc lại nếu khách có nhu cầu trở lại
              </span>
            )}
            {(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || starredOnly || selectedWonMonth !== 'all') && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-primary hover:underline font-medium cursor-pointer"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>

          <div className="hidden md:flex items-center gap-1 rounded-lg bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ListIcon className="h-3.5 w-3.5" />
              Bảng
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Thẻ
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium text-foreground tabular-nums">
            Đã chọn {selectedIds.length} khách hàng
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <SelectField
              defaultValue=""
              disabled={bulkLoading}
              onChange={(e) => {
                if (e.target.value) {
                  void handleBulkStatus(e.target.value as CustomerStatus);
                  e.target.value = '';
                }
              }}
              wrapperClassName="w-full sm:w-44"
            >
              <option value="" disabled>
                Đổi trạng thái...
              </option>
              {Object.entries(CUSTOMER_STATUS_META).map(([k, m]) => (
                <option key={k} value={k}>
                  {m.label}
                </option>
              ))}
            </SelectField>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCurrent}
            >
              <Download className="h-3.5 w-3.5" />
              Xuất mục chọn
            </Button>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Xóa
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRowSelection({})}
            >
              Bỏ chọn
            </Button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loadingData ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Không tìm thấy khách hàng phù hợp
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Thử thay đổi từ khóa tìm kiếm, bộ lọc trạng thái hoặc thêm khách hàng mới.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || starredOnly || selectedWonMonth !== 'all') && (
              <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                Xóa bộ lọc
              </Button>
            )}
            <Button type="button" size="sm" onClick={onAddCustomer}>
              <Plus className="h-4 w-4" />
              Thêm khách hàng
            </Button>
          </div>
        </div>
      ) : saleTab === 'won' ? (
        <div className="space-y-6">
          {filteredWonGroups.map((group) => {
            const allGroupSelected =
              group.customers.length > 0 &&
              group.customers.every((c) => Boolean(rowSelection[c.id]));

            return (
              <section key={group.monthKey} className="space-y-3">
                {/* Monthly Header */}
                <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    {group.label}
                  </h2>
                  <p className="text-xs font-mono tabular-nums text-muted-foreground">
                    {group.customerCount} khách · {group.orderCount} đơn ·{' '}
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {group.totalMachines} loa
                    </span>
                  </p>
                </div>

                {/* Mobile & Card View for this Month */}
                <div
                  className={
                    viewMode === 'cards'
                      ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5'
                      : 'grid grid-cols-1 gap-3 md:hidden'
                  }
                >
                  {group.entries.map((entry) => {
                    const c = entry.customer;
                    const primary = c.phones.find((p) => p.isPrimary) ?? c.phones[0];
                    const dial = primary ? normalizePhoneForDial(primary.number) : '';
                    const zalo = primary ? getZaloUrl(primary.number) : '';
                    const monthPrimaryOrder = entry.monthOrders[0];
                    const displayAddress = monthPrimaryOrder?.address || c.address;
                    const displayMapsUrl =
                      monthPrimaryOrder?.googleMapsUrl || c.googleMapsUrl;
                    const mapsHref = getMapsHref(displayMapsUrl, displayAddress);
                    const realOrderCodes = entry.monthOrders
                      .filter((o) => !o.isLegacyFallback)
                      .map((o) => o.orderCode);

                    return (
                      <article
                        key={`${group.monthKey}-${c.id}`}
                        className="min-w-0 rounded-xl border border-border bg-card p-3.5 sm:p-4 flex flex-col justify-between gap-3 hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <button
                            type="button"
                            onClick={() => onSelectCustomer(c)}
                            className="flex items-start gap-3 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                              {getInitials(c.fullName)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-sm font-semibold text-foreground">
                                {c.fullName}
                              </h3>
                              {(c.company || c.position) && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {[c.position, c.company].filter(Boolean).join(' · ')}
                                </p>
                              )}
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-mono tabular-nums text-muted-foreground">
                                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                  {entry.ordersCount} đơn · {entry.machinesInMonth} loa
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {formatDateShort(entry.latestSaleDate)}
                                  {entry.isFallbackDate ? ' (tạm tính)' : ''}
                                </span>
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStar(c)}
                            aria-label="Đánh dấu sao"
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted cursor-pointer shrink-0"
                          >
                            <Star
                              className={`h-4 w-4 ${
                                c.isStarred ? 'fill-amber-400 text-amber-500' : ''
                              }`}
                            />
                          </button>
                        </div>

                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p className="font-mono tabular-nums text-foreground font-medium">
                            {primary?.number || 'Chưa có SĐT'}
                            {c.phones.length > 1 && (
                              <span className="ml-1.5 font-sans font-normal text-muted-foreground">
                                (+{c.phones.length - 1} số)
                              </span>
                            )}
                          </p>
                          {realOrderCodes.length > 0 && (
                            <p className="font-mono tabular-nums text-[11px] text-foreground/80 truncate">
                              Mã đơn: {realOrderCodes.join(', ')}
                            </p>
                          )}
                          {displayAddress && <p className="truncate">{displayAddress}</p>}
                          {(monthPrimaryOrder?.note || c.quickNote) && (
                            <p className="line-clamp-2 text-muted-foreground/90">
                              {monthPrimaryOrder?.note || c.quickNote}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border">
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

                          <button
                            type="button"
                            onClick={() => onEditCustomer(c)}
                            className="flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                          >
                            Sửa
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Desktop Table View for this Month */}
                {viewMode === 'table' && (
                  <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead className="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 w-10">
                              <input
                                type="checkbox"
                                checked={allGroupSelected}
                                onChange={() => toggleGroupSelection(group.customers)}
                                aria-label={`Chọn tất cả ${group.label}`}
                                className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                              />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">Khách hàng</th>
                            <th className="px-4 py-3 whitespace-nowrap">Số điện thoại &amp; Zalo</th>
                            <th className="px-4 py-3 whitespace-nowrap text-right">Đơn trong tháng</th>
                            <th className="px-4 py-3 whitespace-nowrap">Ngày bán gần nhất</th>
                            <th className="px-4 py-3 whitespace-nowrap">Vị trí cửa hàng</th>
                            <th className="px-4 py-3 whitespace-nowrap text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {group.entries.map((entry) => {
                            const c = entry.customer;
                            const primary = c.phones.find((p) => p.isPrimary) ?? c.phones[0];
                            const extra = c.phones.length - 1;
                            const dial = primary ? normalizePhoneForDial(primary.number) : '';
                            const zalo = primary ? getZaloUrl(primary.number) : '';
                            const monthPrimaryOrder = entry.monthOrders[0];
                            const displayAddress = monthPrimaryOrder?.address || c.address;
                            const displayMapsUrl =
                              monthPrimaryOrder?.googleMapsUrl || c.googleMapsUrl;
                            const mapsHref = getMapsHref(displayMapsUrl, displayAddress);
                            const realOrderCodes = entry.monthOrders
                              .filter((o) => !o.isLegacyFallback)
                              .map((o) => o.orderCode);

                            return (
                              <tr
                                key={`${group.monthKey}-${c.id}`}
                                className="hover:bg-muted/35 transition-colors"
                              >
                                <td className="px-4 py-3 align-middle">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(rowSelection[c.id])}
                                    onChange={() => toggleSingleRowSelection(c.id)}
                                    aria-label={`Chọn ${c.fullName}`}
                                    className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-3 align-middle">
                                  <div className="flex items-center gap-2.5 min-w-[200px]">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleStar(c)}
                                      aria-label="Đánh dấu sao"
                                      className="text-muted-foreground hover:text-amber-500 transition-colors cursor-pointer shrink-0"
                                    >
                                      <Star
                                        className={`h-4 w-4 ${
                                          c.isStarred ? 'fill-amber-400 text-amber-500' : ''
                                        }`}
                                      />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onSelectCustomer(c)}
                                      className="text-left min-w-0 cursor-pointer group"
                                    >
                                      <p className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                                        {c.fullName}
                                      </p>
                                      {(c.company || c.position) && (
                                        <p className="text-xs text-muted-foreground truncate">
                                          {[c.position, c.company].filter(Boolean).join(' · ')}
                                        </p>
                                      )}
                                    </button>
                                  </div>
                                </td>
                                <td className="px-4 py-3 align-middle">
                                  <div className="flex items-center gap-2 min-w-[180px]">
                                    <div className="min-w-0">
                                      <p className="font-mono text-xs font-medium text-foreground tabular-nums">
                                        {primary?.number || '—'}
                                      </p>
                                      {extra > 0 && (
                                        <p className="text-[11px] text-muted-foreground">
                                          +{extra} số khác
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {dial && (
                                        <a
                                          href={`tel:${dial}`}
                                          title={`Gọi ${primary?.number}`}
                                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-primary hover:bg-muted transition-colors"
                                        >
                                          <Phone className="h-3.5 w-3.5" />
                                        </a>
                                      )}
                                      {primary?.hasZalo && zalo && (
                                        <a
                                          href={zalo}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title="Mở Zalo"
                                          className="flex h-7 items-center justify-center rounded-md border border-sky-200 dark:border-sky-900 bg-sky-500/10 px-2 text-[11px] font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 transition-colors"
                                        >
                                          Zalo
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 align-middle text-right">
                                  <p className="font-mono text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                    {entry.ordersCount} đơn · {entry.machinesInMonth} loa
                                  </p>
                                  {realOrderCodes.length > 0 && (
                                    <p className="font-mono text-[11px] tabular-nums text-muted-foreground truncate max-w-[170px] ml-auto">
                                      {realOrderCodes.join(', ')}
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-3 align-middle font-mono text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                                  {formatDateShort(entry.latestSaleDate)}
                                  {entry.isFallbackDate ? ' (tạm)' : ''}
                                </td>
                                <td className="px-4 py-3 align-middle">
                                  {mapsHref ? (
                                    <a
                                      href={mapsHref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline max-w-[200px] truncate"
                                      title={displayAddress || displayMapsUrl}
                                    >
                                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate">{displayAddress || 'Mở Google Maps'}</span>
                                    </a>
                                  ) : (
                                    <span className="text-xs text-muted-foreground truncate">
                                      {displayAddress || '—'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 align-middle text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => onEditCustomer(c)}
                                    title="Chỉnh sửa thông tin khách"
                                    aria-label={`Sửa ${c.fullName}`}
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <>
          {/* Mobile-First Card List (Always on mobile < md, or when desktop user picks 'cards') */}
          <div className={viewMode === 'cards' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5' : 'grid grid-cols-1 gap-3 md:hidden'}>
            {filteredCustomers.map((c) => {
              const primary = c.phones.find((p) => p.isPrimary) ?? c.phones[0];
              const dial = primary ? normalizePhoneForDial(primary.number) : '';
              const zalo = primary ? getZaloUrl(primary.number) : '';
              const mapsHref = getMapsHref(c.googleMapsUrl, c.address);

              return (
                <article
                  key={c.id}
                  className="min-w-0 rounded-xl border border-border bg-card p-3.5 sm:p-4 flex flex-col justify-between gap-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={() => onSelectCustomer(c)}
                      className="flex items-start gap-3 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary text-xs font-semibold">
                        {getInitials(c.fullName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-foreground">
                          {c.fullName}
                        </h3>
                        {(c.company || c.position) && (
                          <p className="truncate text-xs text-muted-foreground">
                            {[c.position, c.company].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <StatusBadge status={c.status} compact />
                          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                            · Tạo {formatDateShort(getCustomerCreatedDate(c))}
                          </span>
                          {c.estimatedValue > 0 && (
                            <span className="font-mono text-xs tabular-nums text-muted-foreground">
                              · {formatCurrencyVnd(c.estimatedValue)}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleStar(c)}
                      aria-label="Đánh dấu sao"
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted cursor-pointer shrink-0"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          c.isStarred ? 'fill-amber-400 text-amber-500' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Contact & Address snippet */}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="font-mono tabular-nums text-foreground font-medium">
                      {primary?.number || 'Chưa có SĐT'}
                      {c.phones.length > 1 && (
                        <span className="ml-1.5 font-sans font-normal text-muted-foreground">
                          (+{c.phones.length - 1} số)
                        </span>
                      )}
                    </p>
                    {c.address && <p className="truncate">{c.address}</p>}
                    {c.quickNote && (
                      <p className="line-clamp-2 text-muted-foreground/90">
                        {c.quickNote}
                      </p>
                    )}
                  </div>

                  {/* Touch-friendly One-Hand Action Row (min 44px height) */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border">
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

                    <button
                      type="button"
                      onClick={() => onSelectCustomer(c)}
                      className="flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      Chi tiết
                    </button>
                  </div>

                  {c.status === 'lost' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreToCare(c)}
                      className="h-10 w-full text-xs text-primary border-primary/25 hover:bg-primary/10"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Chuyển về Chăm sóc sau</span>
                    </Button>
                  )}
                </article>
              );
            })}
          </div>

          {/* Desktop TanStack Table */}
          {viewMode === 'table' && (
            <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
                    {table.getHeaderGroups().map((hg) => (
                      <tr key={hg.id}>
                        {hg.headers.map((header) => {
                          const canSort = header.column.getCanSort();
                          return (
                            <th
                              key={header.id}
                              className="px-4 py-3 whitespace-nowrap select-none"
                            >
                              {header.isPlaceholder ? null : canSort ? (
                                <button
                                  type="button"
                                  onClick={header.column.getToggleSortingHandler()}
                                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                                >
                                  <table.FlexRender header={header} />
                                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                                </button>
                              ) : (
                                <table.FlexRender header={header} />
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-border">
                    {table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-muted/35 transition-colors"
                      >
                        {row.getAllCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3 align-middle">
                            <table.FlexRender cell={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  Trang {table.state.pagination.pageIndex + 1} /{' '}
                  {Math.max(1, table.getPageCount())} · Cập nhật gần nhất:{' '}
                  {filteredCustomers[0]?.updatedAt
                    ? format(filteredCustomers[0].updatedAt, 'dd/MM/yyyy HH:mm')
                    : '—'}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Trước
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    Sau
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Xóa ${selectedIds.length} khách hàng?`}
        description="Các khách hàng đã chọn và nhật ký ghi chú liên quan sẽ bị xóa vĩnh viễn khỏi Firestore."
        confirmLabel="Xóa tất cả đã chọn"
        destructive
        loading={bulkLoading}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
