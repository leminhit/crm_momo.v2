import { format } from 'date-fns';
import type { CustomerInputPayload } from './crm-service';
import { getCustomerMachineCount } from './payroll';
import {
  CUSTOMER_PRIORITY_META,
  CUSTOMER_STATUS_META,
  type CustomerPriority,
  type CustomerRecord,
  type CustomerStatus,
  type PhoneEntry,
} from '../types/crm';

export async function exportCustomersToExcel(
  customers: CustomerRecord[],
  filenamePrefix = 'khach-hang-crm'
): Promise<void> {
  const XLSX = await import('xlsx');
  const rows = customers.map((c, index) => {
    const primaryPhone = c.phones.find((p) => p.isPrimary) ?? c.phones[0];
    const allPhones = c.phones
      .map((p) => `${p.number} (${p.label}${p.hasZalo ? ' - Zalo' : ''})`)
      .join(' | ');

    return {
      STT: index + 1,
      'Họ và tên': c.fullName,
      'Công ty / Đơn vị': c.company,
      'Chức vụ': c.position,
      'SĐT chính': primaryPhone?.number ?? '',
      'Tất cả SĐT': allPhones,
      Email: c.email,
      'Trạng thái': CUSTOMER_STATUS_META[c.status]?.label ?? c.status,
      'Ưu tiên': CUSTOMER_PRIORITY_META[c.priority]?.label ?? c.priority,
      'Số lượng loa': c.status === 'won' ? getCustomerMachineCount(c) : c.machineCount || '',
      'Ngày bán': c.soldAt || '',
      'Giá trị dự kiến (VNĐ)': c.estimatedValue,
      'Địa chỉ': c.address,
      'Link Google Maps': c.googleMapsUrl,
      'Nguồn khách': c.source,
      Thẻ: c.tags.join(', '),
      'Hẹn chăm sóc': c.nextFollowUpAt,
      'Ghi chú': c.quickNote,
      'Đánh dấu sao': c.isStarred ? 'Có' : 'Không',
      'Ngày tạo': c.createdAt ? format(c.createdAt, 'dd/MM/yyyy HH:mm') : '',
      'Cập nhật': c.updatedAt ? format(c.updatedAt, 'dd/MM/yyyy HH:mm') : '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 5 },
    { wch: 24 },
    { wch: 22 },
    { wch: 16 },
    { wch: 15 },
    { wch: 36 },
    { wch: 24 },
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 34 },
    { wch: 36 },
    { wch: 15 },
    { wch: 20 },
    { wch: 14 },
    { wch: 36 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'KhachHang');
  const dateStamp = format(new Date(), 'yyyy-MM-dd');
  XLSX.writeFile(workbook, `${filenamePrefix}-${dateStamp}.xlsx`);
}

export async function downloadExcelTemplate(): Promise<void> {
  const XLSX = await import('xlsx');
  const sampleRows = [
    {
      'Họ và tên': 'Nguyễn Minh Tuấn',
      'Công ty': 'Công ty TNHH Minh Phát',
      'Chức vụ': 'Giám đốc mua hàng',
      'SĐT chính': '0901234567',
      'SĐT phụ (ngăn cách dấu ;)': '0987654321; 02838123456',
      Email: 'tuan.nguyen@minhphat.vn',
      'Trạng thái': 'Tiềm năng',
      'Ưu tiên': 'Cao',
      'Giá trị dự kiến': 45000000,
      'Địa chỉ': '120 Nguyễn Thị Minh Khai, Quận 3, TP.HCM',
      'Link Google Maps': 'https://maps.google.com/?q=120+Nguyen+Thi+Minh+Khai+Q3+HCMC',
      Nguồn: 'Zalo',
      Thẻ: 'VIP, B2B',
      'Hẹn chăm sóc (YYYY-MM-DD)': format(new Date(), 'yyyy-MM-dd'),
      'Ghi chú': 'Quan tâm gói dịch vụ năm, cần gửi báo giá chi tiết.',
    },
  ];
  const worksheet = XLSX.utils.json_to_sheet(sampleRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'MauNhapKhachHang');
  XLSX.writeFile(workbook, 'mau-nhap-khach-hang-crm.xlsx');
}

function mapVietnameseStatus(raw: string): CustomerStatus {
  const v = raw.trim().toLowerCase();
  if (v.includes('chốt') || v === 'won') return 'won';
  if (v.includes('thương') || v === 'negotiating') return 'negotiating';
  if (v.includes('liên hệ') || v === 'contacted') return 'contacted';
  if (v.includes('chăm') || v === 'care') return 'care';
  if (v.includes('ngưng') || v.includes('hủy') || v === 'lost') return 'lost';
  return 'lead';
}

function mapVietnamesePriority(raw: string): CustomerPriority {
  const v = raw.trim().toLowerCase();
  if (v.includes('cao') || v === 'high') return 'high';
  if (v.includes('thấp') || v === 'low') return 'low';
  return 'medium';
}

export async function parseExcelCustomersFile(
  file: File
): Promise<CustomerInputPayload[]> {
  const [XLSX, buffer] = await Promise.all([import('xlsx'), file.arrayBuffer()]);
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return [];

  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: '',
  });

  const results: CustomerInputPayload[] = [];

  for (const row of jsonRows) {
    const fullName = String(
      row['Họ và tên'] ?? row['Họ tên'] ?? row['fullName'] ?? row['Name'] ?? ''
    ).trim();
    const primaryPhone = String(
      row['SĐT chính'] ?? row['Số điện thoại'] ?? row['SĐT'] ?? row['phone'] ?? ''
    ).trim();
    const extraPhonesRaw = String(
      row['SĐT phụ (ngăn cách dấu ;)'] ?? row['SĐT phụ'] ?? row['Tất cả SĐT'] ?? ''
    ).trim();

    if (!fullName || (!primaryPhone && !extraPhonesRaw)) {
      continue;
    }

    const phones: PhoneEntry[] = [];
    if (primaryPhone) {
      phones.push({
        number: primaryPhone,
        label: 'Di động',
        isPrimary: true,
        hasZalo: true,
      });
    }
    if (extraPhonesRaw) {
      const parts = extraPhonesRaw
        .split(/[;|,]/)
        .map((s) => s.replace(/\(.*?\)/g, '').trim())
        .filter((s) => s.length >= 3 && s !== primaryPhone);
      for (const num of parts) {
        if (phones.length < 10) {
          phones.push({
            number: num,
            label: 'Phụ',
            isPrimary: phones.length === 0,
            hasZalo: true,
          });
        }
      }
    }

    if (phones.length === 0) continue;

    const tagsRaw = String(row['Thẻ'] ?? row['tags'] ?? '');
    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10);

    const rawVal = Number(
      String(row['Giá trị dự kiến'] ?? row['Giá trị dự kiến (VNĐ)'] ?? '0').replace(/[^\d.]/g, '')
    );
    const rawMachines = Number(
      String(row['Số lượng loa'] ?? row['Số loa'] ?? row['machineCount'] ?? '1').replace(/[^\d]/g, '')
    );
    const parsedStatus = mapVietnameseStatus(String(row['Trạng thái'] ?? 'lead'));
    const rawSoldAt = String(row['Ngày bán'] ?? row['soldAt'] ?? '').trim();

    results.push({
      fullName,
      company: String(row['Công ty'] ?? row['Công ty / Đơn vị'] ?? '').trim(),
      position: String(row['Chức vụ'] ?? '').trim(),
      phones,
      email: String(row['Email'] ?? '').trim(),
      address: String(row['Địa chỉ'] ?? '').trim(),
      googleMapsUrl: String(row['Link Google Maps'] ?? '').trim(),
      status: parsedStatus,
      priority: mapVietnamesePriority(String(row['Ưu tiên'] ?? 'medium')),
      source: String(row['Nguồn'] ?? row['Nguồn khách'] ?? '').trim(),
      tags,
      quickNote: String(row['Ghi chú'] ?? '').trim(),
      nextFollowUpAt: String(
        row['Hẹn chăm sóc (YYYY-MM-DD)'] ?? row['Hẹn chăm sóc'] ?? ''
      ).trim(),
      estimatedValue: Number.isFinite(rawVal) ? rawVal : 0,
      isStarred: String(row['Đánh dấu sao'] ?? '').toLowerCase() === 'có',
      soldAt: rawSoldAt,
      machineCount:
        Number.isFinite(rawMachines) && rawMachines >= 1
          ? Math.min(1000, Math.floor(rawMachines))
          : 1,
    });
  }

  return results;
}
