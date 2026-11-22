import { useMemo, useState } from 'react';
import { addMonths, format, parse } from 'date-fns';
import {
  ArrowRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ShoppingBag,
  Speaker,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { useCrm } from '../contexts/CrmContext';
import {
  buildMonthlyPayrollReport,
  formatDateShort,
  formatMonthLabel,
  getCurrentMonthKey,
  groupWonCustomersByMonth,
  PAYROLL_CONSTANTS,
} from '../lib/payroll';
import { formatCurrencyVnd, getInitials } from '../lib/utils';
import type { CustomerRecord } from '../types/crm';

interface PayrollPageProps {
  onSelectCustomer: (customer: CustomerRecord) => void;
  onEditCustomer: (customer: CustomerRecord) => void;
  onAddCustomer: () => void;
}

export function PayrollPage({
  onSelectCustomer,
  onEditCustomer,
}: PayrollPageProps) {
  const { customers, orders, loadingData } = useCrm();
  const currentMonthKey = getCurrentMonthKey();
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  const monthGroups = useMemo(
    () => groupWonCustomersByMonth(customers, orders),
    [customers, orders]
  );

  const quickMonthKeys = useMemo(() => {
    const keys = new Set<string>([currentMonthKey]);
    for (const g of monthGroups) {
      keys.add(g.monthKey);
    }
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [currentMonthKey, monthGroups]);

  const monthMachinesMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of monthGroups) {
      map.set(g.monthKey, g.totalMachines);
    }
    return map;
  }, [monthGroups]);

  const report = useMemo(
    () => buildMonthlyPayrollReport(customers, orders, selectedMonth),
    [customers, orders, selectedMonth]
  );

  const handleShiftMonth = (delta: number) => {
    const parsed = parse(selectedMonth, 'yyyy-MM', new Date());
    if (Number.isNaN(parsed.getTime())) return;
    setSelectedMonth(format(addMonths(parsed, delta), 'yyyy-MM'));
  };

  const { breakdown } = report;
  const totalMachines = breakdown.totalMachines;
  const tier1Pct = Math.min(
    100,
    Math.round((breakdown.tier1Machines / PAYROLL_CONSTANTS.TIER1_LIMIT) * 100)
  );
  const tier2Cap = PAYROLL_CONSTANTS.TIER2_LIMIT - PAYROLL_CONSTANTS.TIER1_LIMIT; // 70
  const tier2Pct = Math.min(
    100,
    Math.round((breakdown.tier2Machines / tier2Cap) * 100)
  );

  let milestoneHint = '';
  if (totalMachines === 0) {
    milestoneHint =
      'Chưa có đơn hàng nào được chốt trong tháng này. Đang tính lương cố định 5.000.000 ₫.';
  } else if (totalMachines < PAYROLL_CONSTANTS.TIER1_LIMIT) {
    const remaining = PAYROLL_CONSTANTS.TIER1_LIMIT - totalMachines;
    milestoneHint = `Đang ở mức 100.000 ₫/loa. Cần thêm ${remaining + 1} loa nữa để bắt đầu hưởng mức 200.000 ₫/loa (từ loa thứ 51).`;
  } else if (totalMachines === PAYROLL_CONSTANTS.TIER1_LIMIT) {
    milestoneHint =
      'Đã chạm đủ 50 loa bậc 1! Từ loa tiếp theo (#51) hoa hồng tăng lên 200.000 ₫/loa.';
  } else if (totalMachines < PAYROLL_CONSTANTS.TIER2_LIMIT) {
    const remainingTo120 = PAYROLL_CONSTANTS.TIER2_LIMIT - totalMachines;
    milestoneHint = `Đang hưởng mức 200.000 ₫/loa (bậc 2). Còn ${remainingTo120} loa để đạt trần 120 loa.`;
  } else if (totalMachines === PAYROLL_CONSTANTS.TIER2_LIMIT) {
    milestoneHint =
      'Đã đạt tối đa khung hoa hồng 120 loa/tháng (50 loa × 100k + 70 loa × 200k).';
  } else {
    milestoneHint = `Tổng tháng đạt ${totalMachines} loa (vượt ${breakdown.beyondCapMachines} loa so với mốc 120 loa). Bảng lương đang tính đủ 50 loa × 100k và 70 loa × 200k.`;
  }

  if (loadingData) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Month Selection Header */}
      <section className="rounded-xl border border-border bg-card p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Bảng lương {report.monthLabel}
            </h2>
            <p className="text-xs text-muted-foreground">
              Lương cố định 5.000.000 ₫ + Hoa hồng tính theo từng đơn hàng trong tháng
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleShiftMonth(-1)}
              aria-label="Tháng trước"
              className="h-10 w-10"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) setSelectedMonth(e.target.value);
              }}
              aria-label="Chọn tháng xem bảng lương"
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-medium font-mono tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleShiftMonth(1)}
              aria-label="Tháng sau"
              className="h-10 w-10"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Quick Month Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {quickMonthKeys.map((key) => {
            const active = key === selectedMonth;
            const count = monthMachinesMap.get(key) ?? 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedMonth(key)}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{formatMonthLabel(key)}</span>
                <span className="font-mono tabular-nums text-[11px] opacity-80">
                  · {count} loa
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4-Card KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-primary/35 bg-primary/5 p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tổng thu nhập</span>
            <Banknote className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight font-mono tabular-nums text-primary truncate">
            {formatCurrencyVnd(breakdown.totalSalary)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {report.monthLabel}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Lương cố định</span>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight font-mono tabular-nums text-foreground truncate">
            {formatCurrencyVnd(breakdown.baseSalary)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Mức cơ bản hàng tháng
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Số loa đã bán</span>
            <Speaker className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight font-mono tabular-nums text-foreground">
            {breakdown.totalMachines}
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {report.orderCount} đơn hàng · {report.customerCount} khách
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tổng hoa hồng</span>
            <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight font-mono tabular-nums text-foreground truncate">
            {formatCurrencyVnd(breakdown.totalCommission)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            Bậc 1 ({breakdown.tier1Machines}) + Bậc 2 ({breakdown.tier2Machines})
          </p>
        </div>
      </section>

      {/* Tier Progress & Order Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Progress & Formula */}
        <section className="lg:col-span-5 rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Tiến độ mốc hoa hồng
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {milestoneHint}
            </p>
          </div>

          {/* Tier 1 Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">
                Bậc 1: Loa 1 → 50 (100.000 ₫/loa)
              </span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {breakdown.tier1Machines} / {PAYROLL_CONSTANTS.TIER1_LIMIT} loa
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${tier1Pct}%` }}
              />
            </div>
          </div>

          {/* Tier 2 Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">
                Bậc 2: Loa 51 → 120 (200.000 ₫/loa)
              </span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {breakdown.tier2Machines} / {tier2Cap} loa
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-300"
                style={{ width: `${tier2Pct}%` }}
              />
            </div>
          </div>

          {/* Summary Calculation Lines */}
          <div className="divide-y divide-border border-t border-border pt-2 text-sm">
            <div className="flex items-center justify-between py-2.5 gap-3">
              <span className="text-muted-foreground">Lương cố định</span>
              <span className="font-mono tabular-nums font-medium text-foreground">
                {formatCurrencyVnd(breakdown.baseSalary)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5 gap-3">
              <span className="text-muted-foreground">
                Bậc 1 ({breakdown.tier1Machines} loa × 100k)
              </span>
              <span className="font-mono tabular-nums font-medium text-foreground">
                {formatCurrencyVnd(breakdown.tier1Commission)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5 gap-3">
              <span className="text-muted-foreground">
                Bậc 2 ({breakdown.tier2Machines} loa × 200k)
              </span>
              <span className="font-mono tabular-nums font-medium text-foreground">
                {formatCurrencyVnd(breakdown.tier2Commission)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-3 pb-1 gap-3">
              <span className="font-semibold text-foreground">
                Tổng thực nhận
              </span>
              <span className="font-mono tabular-nums text-base font-bold text-primary">
                {formatCurrencyVnd(breakdown.totalSalary)}
              </span>
            </div>
          </div>
        </section>

        {/* Itemized Orders Sold in Selected Month */}
        <section className="lg:col-span-7 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-4 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Chi tiết đơn hàng {report.monthLabel}
              </h3>
              <p className="text-xs text-muted-foreground">
                Tính hoa hồng theo từng đơn hàng (cửa hàng) phát sinh trong tháng
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/orders"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline whitespace-nowrap"
              >
                Mục Đơn hàng
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/customers?status=won"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline whitespace-nowrap"
              >
                Tab Đã bán
              </Link>
            </div>
          </div>

          {report.hasFallbackDates && (
            <div className="border-b border-border bg-amber-500/10 px-4 sm:px-5 py-2.5 text-xs text-amber-800 dark:text-amber-300">
              Một số khách cũ chưa tách đơn hàng hoặc chưa có Ngày bán đang tạm tính từ hồ sơ khách.
            </div>
          )}

          {report.lines.length === 0 ? (
            <div className="p-8 sm:p-10 text-center space-y-3 flex-1 flex flex-col items-center justify-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Chưa có đơn hàng nào trong {report.monthLabel}
                </p>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                  Vào mục Đơn hàng và bấm Tạo đơn để gắn cửa hàng mới cho khách hàng, hoa hồng sẽ tự động cộng vào tháng tương ứng.
                </p>
              </div>
              <Button asChild type="button" size="sm" variant="outline">
                <Link to="/orders">
                  <span>Mở mục Đơn hàng</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {report.lines.map((line) => {
                const rangeLabel =
                  line.machines === 1
                    ? `#${line.startIndex}`
                    : `#${line.startIndex}–#${line.endIndex}`;
                const displayName = line.entry.customerName;
                const detailSub = line.entry.note || line.entry.address;

                return (
                  <div
                    key={line.entry.id}
                    className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 hover:bg-muted/35 transition-colors"
                  >
                    {line.customer ? (
                      <button
                        type="button"
                        onClick={() => onSelectCustomer(line.customer!)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                          {getInitials(displayName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            <span className="font-mono text-xs text-primary font-semibold">
                              {line.orderCode}
                            </span>
                            <span aria-hidden="true"> · </span>
                            <span>{displayName}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground font-mono tabular-nums truncate">
                            {formatDateShort(line.saleDate)}
                            {line.isFallbackDate ? ' (tạm tính)' : ''}
                            {' · '}
                            <span className="text-foreground font-medium">
                              {line.machines} loa
                            </span>
                            {' · '}
                            Loa {rangeLabel}
                            {detailSub ? (
                              <span className="font-sans"> · {detailSub}</span>
                            ) : null}
                          </p>
                        </div>
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                          {getInitials(displayName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            <span className="font-mono text-xs text-primary font-semibold">
                              {line.orderCode}
                            </span>
                            <span aria-hidden="true"> · </span>
                            <span>{displayName}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground font-mono tabular-nums truncate">
                            {formatDateShort(line.saleDate)} · {line.machines} loa · Loa {rangeLabel}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="font-mono tabular-nums text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          +{formatCurrencyVnd(line.commissionAmount)}
                        </p>
                        {line.tier1Count > 0 && line.tier2Count > 0 && (
                          <p className="text-[11px] font-mono tabular-nums text-muted-foreground">
                            {line.tier1Count}×100k + {line.tier2Count}×200k
                          </p>
                        )}
                      </div>
                      {line.entry.isLegacyFallback && line.customer && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onEditCustomer(line.customer!)}
                          title="Sửa ngày bán / số loa hồ sơ cũ"
                          aria-label={`Sửa ${displayName}`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
