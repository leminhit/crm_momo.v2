import { useState } from 'react';
import { Layers, LogOut, Moon, Shield, Smartphone, Sun, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { SelectField } from '../components/ui/select-field';
import { useCrm } from '../contexts/CrmContext';
import { useTheme } from '../contexts/ThemeContext';
import { renameWorkspace } from '../lib/crm-service';
import { CRM_LIMITS } from '../lib/validators';
import { DataBackupPage } from './DataBackupPage';

export function SettingsPage() {
  const { user, profile, workspace, signOut, updateLocalWorkspaceName } = useCrm();
  const { theme, toggleTheme } = useTheme();

  const [wsName, setWsName] = useState(workspace?.name || 'CRM Cá Nhân');
  const [wsMode, setWsMode] = useState<'personal' | 'team'>(
    workspace?.mode || 'personal'
  );
  const [savingWs, setSavingWs] = useState(false);

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    const trimmed = wsName.trim();
    if (!trimmed) {
      toast.error('Tên không gian làm việc không được để trống.');
      return;
    }
    setSavingWs(true);
    try {
      await renameWorkspace(workspace.id, trimmed, wsMode);
      updateLocalWorkspaceName(trimmed, wsMode);
      toast.success('Đã cập nhật cài đặt không gian làm việc');
    } catch {
      toast.error('Không thể cập nhật cài đặt workspace.');
    } finally {
      setSavingWs(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* PWA / Add to Home Screen (iPhone & Android) */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Cài đặt như App trên iPhone / Android
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Thêm Sổ Khách CRM ra màn hình chính để mở nhanh một chạm ở chế độ toàn màn hình, không còn thanh địa chỉ trình duyệt.
            </p>
          </div>
        </div>
        <PWAInstallButton variant="card" />
      </section>

      {/* Workspace Settings */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Không gian làm việc (Workspace)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Dữ liệu được tổ chức theo Workspace để sẵn sàng mở rộng sang Team CRM nhiều thành viên.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveWorkspace} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name">Tên không gian làm việc</Label>
              <Input
                id="ws-name"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                maxLength={CRM_LIMITS.WORKSPACE_NAME_MAX}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ws-mode">Chế độ vận hành</Label>
              <SelectField
                id="ws-mode"
                value={wsMode}
                onChange={(e) => setWsMode(e.target.value as 'personal' | 'team')}
              >
                <option value="personal">Cá nhân (Personal CRM)</option>
                <option value="team">Nhóm kinh doanh (Team Ready)</option>
              </SelectField>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span>Kiến trúc mở rộng Team CRM</span>
            </div>
            <p className="leading-relaxed">
              Workspace ID:{' '}
              <code className="font-mono text-foreground break-all">{workspace?.id}</code> · Phân quyền thành viên được bảo vệ qua subcollection{' '}
              <code className="font-mono text-foreground">members</code> và trường{' '}
              <code className="font-mono text-foreground">assignedTo</code> trên từng hồ sơ khách hàng.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={savingWs}>
              {savingWs ? 'Đang lưu...' : 'Lưu cài đặt'}
            </Button>
          </div>
        </form>
      </section>

      {/* Theme Preference */}
      <section className="rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
            {theme === 'dark' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Giao diện Sáng / Tối
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Đang sử dụng chế độ {theme === 'dark' ? 'Tối (Dark Mode)' : 'Sáng (Light Mode)'}.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={toggleTheme} className="h-10 w-full sm:w-auto">
          {theme === 'dark' ? 'Chuyển Sáng' : 'Chuyển Tối'}
        </Button>
      </section>

      {/* Account & Security */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">
              Tài khoản đang đăng nhập
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {profile?.displayName || user?.displayName} · {user?.email}
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={signOut}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-10 w-full sm:w-auto"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất tài khoản
          </Button>
        </div>
      </section>

      {/* Excel Export/Import & JSON Backup (relocated from bottom tab) */}
      <div id="backup" className="space-y-4 pt-2 border-t border-border">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Xuất Excel &amp; Sao lưu dữ liệu
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Xuất danh sách khách hàng, nhập từ file Excel có sẵn hoặc tải bản sao lưu JSON toàn bộ hệ thống.
          </p>
        </div>
        <DataBackupPage />
      </div>
    </div>
  );
}
