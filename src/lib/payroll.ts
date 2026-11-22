import { format, parseISO } from 'date-fns';
import type { CustomerRecord } from '../types/crm';

export const PAYROLL_CONSTANTS = {
  BASE_SALARY: 5_000_000,
  TIER1_LIMIT: 50,
  TIER1_RATE: 100_000,
  TIER2_LIMIT: 120,
  TIER2_RATE: 200_000,
} as const;

export function getTodayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function getCurrentMonthKey(): string {
  return format(new Date(), 'yyyy-MM');
}

export function formatMonthLabel(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  return `Tháng ${match[2]}/${match[1]}`;
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '—';
  const parsed = parseISO(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return format(parsed, 'dd/MM/yyyy');
}

export function getCustomerMachineCount(customer: CustomerRecord): number {
  if (
    typeof customer.machineCount === 'number' &&
    Number.isFinite(customer.machineCount) &&
    customer.machineCount >= 1
  ) {
    return Math.floor(customer.machineCount);
  }
  return customer.status === 'won' ? 1 : 0;
}

export function getCustomerSaleDate(customer: CustomerRecord): {
  dateStr: string;
  monthKey: string;
  isFallback: boolean;
} {
  const raw = (customer.soldAt ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const dateStr = raw.slice(0, 10);
    return {
      dateStr,
      monthKey: dateStr.slice(0, 7),
      isFallback: false,
    };
  }
  if (/^\d{4}-\d{2}$/.test(raw)) {
    return {
      dateStr: `${raw}-01`,
      monthKey: raw,
      isFallback: false,
    };
  }

  const fallbackDate = customer.updatedAt ?? customer.createdAt ?? new Date();
  const dateStr = format(fallbackDate, 'yyyy-MM-dd');
  return {
    dateStr,
    monthKey: dateStr.slice(0, 7),
    isFallback: true,
  };
}

export interface PayrollBreakdown {
  totalMachines: number;
  baseSalary: number;
  tier1Machines: number;
  tier1Commission: number;
  tier2Machines: number;
  tier2Commission: number;
  beyondCapMachines: number;
  totalCommission: number;
  totalSalary: number;
}

export function calculateMonthlyPayroll(totalMachines: number): PayrollBreakdown {
  const safeMachines = Math.max(0, Math.floor(totalMachines));
  const tier1Machines = Math.min(safeMachines, PAYROLL_CONSTANTS.TIER1_LIMIT);
  const tier1Commission = tier1Machines * PAYROLL_CONSTANTS.TIER1_RATE;

  const tier2Machines = Math.max(
    0,
    Math.min(safeMachines, PAYROLL_CONSTANTS.TIER2_LIMIT) - PAYROLL_CONSTANTS.TIER1_LIMIT
  );
  const tier2Commission = tier2Machines * PAYROLL_CONSTANTS.TIER2_RATE;

  const beyondCapMachines = Math.max(0, safeMachines - PAYROLL_CONSTANTS.TIER2_LIMIT);
  const totalCommission = tier1Commission + tier2Commission;
  const baseSalary = PAYROLL_CONSTANTS.BASE_SALARY;

  return {
    totalMachines: safeMachines,
    baseSalary,
    tier1Machines,
    tier1Commission,
    tier2Machines,
    tier2Commission,
    beyondCapMachines,
    totalCommission,
    totalSalary: baseSalary + totalCommission,
  };
}

export interface MonthlySalesGroup {
  monthKey: string;
  label: string;
  customers: CustomerRecord[];
  customerCount: number;
  totalMachines: number;
}

export function groupWonCustomersByMonth(customers: CustomerRecord[]): MonthlySalesGroup[] {
  const map = new Map<string, CustomerRecord[]>();

  for (const c of customers) {
    if (c.status !== 'won') continue;
    const { monthKey } = getCustomerSaleDate(c);
    const list = map.get(monthKey);
    if (list) {
      list.push(c);
    } else {
      map.set(monthKey, [c]);
    }
  }

  const groups: MonthlySalesGroup[] = [];
  for (const [monthKey, items] of map.entries()) {
    const sorted = [...items].sort((a, b) => {
      const da = getCustomerSaleDate(a).dateStr;
      const db = getCustomerSaleDate(b).dateStr;
      if (da !== db) return db.localeCompare(da);
      const ta = a.updatedAt ? a.updatedAt.getTime() : 0;
      const tb = b.updatedAt ? b.updatedAt.getTime() : 0;
      return tb - ta;
    });

    const totalMachines = sorted.reduce(
      (sum, item) => sum + getCustomerMachineCount(item),
      0
    );

    groups.push({
      monthKey,
      label: formatMonthLabel(monthKey),
      customers: sorted,
      customerCount: sorted.length,
      totalMachines,
    });
  }

  groups.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  return groups;
}

export interface PayrollCustomerLine {
  customer: CustomerRecord;
  saleDate: string;
  isFallbackDate: boolean;
  machines: number;
  startIndex: number;
  endIndex: number;
  tier1Count: number;
  tier2Count: number;
  commissionAmount: number;
}

export interface MonthlyPayrollReport {
  monthKey: string;
  monthLabel: string;
  breakdown: PayrollBreakdown;
  customerCount: number;
  lines: PayrollCustomerLine[];
  hasFallbackDates: boolean;
}

export function buildMonthlyPayrollReport(
  customers: CustomerRecord[],
  monthKey: string
): MonthlyPayrollReport {
  const monthSold = customers
    .filter((c) => c.status === 'won' && getCustomerSaleDate(c).monthKey === monthKey)
    .sort((a, b) => {
      const da = getCustomerSaleDate(a).dateStr;
      const db = getCustomerSaleDate(b).dateStr;
      if (da !== db) return da.localeCompare(db);
      const ta = a.createdAt ? a.createdAt.getTime() : 0;
      const tb = b.createdAt ? b.createdAt.getTime() : 0;
      return ta - tb;
    });

  let cumulative = 0;
  let hasFallbackDates = false;
  const lines: PayrollCustomerLine[] = [];

  for (const customer of monthSold) {
    const { dateStr, isFallback } = getCustomerSaleDate(customer);
    if (isFallback) hasFallbackDates = true;

    const machines = getCustomerMachineCount(customer);
    const prevPayroll = calculateMonthlyPayroll(cumulative);
    const nextPayroll = calculateMonthlyPayroll(cumulative + machines);

    const startIndex = cumulative + 1;
    const endIndex = cumulative + machines;
    const tier1Count = nextPayroll.tier1Machines - prevPayroll.tier1Machines;
    const tier2Count = nextPayroll.tier2Machines - prevPayroll.tier2Machines;
    const commissionAmount = nextPayroll.totalCommission - prevPayroll.totalCommission;

    cumulative += machines;

    lines.push({
      customer,
      saleDate: dateStr,
      isFallbackDate: isFallback,
      machines,
      startIndex,
      endIndex,
      tier1Count,
      tier2Count,
      commissionAmount,
    });
  }

  return {
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    breakdown: calculateMonthlyPayroll(cumulative),
    customerCount: lines.length,
    lines,
    hasFallbackDates,
  };
}
