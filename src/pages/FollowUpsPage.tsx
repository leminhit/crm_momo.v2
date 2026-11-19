import { useMemo } from 'react';
import { addDays, format, isBefore, isToday, parseISO, startOfDay } from 'date-fns';
import {
  CalendarCheck2,
  CalendarClock,
  MapPin,
  MessageCircle,
  Phone,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { useCrm } from '../contexts/CrmContext';
import { updateCustomerFollowUp } from '../lib/crm-service';
import { getMapsHref, getZaloUrl, normalizePhoneForDial } from '../lib/utils';
import type { CustomerRecord } from '../types/crm';

interface FollowUpsPageProps {
  onSelectCustomer: (customer: CustomerRecord) => void;
}

export function FollowUpsPage({ onSelectCustomer }: FollowUpsPageProps) {
  const { workspace, customers, loadingData } = useCrm();

  const groups = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const overdue: CustomerRecord[] = [];
    const today: CustomerRecord[] = [];
    const upcoming: CustomerRecord[] = [];
    const starredNoDate: CustomerRecord[] = [];

    for (const c of customers) {
      if (c.nextFollowUpAt) {
        const parsed = parseISO(c.nextFollowUpAt);
        if (!Number.isNaN(parsed.getTime())) {
          if (isToday(parsed)) {
            today.push(c);
          } else if (isBefore(parsed, todayStart)) {
            overdue.push(c);
          } else {
            upcoming.push(c);
          }
          continue;
        }
      }
      if (c.isStarred && c.status !== 'lost') {
        starredNoDate.push(c);
      }
    }

    overdue.sort((a, b) => a.nextFollowUpAt.localeCompare(b.nextFollowUpAt));
    upcoming.sort((a, b) => a.nextFollowUpAt.localeCompare(b.nextFollowUpAt));

    return { overdue, today, upcoming, starredNoDate };
  }, [customers]);

  const handleReschedule = async (customer: CustomerRecord, daysToAdd: number | null) => {
    if (!workspace) return;
    const nextDate =
      daysToAdd === null
        ? ''
        : format(addDays(new Date(), daysToAdd), 'yyyy-MM-dd');
    try {
      await updateCustomerFollowUp(
        workspace.id,
        customer.id,
        customer.quickNote,
        nextDate
      );
      toast.success(
        daysToAdd === null
          ? `Đã hoàn tất lịch hẹn cho ${customer.fullName}`
          : `Đã dời lịch ${customer.fullName} sang ${nextDate}`
      );
    } catch {
      toast.error('Không thể cập nhật lịch hẹn.');
    }
  };

  if (loadingData) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const renderSection = (
    title: string,
    subtitle: string,
    list: CustomerRecord[],
    tone: 'danger' | 'amber' | 'neutral'
  ) => (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span
          className={`font-mono text-xs font-semibold tabular-nums px-2.5 py-1 rounded-md ${
            tone === 'danger'
              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
              : tone === 'amber'
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'bg-muted text-muted-foreground'
          }`}
        >
          {list.length}
        </span>
      </div>

      {list.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">
          Không có khách hàng trong mục này.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {list.map((c) => {
            const primary = c.phones.find((p) => p.isPrimary) ?? c.phones[0];
            const dial = primary ? normalizePhoneForDial(primary.number) : '';
            const zalo = primary ? getZaloUrl(primary.number) : '';
            const mapsHref = getMapsHref(c.googleMapsUrl, c.address);

            return (
              <div
                key={c.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3.5"
              >
                <button
                  type="button"
                  onClick={() => onSelectCustomer(c)}
                  className="min-w-0 flex-1 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground truncate">
                      {c.fullName}
                    </span>
                    <StatusBadge status={c.status} compact />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground font-mono tabular-nums">
                    {primary?.number || 'Chưa có SĐT'}
                    {c.nextFollowUpAt ? ` · Hẹn: ${c.nextFollowUpAt}` : ''}
                    {c.company ? ` · ${c.company}` : ''}
                  </p>
                  {c.quickNote && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      {c.quickNote}
                    </p>
                  )}
                </button>

                <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto sm:shrink-0">
                  {dial && (
                    <Button asChild variant="outline" size="sm" className="h-10 sm:h-9">
                      <a href={`tel:${dial}`}>
                        <Phone className="h-3.5 w-3.5 text-primary" />
                        Gọi
                      </a>
                    </Button>
                  )}
                  {zalo && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-10 sm:h-9 text-sky-700 dark:text-sky-300"
                    >
                      <a href={zalo} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-3.5 w-3.5" />
                        Zalo
                      </a>
                    </Button>
                  )}
                  {mapsHref && (
                    <Button
                      asChild
                      variant="ghost"
                      size="icon-sm"
                      title="Maps"
                      className="h-10 w-10 sm:h-9 sm:w-9"
                    >
                      <a href={mapsHref} target="_blank" rel="noopener noreferrer">
                        <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </a>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 sm:h-9 text-xs"
                    onClick={() => handleReschedule(c, 3)}
                  >
                    +3 ngày
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 sm:h-9 text-xs"
                    onClick={() => handleReschedule(c, 7)}
                  >
                    +7 ngày
                  </Button>
                  {c.nextFollowUpAt && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-10 sm:h-9 text-xs"
                      onClick={() => handleReschedule(c, null)}
                    >
                      <CalendarCheck2 className="h-3.5 w-3.5" />
                      Xong
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarClock className="h-4 w-4 text-primary" />
        <span>
          Theo dõi các cuộc hẹn chăm sóc khách hàng và dời lịch nhanh bằng một chạm.
        </span>
      </div>

      {renderSection(
        'Quá hạn liên hệ',
        'Các khách hàng có ngày hẹn trước hôm nay',
        groups.overdue,
        'danger'
      )}
      {renderSection(
        'Lịch chăm sóc hôm nay',
        'Ưu tiên gọi điện hoặc nhắn Zalo trong ngày',
        groups.today,
        'amber'
      )}
      {renderSection(
        'Sắp tới',
        'Kế hoạch chăm sóc trong những ngày tiếp theo',
        groups.upcoming,
        'neutral'
      )}
      {groups.starredNoDate.length > 0 && (
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
            <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
            <h2 className="text-sm font-semibold text-foreground">
              Khách hàng gắn sao chưa đặt lịch ({groups.starredNoDate.length})
            </h2>
          </div>
          <div className="divide-y divide-border">
            {groups.starredNoDate.map((c) => (
              <div
                key={c.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3"
              >
                <button
                  type="button"
                  onClick={() => onSelectCustomer(c)}
                  className="text-left min-w-0 flex-1 cursor-pointer"
                >
                  <p className="text-sm font-medium text-foreground truncate">
                    {c.fullName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.company || 'Khách hàng gắn sao'}
                  </p>
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 sm:h-9 w-full sm:w-auto"
                  onClick={() => handleReschedule(c, 1)}
                >
                  Hẹn ngày mai
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
