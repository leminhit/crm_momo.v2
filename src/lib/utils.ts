import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateFirestoreId(prefix = ''): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${random}` : random;
}

export function normalizePhoneForDial(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return hasPlus ? `+${digits}` : digits;
}

export function normalizePhoneForZalo(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  // Zalo accepts local 0xxxxxxxxx or international 84xxxxxxxxx; normalize +84/0 to clean format
  if (digits.startsWith('84') && digits.length >= 10) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

export function getZaloUrl(rawPhone: string): string {
  const normalized = normalizePhoneForZalo(rawPhone);
  return normalized ? `https://zalo.me/${normalized}` : '';
}

export function getMapsHref(googleMapsUrl?: string, address?: string): string {
  const trimmedUrl = (googleMapsUrl ?? '').trim();
  if (trimmedUrl && /^https?:\/\//i.test(trimmedUrl)) {
    return trimmedUrl;
  }
  const trimmedAddress = (address ?? '').trim();
  if (trimmedAddress) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmedAddress)}`;
  }
  return '';
}

export function formatCurrencyVnd(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'KH';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
