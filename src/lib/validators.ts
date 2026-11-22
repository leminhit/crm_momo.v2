import { z } from 'zod';

// Synchronized verbatim with firebase-blueprint.json limits
export const CRM_LIMITS = {
  ID_MAX: 128,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  FULL_NAME_MAX: 120,
  COMPANY_MAX: 120,
  POSITION_MAX: 100,
  PHONE_MIN: 3,
  PHONE_MAX: 30,
  PHONE_LABEL_MAX: 40,
  PHONES_MAX_ITEMS: 10,
  EMAIL_MAX: 160,
  ADDRESS_MAX: 300,
  MAPS_URL_MAX: 500,
  SOURCE_MAX: 80,
  TAG_MAX: 40,
  TAGS_MAX_ITEMS: 10,
  QUICK_NOTE_MAX: 2000,
  NEXT_FOLLOWUP_MAX: 32,
  SOLD_AT_MAX: 32,
  MACHINE_COUNT_MAX: 1000,
  ORDER_CODE_MAX: 60,
  ORDER_NOTE_MAX: 1000,
  NOTE_CONTENT_MAX: 3000,
  WORKSPACE_NAME_MAX: 100,
} as const;

export const phoneEntrySchema = z.object({
  number: z
    .string()
    .trim()
    .min(CRM_LIMITS.PHONE_MIN, 'Số điện thoại tối thiểu 3 ký tự')
    .max(CRM_LIMITS.PHONE_MAX, `Số điện thoại tối đa ${CRM_LIMITS.PHONE_MAX} ký tự`),
  label: z
    .string()
    .trim()
    .max(CRM_LIMITS.PHONE_LABEL_MAX, `Nhãn tối đa ${CRM_LIMITS.PHONE_LABEL_MAX} ký tự`)
    .default('Di động'),
  isPrimary: z.boolean().default(false),
  hasZalo: z.boolean().default(true),
});

export const customerFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập họ và tên khách hàng')
    .max(CRM_LIMITS.FULL_NAME_MAX, `Tối đa ${CRM_LIMITS.FULL_NAME_MAX} ký tự`),
  company: z
    .string()
    .trim()
    .max(CRM_LIMITS.COMPANY_MAX, `Tối đa ${CRM_LIMITS.COMPANY_MAX} ký tự`)
    .default(''),
  position: z
    .string()
    .trim()
    .max(CRM_LIMITS.POSITION_MAX, `Tối đa ${CRM_LIMITS.POSITION_MAX} ký tự`)
    .default(''),
  phones: z
    .array(phoneEntrySchema)
    .min(1, 'Cần ít nhất 1 số điện thoại')
    .max(CRM_LIMITS.PHONES_MAX_ITEMS, `Tối đa ${CRM_LIMITS.PHONES_MAX_ITEMS} số điện thoại`),
  email: z
    .string()
    .trim()
    .max(CRM_LIMITS.EMAIL_MAX, `Tối đa ${CRM_LIMITS.EMAIL_MAX} ký tự`)
    .refine((val) => val === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Email không đúng định dạng',
    })
    .default(''),
  address: z
    .string()
    .trim()
    .max(CRM_LIMITS.ADDRESS_MAX, `Tối đa ${CRM_LIMITS.ADDRESS_MAX} ký tự`)
    .default(''),
  googleMapsUrl: z
    .string()
    .trim()
    .max(CRM_LIMITS.MAPS_URL_MAX, `Tối đa ${CRM_LIMITS.MAPS_URL_MAX} ký tự`)
    .refine(
      (val) => val === '' || /^https?:\/\/.+/i.test(val),
      'Link Google Maps phải bắt đầu bằng http:// hoặc https://'
    )
    .default(''),
  status: z.enum(['lead', 'contacted', 'negotiating', 'won', 'care', 'lost']),
  priority: z.enum(['low', 'medium', 'high']),
  source: z
    .string()
    .trim()
    .max(CRM_LIMITS.SOURCE_MAX, `Tối đa ${CRM_LIMITS.SOURCE_MAX} ký tự`)
    .default(''),
  tagsInput: z.string().default(''),
  quickNote: z
    .string()
    .trim()
    .max(CRM_LIMITS.QUICK_NOTE_MAX, `Tối đa ${CRM_LIMITS.QUICK_NOTE_MAX} ký tự`)
    .default(''),
  nextFollowUpAt: z
    .string()
    .trim()
    .max(CRM_LIMITS.NEXT_FOLLOWUP_MAX)
    .default(''),
  estimatedValue: z.coerce
    .number()
    .min(0, 'Giá trị dự kiến không thể âm')
    .default(0),
  isStarred: z.boolean().default(false),
  soldAt: z
    .string()
    .trim()
    .max(CRM_LIMITS.SOLD_AT_MAX)
    .default(''),
  machineCount: z.coerce
    .number()
    .int('Số lượng loa phải là số nguyên')
    .min(0, 'Số lượng loa không thể âm')
    .max(CRM_LIMITS.MACHINE_COUNT_MAX, `Tối đa ${CRM_LIMITS.MACHINE_COUNT_MAX} loa`)
    .default(1),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export const customerNoteSchema = z.object({
  type: z.enum(['note', 'call', 'zalo', 'meeting', 'visit']),
  content: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập nội dung ghi chú')
    .max(CRM_LIMITS.NOTE_CONTENT_MAX, `Tối đa ${CRM_LIMITS.NOTE_CONTENT_MAX} ký tự`),
});

export type CustomerNoteFormValues = z.infer<typeof customerNoteSchema>;

export const orderFormSchema = z.object({
  customerId: z
    .string()
    .trim()
    .min(1, 'Vui lòng chọn khách hàng cho đơn hàng'),
  orderCode: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập mã đơn')
    .max(CRM_LIMITS.ORDER_CODE_MAX, `Mã đơn tối đa ${CRM_LIMITS.ORDER_CODE_MAX} ký tự`),
  soldAt: z
    .string()
    .trim()
    .min(1, 'Vui lòng chọn ngày bán')
    .max(CRM_LIMITS.SOLD_AT_MAX),
  address: z
    .string()
    .trim()
    .max(CRM_LIMITS.ADDRESS_MAX, `Tối đa ${CRM_LIMITS.ADDRESS_MAX} ký tự`)
    .default(''),
  googleMapsUrl: z
    .string()
    .trim()
    .max(CRM_LIMITS.MAPS_URL_MAX, `Tối đa ${CRM_LIMITS.MAPS_URL_MAX} ký tự`)
    .refine(
      (val) => val === '' || /^https?:\/\/.+/i.test(val),
      'Link Google Maps phải bắt đầu bằng http:// hoặc https://'
    )
    .default(''),
  note: z
    .string()
    .trim()
    .max(CRM_LIMITS.ORDER_NOTE_MAX, `Tối đa ${CRM_LIMITS.ORDER_NOTE_MAX} ký tự`)
    .default(''),
});

export type OrderFormValues = z.infer<typeof orderFormSchema>;

export function parseTagsString(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim().slice(0, CRM_LIMITS.TAG_MAX))
    .filter(Boolean)
    .slice(0, CRM_LIMITS.TAGS_MAX_ITEMS);
}
