import { useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  CheckCircle2,
  DatabaseBackup,
  Download,
  FileSpreadsheet,
  FolderUp,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmModal } from '../components/ConfirmModal';
import { Button } from '../components/ui/button';
import { SelectField } from '../components/ui/select-field';
import { useCrm } from '../contexts/CrmContext';
import {
  buildBackupBundle,
  createCustomer,
  restoreCustomersFromBackup,
  type CrmBackupBundle,
  type CustomerInputPayload,
} from '../lib/crm-service';
import {
  downloadExcelTemplate,
  exportCustomersToExcel,
  parseExcelCustomersFile,
} from '../lib/excel';
import { CUSTOMER_STATUS_META } from '../types/crm';

export function DataBackupPage() {
  const { user, profile, workspace, customers, orders } = useCrm();

  const [exportStatusFilter, setExportStatusFilter] = useState<string>('all');
  const [excelPreview, setExcelPreview] = useState<CustomerInputPayload[]>([]);
  const [excelFileName, setExcelFileName] = useState<string>('');
  const [importingExcel, setImportingExcel] = useState(false);

  const [exportingJson, setExportingJson] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<CrmBackupBundle | null>(null);
  const [backupFileName, setBackupFileName] = useState<string>('');
  const [restoreMode, setRestoreMode] = useState<'skip-existing' | 'overwrite-existing'>(
    'skip-existing'
  );
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [restoringJson, setRestoringJson] = useState(false);

  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  const handleExportExcel = async () => {
    const target =
      exportStatusFilter === 'all'
        ? customers
        : customers.filter((c) => c.status === exportStatusFilter);

    if (target.length === 0) {
      toast.error('Không có khách hàng nào khớp bộ lọc để xuất Excel.');
      return;
    }
    try {
      await exportCustomersToExcel(
        target,
        exportStatusFilter === 'all'
          ? 'tat-ca-khach-hang'
          : `khach-hang-${exportStatusFilter}`
      );
      toast.success(`Đã xuất ${target.length} khách hàng ra file Excel`);
    } catch {
      toast.error('Không thể xuất file Excel. Vui lòng thử lại.');
    }
  };

  const handleSelectExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseExcelCustomersFile(file);
      if (parsed.length === 0) {
        toast.error(
          'Không đọc được khách hàng hợp lệ nào. Cần cột "Họ và tên" và "SĐT chính".'
        );
        return;
      }
      setExcelPreview(parsed);
      setExcelFileName(file.name);
      toast.success(`Đã đọc ${parsed.length} dòng hợp lệ từ ${file.name}`);
    } catch (error) {
      console.error('Excel parse error:', error);
      toast.error('File Excel/CSV không đúng định dạng.');
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmImportExcel = async () => {
    if (!user || !workspace || excelPreview.length === 0) return;
    setImportingExcel(true);
    let successCount = 0;
    try {
      for (const item of excelPreview) {
        await createCustomer(workspace.id, user.uid, item);
        successCount += 1;
      }
      toast.success(`Đã nhập thành công ${successCount} khách hàng vào Firestore`);
      setExcelPreview([]);
      setExcelFileName('');
    } catch {
      toast.error(`Đã nhập ${successCount} dòng, gặp sự cố ở các dòng còn lại.`);
    } finally {
      setImportingExcel(false);
    }
  };

  const handleExportJsonBackup = async () => {
    if (!user || !workspace) return;
    setExportingJson(true);
    try {
      const bundle = await buildBackupBundle(workspace, customers, orders, user.uid);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sokhach-crm-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(
        `Đã tải xuống bản sao lưu (${bundle.customers.length} khách hàng, ${bundle.orders?.length ?? 0} đơn hàng)`
      );
    } catch {
      toast.error('Không thể tạo file sao lưu JSON.');
    } finally {
      setExportingJson(false);
    }
  };

  const handleSelectJsonBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as CrmBackupBundle;
      if (
        !parsed ||
        parsed.version !== 1 ||
        !Array.isArray(parsed.customers)
      ) {
        toast.error('File JSON không phải định dạng sao lưu hợp lệ của Sổ Khách CRM.');
        return;
      }
      setPendingBackup(parsed);
      setBackupFileName(file.name);
      toast.info(`Đã nạp bản sao lưu gồm ${parsed.customers.length} khách hàng`);
    } catch {
      toast.error('Không thể đọc file JSON sao lưu.');
    } finally {
      e.target.value = '';
    }
  };

  const handleExecuteRestore = async () => {
    if (!user || !workspace || !pendingBackup) return;
    setRestoringJson(true);
    try {
      const existingIds = new Set(customers.map((c) => c.id));
      const existingOrderIds = new Set(orders.map((o) => o.id));
      const summary = await restoreCustomersFromBackup(
        workspace.id,
        user.uid,
        profile?.displayName || user.displayName || 'Tôi',
        pendingBackup,
        existingIds,
        existingOrderIds,
        restoreMode
      );
      toast.success(
        `Khôi phục xong: thêm ${summary.created} khách, cập nhật ${summary.updated}, bỏ qua ${summary.skipped}${summary.ordersRestored > 0 ? `, đơn hàng ${summary.ordersRestored}` : ''}`
      );
      setPendingBackup(null);
      setBackupFileName('');
      setConfirmRestoreOpen(false);
    } catch {
      toast.error('Quá trình khôi phục dữ liệu gặp lỗi.');
    } finally {
      setRestoringJson(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Section 1: Export Excel */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Xuất danh sách khách hàng ra Excel (.xlsx)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Bao gồm đầy đủ SĐT chính, tất cả SĐT phụ, trạng thái, địa chỉ, link Google Maps và ghi chú.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
          <SelectField
            value={exportStatusFilter}
            onChange={(e) => setExportStatusFilter(e.target.value)}
            wrapperClassName="sm:w-64"
          >
            <option value="all">
              Tất cả khách hàng ({customers.length})
            </option>
            {Object.entries(CUSTOMER_STATUS_META).map(([k, m]) => {
              const count = customers.filter((c) => c.status === k).length;
              return (
                <option key={k} value={k}>
                  {m.label} ({count})
                </option>
              );
            })}
          </SelectField>

          <Button type="button" onClick={handleExportExcel} className="h-11 sm:h-10 w-full sm:w-auto">
            <Download className="h-4 w-4" />
            Tải xuống file Excel
          </Button>
        </div>
      </section>

      {/* Section 2: Import Excel */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Nhập khách hàng từ Excel / CSV
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tải file mẫu để chuẩn hóa cột, sau đó tải lên và xem trước trước khi lưu vào Firestore.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 sm:h-9 w-full sm:w-auto"
            onClick={() => {
              void downloadExcelTemplate();
            }}
          >
            <Download className="h-3.5 w-3.5" />
            Tải file Excel mẫu
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleSelectExcelFile}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-10 w-full sm:w-auto"
            onClick={() => excelInputRef.current?.click()}
          >
            <FolderUp className="h-4 w-4" />
            Chọn file Excel (.xlsx, .csv)
          </Button>
          {excelFileName && (
            <span className="text-xs text-muted-foreground">
              Đã nạp: <strong className="text-foreground">{excelFileName}</strong> ({excelPreview.length} khách)
            </span>
          )}
        </div>

        {excelPreview.length > 0 && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="max-h-56 overflow-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Họ tên</th>
                    <th className="px-3 py-2">Số điện thoại</th>
                    <th className="px-3 py-2">Công ty</th>
                    <th className="px-3 py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {excelPreview.slice(0, 20).map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-medium text-foreground">{row.fullName}</td>
                      <td className="px-3 py-2 font-mono tabular-nums">
                        {row.phones.map((p) => p.number).join(', ')}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{row.company || '—'}</td>
                      <td className="px-3 py-2">{CUSTOMER_STATUS_META[row.status]?.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setExcelPreview([]);
                  setExcelFileName('');
                }}
              >
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={importingExcel}
                onClick={handleConfirmImportExcel}
              >
                <CheckCircle2 className="h-4 w-4" />
                {importingExcel
                  ? 'Đang nhập lên Firestore...'
                  : `Xác nhận nhập ${excelPreview.length} khách hàng`}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Section 3: Full JSON Backup & Restore */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <DatabaseBackup className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Sao lưu &amp; Khôi phục toàn bộ dữ liệu (JSON)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lưu trọn vẹn hồ sơ khách hàng, nhiều số điện thoại, vị trí Google Maps và toàn bộ nhật ký tương tác.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-background p-4 space-y-3">
            <h3 className="text-sm font-medium text-foreground">1. Tạo bản sao lưu</h3>
            <p className="text-xs text-muted-foreground">
              Tải về file <code className="font-mono">.json</code> chứa toàn bộ {customers.length} khách hàng và các ghi chú đính kèm.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleExportJsonBackup}
              disabled={exportingJson}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4" />
              {exportingJson ? 'Đang đóng gói...' : 'Tải bản sao lưu JSON'}
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 space-y-3">
            <h3 className="text-sm font-medium text-foreground">2. Khôi phục từ file JSON</h3>
            <p className="text-xs text-muted-foreground">
              Chọn file sao lưu đã tải trước đó để khôi phục dữ liệu lên Cloud Firestore.
            </p>
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleSelectJsonBackup}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => jsonInputRef.current?.click()}
              className="w-full sm:w-auto"
            >
              <Upload className="h-4 w-4" />
              Chọn file sao lưu (.json)
            </Button>
          </div>
        </div>

        {pendingBackup && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs">
                <p className="font-semibold text-foreground">
                  File: {backupFileName}
                </p>
                <p className="text-muted-foreground">
                  Xuất lúc: {pendingBackup.exportedAt} · Số khách hàng:{' '}
                  <strong className="text-foreground">
                    {pendingBackup.customers.length}
                  </strong>
                </p>
              </div>
              <SelectField
                value={restoreMode}
                onChange={(e) =>
                  setRestoreMode(
                    e.target.value as 'skip-existing' | 'overwrite-existing'
                  )
                }
                wrapperClassName="w-full sm:w-64"
              >
                <option value="skip-existing">Bỏ qua khách hàng đã tồn tại</option>
                <option value="overwrite-existing">Ghi đè cập nhật nếu trùng ID</option>
              </SelectField>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPendingBackup(null);
                  setBackupFileName('');
                }}
              >
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setConfirmRestoreOpen(true)}
              >
                Tiến hành khôi phục
              </Button>
            </div>
          </div>
        )}
      </section>

      <ConfirmModal
        open={confirmRestoreOpen}
        onOpenChange={setConfirmRestoreOpen}
        title="Xác nhận khôi phục dữ liệu?"
        description={`Hệ thống sẽ đồng bộ ${pendingBackup?.customers.length ?? 0} khách hàng từ "${backupFileName}" vào Cloud Firestore theo chế độ "${
          restoreMode === 'skip-existing'
            ? 'Bỏ qua khách hàng đã tồn tại'
            : 'Ghi đè cập nhật nếu trùng ID'
        }".`}
        confirmLabel="Khôi phục ngay"
        loading={restoringJson}
        onConfirm={handleExecuteRestore}
      />
    </div>
  );
}
