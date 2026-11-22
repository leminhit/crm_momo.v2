import { format, parseISO } from 'date-fns';
import type { CustomerRecord, OrderRecord } from '../types/crm';

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

export function getOrderMachineCount(order: Pick<OrderRecord, 'machineCount'>): number {
  if (
    typeof order.machineCount === 'number' &&
    Number.isFinite(order.machineCount) &&
    order.machineCount >= 1
  ) {
    return Math.floor(order.machineCount);
  }
  return 1;
}

function parseSaleDateString(
  rawInput: string | undefined,
  updatedAt: Date | null,
  createdAt: Date | null
): {
  dateStr: string;
  monthKey: string;
  isFallback: boolean;
} {
  const raw = (rawInput ?? '').trim();
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

  const fallbackDate = updatedAt ?? createdAt ?? new Date();
  const dateStr = format(fallbackDate, 'yyyy-MM-dd');
  return {
    dateStr,
    monthKey: dateStr.slice(0, 7),
    isFallback: true,
  };
}

export function getCustomerSaleDate(customer: CustomerRecord): {
  dateStr: string;
  monthKey: string;
  isFallback: boolean;
} {
  return parseSaleDateString(customer.soldAt, customer.updatedAt, customer.createdAt);
}

export function getOrderSaleDate(
  order: Pick<OrderRecord, 'soldAt' | 'updatedAt' | 'createdAt'>
): {
  dateStr: string;
  monthKey: string;
  isFallback: boolean;
} {
  return parseSaleDateString(order.soldAt, order.updatedAt, order.createdAt);
}

