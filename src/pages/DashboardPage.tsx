import { useMemo } from 'react';
import { format, isBefore, isToday, parseISO, startOfDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { useCrm } from '../contexts/CrmContext';
import {
  buildMonthlyPayrollReport,
  getCurrentMonthKey,
  getCustomerMachineCount,
} from '../lib/payroll';
import {
  formatCurrencyVnd,
  getInitials,
  getMapsHref,
  getZaloUrl,
  normalizePhoneForDial,
} from '../lib/utils';
import {
  CUSTOMER_STATUS_META,
  type CustomerRecord,
  type CustomerStatus,
} from '../types/crm';

interface DashboardPageProps {
  onAddCustomer: () => void;
  onSelectCustomer: (customer: CustomerRecord) => void;
}

const PIPELINE_ORDER: CustomerStatus[] = [
  'lead',
  'contacted',
  'negotiating',
  'won',
  'care',
  'lost',
];

export function DashboardPage({
  onAddCustomer,
  onSelectCustomer,
}: DashboardPageProps) {
  const { customers, loadingData, workspace } = useCrm();

  const stats = useMemo(() => {
    const todayStart = startOfDay(new Date());
    let activePipelineValue = 0;
    let wonValue = 0;
    let wonMachinesTotal = 0;
    let dueCount = 0;
    let starredCount = 0;

    const statusCounts: Record<CustomerStatus, number> = {
      lead: 0,
      contacted: 0,
      negotiating: 0,
      won: 0,
      care: 0,
      lost: 0,
    };

    const dueList: Array<{ customer: CustomerRecord; isOverdue: boolean }> = [];

    for (const c of customers) {
      statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
      if (c.isStarred) starredCount += 1;

      if (c.status === 'won') {
        wonValue += c.estimatedValue || 0;
        wonMachinesTotal += getCustomerMachineCount(c);
      } else if (c.status !== 'lost') {
        activePipelineValue += c.estimatedValue || 0;
      }

      if (c.nextFollowUpAt) {
        const parsed = parseISO(c.nextFollowUpAt);
        if (!Number.isNaN(parsed.getTime())) {
          if (isToday(parsed) || isBefore(parsed, todayStart)) {
            dueCount += 1;
            dueList.push({
              customer: c,
              isOverdue: isBefore(parsed, todayStart) && !isToday(parsed),
            });
          }
        }
      }
    }

    dueList.sort((a, b) =>
      a.customer.nextFollowUpAt.localeCompare(b.customer.nextFollowUpAt)
    );

    const currentPayroll = buildMonthlyPayrollReport(customers, getCurrentMonthKey());

    return {
      total: customers.length,
      activePipelineValue,
      wonValue,
      wonMachinesTotal,
      dueCount,
      starredCount,
      statusCounts,
      currentPayroll,
      dueList: dueList.slice(0, 6),
      recentCustomers: customers.slice(0, 6),
    };
  }, [customers]);

  if (loadingData) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-44 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 sm:p-12 text-center max-w-2xl mx-auto mt-4">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Chào mừng đến với {workspace?.name || 'Sổ Khách CRM'}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Bạn chưa có khách hàng nào trong hệ thống. Hãy thêm khách hàng đầu tiên hoặc nhập nhanh từ file Excel có sẵn.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button onClick={onAddCustomer} size="lg" className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Thêm khách hàng đầu tiên
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link to="/settings">Nhập từ file Excel / Backup</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tổng khách hàng</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight font-mono tabular-nums text-foreground">
            {stats.total}
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {stats.starredCount} khách gắn sao quan trọng
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Đang theo dõi</span>
            <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight font-mono tabular-nums text-foreground truncate">
            {formatCurrencyVnd(stats.activePipelineValue)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {stats.statusCounts.negotiating} đang thương lượng
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Đã bán</span>
            <Star className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight font-mono tabular-nums text-foreground">
            {stats.wonMachinesTotal} <span className="text-sm font-sans font-normal text-muted-foreground">loa</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            <Link to="/customers?status=won" className="text-primary hover:underline">
              {stats.statusCounts.won} khách đã bán &rarr;
            </Link>
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Cần chăm sóc</span>
            <CalendarClock className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight font-mono tabular-nums text-foreground">
            {stats.dueCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            <Link to="/follow-ups" className="text-primary hover:underline">
              Xem lịch hôm nay &rarr;
            </Link>
          </p>
        </div>
      </section>

      {/* Current Month Payroll & Sales Summary */}
      <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <Banknote className="h-4 w-4" />
              <span>Bảng lương {stats.currentPayroll.monthLabel}</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-2xl font-semibold tracking-tight font-mono tabular-nums text-foreground">
                {formatCurrencyVnd(stats.currentPayroll.breakdown.totalSalary)}
              </p>
              <p className="text-xs text-muted-foreground font-mono tabular-nums">
                Cố định {formatCurrencyVnd(stats.currentPayroll.breakdown.baseSalary)} + Hoa hồng{' '}
                {formatCurrencyVnd(stats.currentPayroll.breakdown.totalCommission)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              Đã bán trong tháng:{' '}
              <strong className="text-foreground font-mono">
                {stats.currentPayroll.breakdown.totalMachines} loa
              </strong>{' '}
              ({stats.currentPayroll.customerCount} khách hàng)
            </p>
          </div>

          <Button asChild size="sm" variant="default" className="h-10 shrink-0 self-start sm:self-center">
            <Link to="/payroll">
              <span>Xem bảng lương chi tiết</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Pipeline Distribution */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Phân bổ trạng thái kinh doanh
            </h2>
            <p className="text-xs text-muted-foreground">
              Nhấn vào từng giai đoạn để lọc nhanh danh sách khách hàng
            </p>
          </div>
          <Link
            to="/customers"
            className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 whitespace-nowrap"
          >
            Xem tất cả
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {PIPELINE_ORDER.map((status) => {
            const count = stats.statusCounts[status];
            const pct =
              stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            return (
              <Link
                key={status}
                to={`/customers?status=${status}`}
                className="rounded-xl border border-border bg-background p-3 hover:border-primary/50 hover:bg-muted/40 transition-colors"
              >
                <StatusBadge status={status} compact />
                <div className="mt-2.5 flex items-baseline justify-between">
                  <span className="text-xl font-semibold font-mono tabular-nums text-foreground">
                    {count}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-muted-foreground">
                    {pct}%
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Two-Column Action Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Due / Overdue Follow-ups */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Cần liên hệ hôm nay &amp; quá hạn
              </h2>
              <p className="text-xs text-muted-foreground">
                Thao tác gọi hoặc nhắn Zalo ngay từ danh sách
              </p>
            </div>
            <Link
              to="/follow-ups"
              className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
            >
              Mở lịch
            </Link>
          </div>

          {stats.dueList.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Không có lịch chăm sóc nào bị trễ hoặc đến hạn hôm nay.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {stats.dueList.map(({ customer, isOverdue }) => {
                const phone =
                  customer.phones.find((p) => p.isPrimary) ?? customer.phones[0];
                const dial = phone ? normalizePhoneForDial(phone.number) : '';
                const zalo = phone ? getZaloUrl(phone.number) : '';
                return (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectCustomer(customer)}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <p className="truncate text-sm font-medium text-foreground">
                        {customer.fullName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        <span
                          className={
                            isOverdue
                              ? 'text-rose-600 dark:text-rose-400 font-medium'
                              : 'text-amber-600 dark:text-amber-400 font-medium'
                          }
                        >
                          {isOverdue ? 'Quá hạn' : 'Hôm nay'} ({customer.nextFollowUpAt})
                        </span>
                        {customer.company ? ` · ${customer.company}` : ''}
                      </p>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {dial && (
                        <Button asChild variant="outline" size="icon-sm" title="Gọi">
                          <a href={`tel:${dial}`} aria-label={`Gọi ${customer.fullName}`}>
                            <Phone className="h-3.5 w-3.5 text-primary" />
                          </a>
                        </Button>
                      )}
                      {zalo && (
                        <Button
                          asChild
                          variant="outline"
                          size="icon-sm"
                          title="Nhắn Zalo"
                        >
                          <a
                            href={zalo}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Zalo ${customer.fullName}`}
                          >
                            <MessageCircle className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recently Updated Customers */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Khách hàng cập nhật gần đây
              </h2>
              <p className="text-xs text-muted-foreground">
                Nhấn vào khách hàng để mở hồ sơ &amp; nhật ký ghi chú
              </p>
            </div>
            <Link
              to="/customers"
              className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
            >
              Danh sách
            </Link>
          </div>

          <div className="divide-y divide-border">
            {stats.recentCustomers.map((customer) => {
              const phone =
                customer.phones.find((p) => p.isPrimary) ?? customer.phones[0];
              const mapsHref = getMapsHref(customer.googleMapsUrl, customer.address);
              return (
                <div
                  key={customer.id}
                  className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 hover:bg-muted/40 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onSelectCustomer(customer)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                      {getInitials(customer.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {customer.fullName}
                        </p>
                        <StatusBadge status={customer.status} compact />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground truncate font-mono tabular-nums">
                        {phone?.number || 'Chưa có SĐT'}
                        {customer.phones.length > 1
                          ? ` (+${customer.phones.length - 1})`
                          : ''}
                        {customer.updatedAt
                          ? ` · ${format(customer.updatedAt, 'dd/MM HH:mm', { locale: vi })}`
                          : ''}
                      </p>
                    </div>
                  </button>

                  {mapsHref && (
                    <Button
                      asChild
                      variant="ghost"
                      size="icon-sm"
                      title="Mở Google Maps"
                    >
                      <a
                        href={mapsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Google Maps ${customer.fullName}`}
                      >
                        <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </a>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
