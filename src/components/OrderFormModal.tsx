import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Check,
  ExternalLink,
  Loader2,
  LocateFixed,
  Search,
  UserCheck,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Modal } from './ui/modal';
import { Textarea } from './ui/textarea';
import { useCrm } from '../contexts/CrmContext';
import {
  createOrderWithCustomerSync,
  updateOrder,
} from '../lib/crm-service';
import {
  formatDateShort,
  generateSuggestedOrderCode,
  getCustomerMachineCount,
  getCustomerSaleDate,
  getTodayDateString,
} from '../lib/payroll';
import { getMapsHref } from '../lib/utils';
import {
  CRM_LIMITS,
  orderFormSchema,
  type OrderFormValues,
} from '../lib/validators';
import {
  CUSTOMER_STATUS_META,
  type OrderRecord,
} from '../types/crm';

interface OrderFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingOrder?: OrderRecord | null;
  onSaved?: (orderId: string) => void;
}

export function OrderFormModal({
  open,
  onOpenChange,
  editingOrder,
  onSaved,
}: OrderFormModalProps) {
  const { customers, orders, ensureWorkspaceReady } = useCrm();
  const isEditing = Boolean(editingOrder);

  const [customerSearch, setCustomerSearch] = useState('');
  const [pickerExpanded, setPickerExpanded] = useState(true);
  const [locatingGps, setLocatingGps] = useState(false);
  const [migrateLegacyOrder, setMigrateLegacyOrder] = useState(false);

  const form = useForm<OrderFormValues>({
    // @ts-expect-error zod v4 + hookform resolver type inference
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customerId: '',
      orderCode: '',
      soldAt: getTodayDateString(),
      address: '',
      googleMapsUrl: '',
      note: '',
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = form;

  const watchedCustomerId = watch('customerId');
  const watchedSoldAt = watch('soldAt');
  const watchedAddress = watch('address');
  const watchedMapsUrl = watch('googleMapsUrl');

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === watchedCustomerId) ?? null,
    [customers, watchedCustomerId]
  );

  const customerHasExistingOrders = useMemo(() => {
    if (!selectedCustomer) return false;
    return orders.some((o) => o.customerId === selectedCustomer.id);
  }, [orders, selectedCustomer]);

  const legacySaleInfo = useMemo(() => {
    if (
      isEditing ||
      !selectedCustomer ||
      selectedCustomer.status !== 'won' ||
      customerHasExistingOrders
    ) {
      return null;
    }
    const sale = getCustomerSaleDate(selectedCustomer);
    const machines = getCustomerMachineCount(selectedCustomer);
    return {
      dateStr: sale.dateStr,
      monthKey: sale.monthKey,
      machines,
    };
  }, [isEditing, selectedCustomer, customerHasExistingOrders]);

  useEffect(() => {
    if (!open) return;
    if (editingOrder) {
      reset({
        customerId: editingOrder.customerId,
        orderCode: editingOrder.orderCode,
        soldAt: editingOrder.soldAt || getTodayDateString(),
        address: editingOrder.address,
        googleMapsUrl: editingOrder.googleMapsUrl,
        note: editingOrder.note,
      });
      setCustomerSearch('');
      setPickerExpanded(false);
      setMigrateLegacyOrder(false);
    } else {
      const today = getTodayDateString();
      reset({
        customerId: '',
        orderCode: generateSuggestedOrderCode(orders, today),
        soldAt: today,
        address: '',
        googleMapsUrl: '',
        note: '',
      });
      setCustomerSearch('');
      setPickerExpanded(true);
      setMigrateLegacyOrder(false);
    }
    // Intentionally reset only when modal opens or editing target changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingOrder, reset]);

  useEffect(() => {
    if (!open || isEditing || !watchedSoldAt || dirtyFields.orderCode) {
      return;
    }
    setValue('orderCode', generateSuggestedOrderCode(orders, watchedSoldAt), {
      shouldDirty: false,
    });
  }, [open, isEditing, watchedSoldAt, dirtyFields.orderCode, orders, setValue]);

  useEffect(() => {
    if (!legacySaleInfo) {
      setMigrateLegacyOrder(false);
      return;
    }
    const currentOrderMonth = (watchedSoldAt || getTodayDateString()).slice(0, 7);
    setMigrateLegacyOrder(legacySaleInfo.monthKey !== currentOrderMonth);
  }, [legacySaleInfo, watchedSoldAt]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    const list = q
      ? customers.filter((c) => {
          const phoneMatch = c.phones.some((p) =>
            p.number.toLowerCase().includes(q)
          );
          return (
            c.fullName.toLowerCase().includes(q) ||
            c.company.toLowerCase().includes(q) ||
            c.address.toLowerCase().includes(q) ||
            phoneMatch
          );
        })
      : customers;
    return list.slice(0, 40);
  }, [customers, customerSearch]);

  const handleSelectCustomer = (customerId: string) => {
    const target = customers.find((c) => c.id === customerId);
    setValue('customerId', customerId, {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (target) {
      if (!watchedAddress.trim() && target.address) {
        setValue('address', target.address, { shouldDirty: true });
      }
      if (!watchedMapsUrl.trim() && target.googleMapsUrl) {
        setValue('googleMapsUrl', target.googleMapsUrl, { shouldDirty: true });
      }
    }
    setPickerExpanded(false);
  };

  const handleCaptureCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Trình duyệt không hỗ trợ lấy vị trí GPS.');
      return;
    }

    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        const gpsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        setValue('googleMapsUrl', gpsUrl, {
          shouldDirty: true,
          shouldValidate: true,
        });
        setLocatingGps(false);
        toast.success('Đã lấy định vị Google Maps tại vị trí hiện tại.');
      },
      (error) => {
        setLocatingGps(false);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error(
            'Bạn đã từ chối quyền định vị. Hãy bật GPS cho trình duyệt hoặc dán link thủ công.'
          );
        } else if (error.code === error.TIMEOUT) {
          toast.error('Hết thời gian lấy vị trí GPS. Vui lòng thử lại.');
        } else {
          toast.error('Không thể xác định vị trí hiện tại.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  const onSubmit = async (values: OrderFormValues) => {
    const targetCustomer = customers.find((c) => c.id === values.customerId);
    if (!targetCustomer) {
      toast.error('Vui lòng chọn một khách hàng hợp lệ.');
      return;
    }

    const payload = {
      customerId: targetCustomer.id,
      orderCode: values.orderCode,
      soldAt: values.soldAt,
      address: values.address,
      googleMapsUrl: values.googleMapsUrl,
      note: values.note,
      machineCount: editingOrder ? editingOrder.machineCount : 1,
    };

    try {
      const session = await ensureWorkspaceReady();
      if (editingOrder) {
        await updateOrder(
          session.workspaceId,
          editingOrder.id,
          targetCustomer,
          payload
        );
        toast.success(`Đã cập nhật đơn hàng ${values.orderCode}`);
        onOpenChange(false);
        onSaved?.(editingOrder.id);
      } else {
        const wasPromoted = targetCustomer.status !== 'won';
        const newId = await createOrderWithCustomerSync(
          session.workspaceId,
          session.uid,
          targetCustomer,
          payload,
          legacySaleInfo && migrateLegacyOrder
            ? {
                migrateLegacyOrder: true,
                legacySoldAt: legacySaleInfo.dateStr,
                legacyMachineCount: legacySaleInfo.machines,
              }
            : undefined
        );
        toast.success(
          wasPromoted
            ? `Đã tạo đơn ${values.orderCode} và chuyển "${targetCustomer.fullName}" sang Đã bán`
            : `Đã tạo đơn hàng ${values.orderCode}`
        );
        onOpenChange(false);
        onSaved?.(newId);
      }
    } catch (error) {
      console.error('Save order error:', error);
      const message =
        error instanceof Error && error.message.includes('Phiên đăng nhập')
          ? error.message
          : 'Không thể lưu đơn hàng. Vui lòng kiểm tra dữ liệu và thử lại.';
      toast.error(message);
    }
  };

  const previewMapsHref = getMapsHref(watchedMapsUrl, watchedAddress);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Chỉnh sửa đơn hàng' : 'Tạo đơn hàng mới'}
      description={
        isEditing
          ? 'Cập nhật mã đơn, ngày bán, địa chỉ định vị cửa hàng và ghi chú.'
          : 'Mỗi cửa hàng lắp đặt là 1 đơn hàng (1 loa). Chọn khách đã tạo để gắn đơn.'
      }
      maxWidthClass="max-w-xl"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="h-11 sm:h-10 w-full sm:w-auto"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            form="crm-order-form"
            disabled={isSubmitting || customers.length === 0}
            className="h-11 sm:h-10 w-full sm:w-auto"
          >
            {isSubmitting
              ? 'Đang lưu...'
              : isEditing
                ? 'Lưu thay đổi'
                : 'Lưu đơn hàng'}
          </Button>
        </div>
      }
    >
      <form
        id="crm-order-form"
        // @ts-expect-error zod v4 + hookform resolver submit types
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        {/* Customer Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>
              Đơn của khách hàng <span className="text-destructive">*</span>
            </Label>
            {selectedCustomer && !pickerExpanded && (
              <button
                type="button"
                onClick={() => setPickerExpanded(true)}
                className="text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                Đổi khách hàng
              </button>
            )}
          </div>

          <input type="hidden" {...register('customerId')} />

          {selectedCustomer && !pickerExpanded ? (
            <div className="rounded-xl border border-primary/35 bg-primary/5 p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-sm font-semibold text-foreground truncate">
                    {selectedCustomer.fullName}
                  </p>
                </div>
                <span className="text-xs font-medium text-muted-foreground shrink-0">
                  {CUSTOMER_STATUS_META[selectedCustomer.status]?.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono tabular-nums truncate">
                {(selectedCustomer.phones.find((p) => p.isPrimary) ?? selectedCustomer.phones[0])
                  ?.number || 'Chưa có SĐT'}
                {selectedCustomer.company ? ` · ${selectedCustomer.company}` : ''}
              </p>
              {!isEditing && selectedCustomer.status !== 'won' && (
                <p className="text-xs text-primary font-medium pt-0.5">
                  Tự động chuyển trạng thái từ "{CUSTOMER_STATUS_META[selectedCustomer.status]?.label}" sang "Đã bán" khi lưu đơn.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Tìm tên khách hàng, số điện thoại hoặc cửa hàng..."
                  className="pl-9"
                />
              </div>

              {customers.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Chưa có khách hàng nào. Vui lòng bấm nút Thêm khách hàng trước khi tạo đơn.
                </p>
              ) : filteredCustomers.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Không tìm thấy khách hàng phù hợp với "{customerSearch}".
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border bg-background">
                  {filteredCustomers.map((c) => {
                    const primary = c.phones.find((p) => p.isPrimary) ?? c.phones[0];
                    const isSelected = c.id === watchedCustomerId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCustomer(c.id)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10'
                            : 'hover:bg-muted/60'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {c.fullName}
                            {c.company ? (
                              <span className="font-normal text-muted-foreground">
                                {' '}· {c.company}
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono tabular-nums truncate">
                            {primary?.number || 'Chưa có SĐT'}
                            {' · '}
                            <span className="font-sans">
                              {CUSTOMER_STATUS_META[c.status]?.label}
                            </span>
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {errors.customerId && (
            <p className="text-xs text-destructive">{errors.customerId.message}</p>
          )}
        </div>

        {/* Optional legacy preservation notice when first splitting orders for an old won customer */}
        {legacySaleInfo && (
          <label className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 cursor-pointer">
            <input
              type="checkbox"
              checked={migrateLegacyOrder}
              onChange={(e) => setMigrateLegacyOrder(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0"
            />
            <span className="leading-relaxed">
              Khách này đang có lần bán cũ ({formatDateShort(legacySaleInfo.dateStr)} ·{' '}
              {legacySaleInfo.machines} loa) chưa tách thành đơn. Giữ lại lần bán cũ thành 1 đơn riêng để không mất dữ liệu tháng trước.
            </span>
          </label>
        )}

        {/* Order Code & Sale Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 border-t border-border pt-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="crm-orderCode">
              Mã đơn <span className="text-destructive">*</span>
            </Label>
            <Input
              id="crm-orderCode"
              placeholder="Ví dụ: DH-2611-001"
              className="font-mono"
              maxLength={CRM_LIMITS.ORDER_CODE_MAX}
              {...register('orderCode')}
            />
            {errors.orderCode && (
              <p className="text-xs text-destructive">{errors.orderCode.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="crm-orderSoldAt">
              Ngày bán <span className="text-destructive">*</span>
            </Label>
            <Input
              id="crm-orderSoldAt"
              type="date"
              {...register('soldAt')}
            />
            {errors.soldAt && (
              <p className="text-xs text-destructive">{errors.soldAt.message}</p>
            )}
          </div>
        </div>

        {/* Address & Current GPS Location */}
        <div className="space-y-3 border-t border-border pt-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="crm-orderAddress">Địa chỉ cửa hàng</Label>
            <Input
              id="crm-orderAddress"
              placeholder="Số nhà, tên đường, phường/xã của cửa hàng này..."
              maxLength={CRM_LIMITS.ADDRESS_MAX}
              {...register('address')}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="crm-orderMapsUrl">Định vị (Link Google Maps)</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCaptureCurrentLocation}
                  disabled={locatingGps}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15 transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {locatingGps ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LocateFixed className="h-3.5 w-3.5" />
                  )}
                  <span>{locatingGps ? 'Đang lấy GPS...' : 'Lấy vị trí hiện tại'}</span>
                </button>
                {previewMapsHref && (
                  <a
                    href={previewMapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[36px] items-center gap-1 px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Mở thử
                  </a>
                )}
              </div>
            </div>
            <Input
              id="crm-orderMapsUrl"
              placeholder="Nhấn lấy vị trí hiện tại hoặc dán link Google Maps..."
              maxLength={CRM_LIMITS.MAPS_URL_MAX}
              {...register('googleMapsUrl')}
            />
            {errors.googleMapsUrl && (
              <p className="text-xs text-destructive">{errors.googleMapsUrl.message}</p>
            )}
          </div>
        </div>

        {/* Order Note */}
        <div className="space-y-1.5 border-t border-border pt-3.5">
          <Label htmlFor="crm-orderNote">Ghi chú của đơn</Label>
          <Textarea
            id="crm-orderNote"
            rows={2}
            placeholder="Tên cửa hàng/chi nhánh, vị trí đặt loa, ghi chú thanh toán..."
            maxLength={CRM_LIMITS.ORDER_NOTE_MAX}
            className="min-h-[56px] py-2.5"
            {...register('note')}
          />
          {errors.note && (
            <p className="text-xs text-destructive">{errors.note.message}</p>
          )}
        </div>
      </form>
    </Modal>
  );
}