export function generateSuggestedOrderCode(
  orders: Pick<OrderRecord, 'orderCode'>[],
  soldAt: string = getTodayDateString()
): string {
  const match = /^(\d{4})-(\d{2})/.exec(soldAt.trim());
  const yymm = match ? `${match[1].slice(2)}${match[2]}` : format(new Date(), 'yyMM');
  const prefix = `DH-${yymm}-`;
  const existingCodes = new Set(
    orders.map((o) => o.orderCode.trim().toUpperCase())
  );

  let seq = 1;
  while (seq < 10000) {
    const candidate = `${prefix}${String(seq).padStart(3, '0')}`;
    if (!existingCodes.has(candidate)) {
      return candidate;
    }
    seq += 1;
  }
  return `${prefix}${Date.now().toString().slice(-4)}`;
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

export interface UnifiedSaleEntry {
  id: string;
  isLegacyFallback: boolean;
  order: OrderRecord | null;
  customer: CustomerRecord | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  orderCode: string;
  address: string;
  googleMapsUrl: string;
  note: string;
  machines: number;
  saleDate: string;
  monthKey: string;
  isFallbackDate: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export function getUnifiedSaleEntries(
  customers: CustomerRecord[],
  orders: OrderRecord[] = []
): UnifiedSaleEntry[] {
  const customerMap = new Map<string, CustomerRecord>();
  for (const c of customers) {
    customerMap.set(c.id, c);
  }

  const customerIdsWithOrders = new Set<string>();
  const entries: UnifiedSaleEntry[] = [];

  for (const order of orders) {
    customerIdsWithOrders.add(order.customerId);
    const customer = customerMap.get(order.customerId) ?? null;
    const primaryPhone = customer
      ? (customer.phones.find((p) => p.isPrimary) ?? customer.phones[0])?.number ?? ''
      : '';
    const { dateStr, monthKey, isFallback } = getOrderSaleDate(order);

    entries.push({
      id: order.id,
      isLegacyFallback: false,
      order,
      customer,
      customerId: order.customerId,
      customerName: customer?.fullName || order.customerName || 'Khách hàng',
      customerPhone: primaryPhone || order.customerPhone || '',
      orderCode: order.orderCode,
      address: order.address || customer?.address || '',
      googleMapsUrl: order.googleMapsUrl || customer?.googleMapsUrl || '',
      note: order.note,
      machines: getOrderMachineCount(order),
      saleDate: dateStr,
      monthKey,
      isFallbackDate: isFallback,
      createdAtMs: order.createdAt ? order.createdAt.getTime() : 0,
      updatedAtMs: order.updatedAt ? order.updatedAt.getTime() : 0,
    });
  }

  // Legacy compatibility: customers already marked "won" before the Orders tab existed
  for (const c of customers) {
    if (c.status !== 'won' || customerIdsWithOrders.has(c.id)) continue;
    const primaryPhone = (c.phones.find((p) => p.isPrimary) ?? c.phones[0])?.number ?? '';
    const { dateStr, monthKey, isFallback } = getCustomerSaleDate(c);

    entries.push({
      id: `legacy_${c.id}`,
      isLegacyFallback: true,
      order: null,
      customer: c,
      customerId: c.id,
      customerName: c.fullName,
      customerPhone: primaryPhone,
      orderCode: 'Đơn cũ',
      address: c.address,
      googleMapsUrl: c.googleMapsUrl,
      note: c.quickNote,
      machines: getCustomerMachineCount(c),
      saleDate: dateStr,
      monthKey,
      isFallbackDate: isFallback,
      createdAtMs: c.createdAt ? c.createdAt.getTime() : 0,
      updatedAtMs: c.updatedAt ? c.updatedAt.getTime() : 0,
    });
  }

  return entries;
}

export interface WonCustomerMonthEntry {
  customer: CustomerRecord;
  ordersCount: number;
  machinesInMonth: number;
  latestSaleDate: string;
  isFallbackDate: boolean;
  monthOrders: UnifiedSaleEntry[];
}

export interface MonthlySalesGroup {
  monthKey: string;
  label: string;
  entries: WonCustomerMonthEntry[];
  customers: CustomerRecord[];
  customerCount: number;
  orderCount: number;
  totalMachines: number;
}

export function groupWonCustomersByMonth(
  customers: CustomerRecord[],
  orders: OrderRecord[] = []
): MonthlySalesGroup[] {
  const allowedCustomerMap = new Map(customers.map((c) => [c.id, c]));
  const allEntries = getUnifiedSaleEntries(customers, orders);

  // monthKey -> customerId -> UnifiedSaleEntry[]
  const monthMap = new Map<string, Map<string, UnifiedSaleEntry[]>>();

  for (const entry of allEntries) {
    const customer = allowedCustomerMap.get(entry.customerId);
    if (!customer) continue;
    let custMap = monthMap.get(entry.monthKey);
    if (!custMap) {
      custMap = new Map<string, UnifiedSaleEntry[]>();
      monthMap.set(entry.monthKey, custMap);
    }
    const list = custMap.get(entry.customerId);
    if (list) {
      list.push(entry);
    } else {
      custMap.set(entry.customerId, [entry]);
    }
  }

  const groups: MonthlySalesGroup[] = [];

  for (const [monthKey, custMap] of monthMap.entries()) {
    const monthEntries: WonCustomerMonthEntry[] = [];
    let orderCount = 0;
    let totalMachines = 0;

    for (const [customerId, custOrders] of custMap.entries()) {
      const customer = allowedCustomerMap.get(customerId);
      if (!customer) continue;

      const sortedCustOrders = [...custOrders].sort((a, b) => {
        if (a.saleDate !== b.saleDate) return b.saleDate.localeCompare(a.saleDate);
        return b.updatedAtMs - a.updatedAtMs;
      });

      const machinesInMonth = sortedCustOrders.reduce((s, o) => s + o.machines, 0);
      const latest = sortedCustOrders[0];

      orderCount += sortedCustOrders.length;
      totalMachines += machinesInMonth;

      monthEntries.push({
        customer,
        ordersCount: sortedCustOrders.length,
        machinesInMonth,
        latestSaleDate: latest.saleDate,
        isFallbackDate: sortedCustOrders.every((o) => o.isFallbackDate),
        monthOrders: sortedCustOrders,
      });
    }

    monthEntries.sort((a, b) => {
      if (a.latestSaleDate !== b.latestSaleDate) {
        return b.latestSaleDate.localeCompare(a.latestSaleDate);
      }
      const ta = a.customer.updatedAt ? a.customer.updatedAt.getTime() : 0;
      const tb = b.customer.updatedAt ? b.customer.updatedAt.getTime() : 0;
      return tb - ta;
    });

    groups.push({
      monthKey,
      label: formatMonthLabel(monthKey),
      entries: monthEntries,
      customers: monthEntries.map((e) => e.customer),
      customerCount: monthEntries.length,
      orderCount,
      totalMachines,
    });
  }

  groups.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  return groups;
}

export interface PayrollOrderLine {
  entry: UnifiedSaleEntry;
  customer: CustomerRecord | null;
  order: OrderRecord | null;
  orderCode: string;
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
  orderCount: number;
  customerCount: number;
  lines: PayrollOrderLine[];
  hasFallbackDates: boolean;
}

export function buildMonthlyPayrollReport(
  customers: CustomerRecord[],
  orders: OrderRecord[] = [],
  monthKey: string = getCurrentMonthKey()
): MonthlyPayrollReport {
  const monthEntries = getUnifiedSaleEntries(customers, orders)
    .filter((entry) => entry.monthKey === monthKey)
    .sort((a, b) => {
      if (a.saleDate !== b.saleDate) return a.saleDate.localeCompare(b.saleDate);
      return a.createdAtMs - b.createdAtMs;
    });

  let cumulative = 0;
  let hasFallbackDates = false;
  const distinctCustomers = new Set<string>();
  const lines: PayrollOrderLine[] = [];

  for (const entry of monthEntries) {
    if (entry.isFallbackDate) hasFallbackDates = true;
    distinctCustomers.add(entry.customerId);

    const machines = entry.machines;
    const prevPayroll = calculateMonthlyPayroll(cumulative);
    const nextPayroll = calculateMonthlyPayroll(cumulative + machines);

    const startIndex = cumulative + 1;
    const endIndex = cumulative + machines;
    const tier1Count = nextPayroll.tier1Machines - prevPayroll.tier1Machines;
    const tier2Count = nextPayroll.tier2Machines - prevPayroll.tier2Machines;
    const commissionAmount = nextPayroll.totalCommission - prevPayroll.totalCommission;

    cumulative += machines;

    lines.push({
      entry,
      customer: entry.customer,
      order: entry.order,
      orderCode: entry.orderCode,
      saleDate: entry.saleDate,
      isFallbackDate: entry.isFallbackDate,
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
    orderCount: lines.length,
    customerCount: distinctCustomers.size,
    lines,
    hasFallbackDates,
  };
}
