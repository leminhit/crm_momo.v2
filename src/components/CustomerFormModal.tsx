import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ExternalLink,
  Loader2,
  LocateFixed,
  Minus,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Modal } from './ui/modal';
import { SelectField } from './ui/select-field';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import { useCrm } from '../contexts/CrmContext';
import { createCustomer, updateCustomer } from '../lib/crm-service';
import { getCustomerCreatedDate, getTodayDateString } from '../lib/payroll';
import { getMapsHref } from '../lib/utils';
import {
  CRM_LIMITS,
  customerFormSchema,
  parseTagsString,
  type CustomerFormValues,
} from '../lib/validators';
import {
  CUSTOMER_STATUS_META,
  DEFAULT_SOURCES,
  PHONE_LABEL_OPTIONS,
  type CustomerRecord,
  type CustomerStatus,
} from '../types/crm';

interface CustomerFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCustomer?: CustomerRecord | null;
  onSaved?: (customerId: string) => void;
}

const CREATE_STATUS_OPTIONS: Array<{ value: CustomerStatus; label: string }> = [
  { value: 'care', label: 'Chăm sóc sau' },
  { value: 'won', label: 'Đã bán' },
];

export function CustomerFormModal({
  open,
  onOpenChange,
  editingCustomer,
  onSaved,
}: CustomerFormModalProps) {
  const { orders, ensureWorkspaceReady } = useCrm();
  const isEditing = Boolean(editingCustomer);
  const [locatingGps, setLocatingGps] = useState(false);

  const form = useForm<CustomerFormValues>({
    // @ts-expect-error zod v4 + hookform resolver type inference
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      fullName: '',
      company: '',
      position: '',
      phones: [{ number: '', label: 'Di động', isPrimary: true, hasZalo: true }],
      email: '',
      address: '',
      googleMapsUrl: '',
      status: 'care',
      priority: 'medium',
      source: 'Zalo',
      tagsInput: '',
      quickNote: '',
      nextFollowUpAt: '',
      estimatedValue: 0,
      isStarred: false,
      soldAt: '',
      machineCount: 1,
      createdDate: getTodayDateString(),
    },
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'phones',
  });

  useEffect(() => {
    if (!open) return;
    if (editingCustomer) {
      reset({
        fullName: editingCustomer.fullName,
        company: editingCustomer.company,
        position: editingCustomer.position,
        phones:
          editingCustomer.phones.length > 0
            ? editingCustomer.phones
            : [{ number: '', label: 'Di động', isPrimary: true, hasZalo: true }],
        email: editingCustomer.email,
        address: editingCustomer.address,
        googleMapsUrl: editingCustomer.googleMapsUrl,
        status: editingCustomer.status,
        priority: editingCustomer.priority,
        source: editingCustomer.source || 'Zalo',
        tagsInput: editingCustomer.tags.join(', '),
        quickNote: editingCustomer.quickNote,
        nextFollowUpAt: editingCustomer.nextFollowUpAt,
        estimatedValue: editingCustomer.estimatedValue,
        isStarred: editingCustomer.isStarred,
        soldAt:
          editingCustomer.soldAt ||
          (editingCustomer.status === 'won' ? getTodayDateString() : ''),
        machineCount:
          editingCustomer.machineCount >= 1 ? editingCustomer.machineCount : 1,
        createdDate: getCustomerCreatedDate(editingCustomer),
      });
    } else {
      reset({
        fullName: '',
        company: '',
        position: '',
        phones: [{ number: '', label: 'Di động', isPrimary: true, hasZalo: true }],
        email: '',
        address: '',
        googleMapsUrl: '',
        status: 'care',
        priority: 'medium',
        source: 'Zalo',
        tagsInput: '',
        quickNote: '',
        nextFollowUpAt: '',
        estimatedValue: 0,
        isStarred: false,
        soldAt: '',
        machineCount: 1,
        createdDate: getTodayDateString(),
      });
    }
  }, [open, editingCustomer, reset]);

  const watchedPhones = watch('phones');
  const watchedAddress = watch('address');
  const watchedMapsUrl = watch('googleMapsUrl');
  const watchedStarred = watch('isStarred');
  const watchedStatus = watch('status');
  const watchedSoldAt = watch('soldAt');
  const watchedMachineCount = watch('machineCount');

  useEffect(() => {
    if (!open) return;
    if (watchedStatus === 'won') {
      if (!watchedSoldAt) {
        setValue('soldAt', getTodayDateString(), { shouldDirty: true });
      }
      if (!watchedMachineCount || Number(watchedMachineCount) < 1) {
        setValue('machineCount', 1, { shouldDirty: true });
      }
    }
  }, [open, watchedStatus, watchedSoldAt, watchedMachineCount, setValue]);

  const handleSetPrimaryPhone = (targetIdx: number) => {
    watchedPhones.forEach((_, idx) => {
      setValue(`phones.${idx}.isPrimary`, idx === targetIdx, { shouldDirty: true });
    });
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
        toast.success('Đã lấy link Google Maps tại vị trí hiện tại.');
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

  const onSubmit = async (values: CustomerFormValues) => {
    const resolvedSoldAt =
      values.status === 'won'
        ? values.soldAt?.trim() || getTodayDateString()
        : values.soldAt?.trim() || '';
    const resolvedMachineCount =
      values.status === 'won'
        ? Math.max(1, Math.floor(Number(values.machineCount) || 1))
        : Math.max(0, Math.floor(Number(values.machineCount) || 1));

    const resolvedCreatedDate =
      values.createdDate?.trim() ||
      (editingCustomer ? getCustomerCreatedDate(editingCustomer) : getTodayDateString());

    const payload = isEditing
      ? {
          fullName: values.fullName,
          company: values.company,
          position: values.position,
          phones: values.phones,
          email: values.email,
          address: values.address,
          googleMapsUrl: values.googleMapsUrl,
          status: values.status,
          priority: values.priority,
          source: values.source,
          tags: parseTagsString(values.tagsInput),
          quickNote: values.quickNote,
          nextFollowUpAt: values.nextFollowUpAt,
          estimatedValue: Number(values.estimatedValue) || 0,
          isStarred: values.isStarred,
          soldAt: resolvedSoldAt,
          machineCount: resolvedMachineCount,
          createdDate: resolvedCreatedDate,
        }
      : {
          fullName: values.fullName,
          company: values.company,
          position: '',
          phones: values.phones,
          email: '',
          address: values.address,
          googleMapsUrl: values.googleMapsUrl,
          status: values.status === 'won' ? ('won' as const) : ('care' as const),
          priority: 'medium' as const,
          source: 'Zalo',
          tags: [],
          quickNote: values.quickNote,
          nextFollowUpAt: '',
          estimatedValue: 0,
          isStarred: values.isStarred,
          soldAt: resolvedSoldAt,
          machineCount: resolvedMachineCount,
          createdDate: getTodayDateString(),
        };

    try {
      const session = await ensureWorkspaceReady();
      if (editingCustomer) {
        const result = await updateCustomer(
          session.workspaceId,
          editingCustomer.id,
          editingCustomer.assignedTo || session.uid,
          payload,
          {
            ownerId: session.uid,
            existingCustomer: editingCustomer,
            existingOrders: orders,
          }
        );
        if (result.autoOrderCode) {
          toast.success(
            `Đã cập nhật ${values.fullName} & tự động tạo đơn ${result.autoOrderCode}`
          );
        } else {
          toast.success(`Đã cập nhật khách hàng ${values.fullName}`);
        }
        onOpenChange(false);
        onSaved?.(editingCustomer.id);
      } else {
        let autoOrderCode = '';
        const newId = await createCustomer(
          session.workspaceId,
          session.uid,
          payload,
          undefined,
          {
            existingOrders: orders,
            onAutoOrderCreated: (code) => {
              autoOrderCode = code;
            },
          }
        );
        if (autoOrderCode) {
          toast.success(
            `Đã thêm ${values.fullName} & tự động tạo đơn ${autoOrderCode}`
          );
        } else {
          toast.success(`Đã thêm khách hàng ${values.fullName}`);
        }
        onOpenChange(false);
        onSaved?.(newId);
      }
    } catch (error) {
      console.error('Save customer error:', error);
      const message =
        error instanceof Error && error.message.includes('Phiên đăng nhập')
          ? error.message
          : 'Không thể lưu khách hàng. Vui lòng kiểm tra dữ liệu và thử lại.';
      toast.error(message);
    }
  };

  const previewMapsHref = getMapsHref(watchedMapsUrl, watchedAddress);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng nhanh'}
      description={
        isEditing
          ? 'Cập nhật đầy đủ hồ sơ, phân loại trạng thái và thông tin chăm sóc.'
          : 'Nhập nhanh tên, số điện thoại, trạng thái và vị trí hiện tại.'
      }
      maxWidthClass={isEditing ? 'max-w-2xl' : 'max-w-xl'}
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
            form="crm-customer-form"
            disabled={isSubmitting}
            className="h-11 sm:h-10 w-full sm:w-auto"
          >
            {isSubmitting
              ? 'Đang lưu...'
              : isEditing
                ? 'Lưu thay đổi'
                : 'Lưu khách hàng'}
          </Button>
        </div>
      }
    >
      <form
        id="crm-customer-form"
        // @ts-expect-error zod v4 + hookform resolver submit types
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 sm:space-y-5"
      >
        {/* Basic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          <div className="sm:col-span-2 flex items-end gap-2.5">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="crm-fullName">
                Họ và tên <span className="text-destructive">*</span>
              </Label>
              <Input
                id="crm-fullName"
                placeholder="Ví dụ: Nguyễn Minh Tuấn"
                maxLength={CRM_LIMITS.FULL_NAME_MAX}
                {...register('fullName')}
              />
              {errors.fullName && (
                <p className="text-xs text-destructive">{errors.fullName.message}</p>
              )}
            </div>
            <Button
              type="button"
              variant={watchedStarred ? 'default' : 'outline'}
              size="icon"
              onClick={() => setValue('isStarred', !watchedStarred)}
              aria-label="Đánh dấu khách hàng quan trọng"
              title="Đánh dấu sao"
              className="h-11 w-11 sm:h-10 sm:w-10 shrink-0"
            >
              <Star className={`h-4 w-4 ${watchedStarred ? 'fill-current' : ''}`} />
            </Button>
          </div>

          <div className={isEditing ? 'space-y-1.5' : 'sm:col-span-2 space-y-1.5'}>
            <Label htmlFor="crm-company">Công ty / Cửa hàng</Label>
            <Input
              id="crm-company"
              placeholder="Ví dụ: Cửa hàng Minh Phát"
              maxLength={CRM_LIMITS.COMPANY_MAX}
              {...register('company')}
            />
          </div>

          {isEditing && (
            <div className="space-y-1.5">
              <Label htmlFor="crm-position">Chức vụ / Vai trò</Label>
              <Input
                id="crm-position"
                placeholder="Ví dụ: Giám đốc / Chủ shop"
                maxLength={CRM_LIMITS.POSITION_MAX}
                {...register('position')}
              />
            </div>
          )}
        </div>

        {/* Multi-Phone Section */}
        <div className="space-y-2.5 border-t border-border pt-3.5 sm:pt-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Label>
                Số điện thoại <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Tối đa {CRM_LIMITS.PHONES_MAX_ITEMS} số trong cùng một khách hàng.
              </p>
            </div>
            {fields.length < CRM_LIMITS.PHONES_MAX_ITEMS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() =>
                  append({ number: '', label: 'Phụ', isPrimary: false, hasZalo: true })
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm số
              </Button>
            )}
          </div>

          <div className="space-y-2.5">
            {fields.map((field, index) => {
              const isPrimary = watchedPhones[index]?.isPrimary ?? false;
              const hasZalo = watchedPhones[index]?.hasZalo ?? true;
              return (
                <div
                  key={field.id}
                  className="rounded-xl border border-border bg-muted/40 p-3 space-y-2.5"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-1">
                      <Input
                        placeholder="Số điện thoại (vd: 0901234567)"
                        inputMode="tel"
                        className="font-mono"
                        maxLength={CRM_LIMITS.PHONE_MAX}
                        {...register(`phones.${index}.number`)}
                      />
                      {errors.phones?.[index]?.number && (
                        <p className="text-xs text-destructive">
                          {errors.phones[index]?.number?.message}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={fields.length <= 1}
                      onClick={() => {
                        remove(index);
                        if (isPrimary && fields.length > 1) {
                          setTimeout(() => handleSetPrimaryPhone(0), 0);
                        }
                      }}
                      aria-label="Xóa số điện thoại"
                      className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <SelectField
                        {...register(`phones.${index}.label`)}
                        wrapperClassName="w-28"
                        className="h-9 sm:h-8 text-sm sm:text-xs"
                      >
                        {PHONE_LABEL_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </SelectField>

                      <button
                        type="button"
                        onClick={() => handleSetPrimaryPhone(index)}
                        className={`min-h-[36px] sm:min-h-[32px] text-xs font-medium px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                          isPrimary
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background border border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {isPrimary ? 'Số chính' : 'Đặt chính'}
                      </button>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer min-h-[36px]">
                      <Switch
                        checked={hasZalo}
                        onCheckedChange={(checked) =>
                          setValue(`phones.${index}.hasZalo`, checked, { shouldDirty: true })
                        }
                      />
                      <span>Zalo</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
          {errors.phones?.message && (
            <p className="text-xs text-destructive">{errors.phones.message}</p>
          )}
        </div>

        {/* Status Selection */}
        {!isEditing ? (
          <div className="space-y-3 border-t border-border pt-3.5 sm:pt-4">
            <Label>Trạng thái kinh doanh</Label>
            <div className="grid grid-cols-2 gap-2.5">
              {CREATE_STATUS_OPTIONS.map((opt) => {
                const active = watchedStatus === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setValue('status', opt.value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    className={`min-h-[44px] rounded-xl border px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                      active
                        ? opt.value === 'won'
                          ? 'border-emerald-600 bg-emerald-500/12 text-emerald-700 dark:border-emerald-500 dark:text-emerald-300'
                          : 'border-primary bg-primary/12 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 border-t border-border pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="crm-status">Trạng thái kinh doanh</Label>
              <SelectField id="crm-status" {...register('status')}>
                {Object.entries(CUSTOMER_STATUS_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="crm-priority">Mức độ ưu tiên</Label>
              <SelectField id="crm-priority" {...register('priority')}>
                <option value="high">Cao</option>
                <option value="medium">Trung bình</option>
                <option value="low">Thấp</option>
              </SelectField>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="crm-value">Giá trị dự kiến (VNĐ)</Label>
              <Input
                id="crm-value"
                type="number"
                min={0}
                step={100000}
                className="font-mono tabular-nums"
                {...register('estimatedValue')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="crm-source">Nguồn khách hàng</Label>
              <SelectField id="crm-source" {...register('source')}>
                <option value="">Chọn nguồn...</option>
                {DEFAULT_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="crm-followup">Ngày hẹn chăm sóc</Label>
              <Input id="crm-followup" type="date" {...register('nextFollowUpAt')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="crm-createdDate">Ngày tạo khách</Label>
              <Input
                id="crm-createdDate"
                type="date"
                className="font-mono tabular-nums"
                {...register('createdDate')}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="crm-email">Email</Label>
              <Input
                id="crm-email"
                type="email"
                placeholder="name@company.vn"
                maxLength={CRM_LIMITS.EMAIL_MAX}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>
        )}

        {/* Sale Date & Speaker/Store Quantity when Won */}
        {watchedStatus === 'won' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 border-t border-border pt-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="crm-machineCount">
                Số lượng loa (cửa hàng) <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const current = Math.max(1, Number(watchedMachineCount) || 1);
                    setValue('machineCount', Math.max(1, current - 1), { shouldDirty: true });
                  }}
                  aria-label="Giảm số lượng loa"
                  className="h-11 w-11 sm:h-10 sm:w-10 shrink-0"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  id="crm-machineCount"
                  type="number"
                  min={1}
                  max={CRM_LIMITS.MACHINE_COUNT_MAX}
                  className="text-center font-mono tabular-nums"
                  {...register('machineCount')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const current = Math.max(0, Number(watchedMachineCount) || 0);
                    setValue(
                      'machineCount',
                      Math.min(CRM_LIMITS.MACHINE_COUNT_MAX, current + 1),
                      { shouldDirty: true }
                    );
                  }}
                  aria-label="Tăng số lượng loa"
                  className="h-11 w-11 sm:h-10 sm:w-10 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                1 cửa hàng lắp đặt = 1 loa (dùng để tính hoa hồng).
              </p>
              {errors.machineCount && (
                <p className="text-xs text-destructive">{errors.machineCount.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="crm-soldAt">Ngày bán</Label>
              <Input id="crm-soldAt" type="date" {...register('soldAt')} />
              <p className="text-xs text-muted-foreground">
                Tự điền hôm nay khi chốt, dùng phân loại theo tháng.
              </p>
            </div>
          </div>
        )}

        {/* Address & Current GPS Google Maps URL */}
        <div className="space-y-3 border-t border-border pt-3.5 sm:pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="crm-address">Địa chỉ / Khu vực</Label>
            <Input
              id="crm-address"
              placeholder="Số nhà, tên đường, phường/xã..."
              maxLength={CRM_LIMITS.ADDRESS_MAX}
              {...register('address')}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="crm-mapsUrl">Link Google Maps</Label>
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
              id="crm-mapsUrl"
              placeholder="Nhấn lấy vị trí hiện tại hoặc dán link Google Maps..."
              maxLength={CRM_LIMITS.MAPS_URL_MAX}
              {...register('googleMapsUrl')}
            />
            {errors.googleMapsUrl && (
              <p className="text-xs text-destructive">{errors.googleMapsUrl.message}</p>
            )}
          </div>
        </div>

        {/* Tags (Edit only) & Compact Quick Note */}
        <div className="space-y-3.5 border-t border-border pt-3.5 sm:pt-4">
          {isEditing && (
            <div className="space-y-1.5">
              <Label htmlFor="crm-tags">Thẻ phân loại (ngăn cách bằng dấu phẩy)</Label>
              <Input
                id="crm-tags"
                placeholder="VIP, Đại lý cấp 1, Miền Nam"
                {...register('tagsInput')}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="crm-note">Ghi chú nhanh</Label>
            <Textarea
              id="crm-note"
              rows={1}
              placeholder="Ghi chú ngắn về khách hàng..."
              maxLength={CRM_LIMITS.QUICK_NOTE_MAX}
              className="min-h-[44px] sm:min-h-[72px] py-2.5"
              {...register('quickNote')}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
