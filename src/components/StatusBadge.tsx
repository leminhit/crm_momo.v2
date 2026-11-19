import { cn } from '../lib/utils';
import { CUSTOMER_STATUS_META, type CustomerStatus } from '../types/crm';

export function StatusBadge({
  status,
  compact = false,
  className,
}: {
  status: CustomerStatus;
  compact?: boolean;
  className?: string;
}) {
  const meta = CUSTOMER_STATUS_META[status] ?? CUSTOMER_STATUS_META.lead;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0',
        meta.badgeClass,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', meta.dotColor)} aria-hidden="true" />
      <span>{compact ? meta.shortLabel : meta.label}</span>
    </span>
  );
}
