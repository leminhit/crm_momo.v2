import { useState } from 'react';
import {
  CalendarClock,
  FileSpreadsheet,
  LayoutDashboard,
  Moon,
  Plus,
  Settings,
  Sun,
  Users,
} from 'lucide-react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { CustomerDetailDrawer } from './CustomerDetailDrawer';
import { CustomerFormModal } from './CustomerFormModal';
import { Button } from './ui/button';
import { useCrm } from '../contexts/CrmContext';
import { useTheme } from '../contexts/ThemeContext';
import { getInitials } from '../lib/utils';
import { CustomersPage } from '../pages/CustomersPage';
import { DashboardPage } from '../pages/DashboardPage';
import { DataBackupPage } from '../pages/DataBackupPage';
import { FollowUpsPage } from '../pages/FollowUpsPage';
import { SettingsPage } from '../pages/SettingsPage';
import type { CustomerRecord } from '../types/crm';

const NAV_ITEMS = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Khách hàng', icon: Users, end: false },
  { to: '/follow-ups', label: 'Chăm sóc', icon: CalendarClock, end: false },
  { to: '/data', label: 'Excel & Sao lưu', icon: FileSpreadsheet, end: false },
  { to: '/settings', label: 'Cài đặt', icon: Settings, end: false },
];

const MOBILE_TABS = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Khách hàng', icon: Users, end: false },
  { to: '/follow-ups', label: 'Chăm sóc', icon: CalendarClock, end: false },
  { to: '/data', label: 'Dữ liệu', icon: FileSpreadsheet, end: false },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Tổng quan CRM',
  '/customers': 'Danh sách khách hàng',
  '/follow-ups': 'Lịch hẹn & Chăm sóc',
  '/data': 'Xuất Excel & Sao lưu',
  '/settings': 'Cài đặt hệ thống',
};

export function AppShell() {
  const { user, profile, workspace, customers } = useCrm();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const selectedCustomer =
    customers.find((c) => c.id === selectedCustomerId) ?? null;

  const currentTitle = PAGE_TITLES[location.pathname] ?? 'Sổ Khách CRM';

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (customer: CustomerRecord) => {
    setEditingCustomer(customer);
    setFormOpen(true);
  };

  const handleSelectCustomer = (customer: CustomerRecord) => {
    setSelectedCustomerId(customer.id);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop Sidebar (248px) */}
      <aside className="hidden md:flex md:w-[248px] md:flex-col md:fixed md:inset-y-0 border-r border-border bg-card z-30">
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-xs">
            SK
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
              {workspace?.name || 'Sổ Khách CRM'}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {workspace?.mode === 'team' ? 'Team Workspace' : 'Cá nhân'}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3 overflow-y-auto" aria-label="Điều hướng chính">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <NavLink
            to="/settings"
            className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-muted transition-colors"
          >
            {profile?.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.displayName}
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-full object-cover shrink-0 border border-border"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
                {getInitials(profile?.displayName || user?.email || 'U')}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {profile?.displayName || user?.displayName}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </NavLink>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-[248px] min-w-0 overflow-x-hidden">
        {/* Top Bar (54px mobile, 56px desktop) */}
        <header className="sticky top-0 z-20 flex h-[54px] md:h-14 items-center justify-between gap-3 border-b border-border bg-card/90 backdrop-blur-md px-3.5 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex md:hidden h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">
              SK
            </div>
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground">
              {currentTitle}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={toggleTheme}
              aria-label="Đổi chế độ Sáng Tối"
              title="Đổi giao diện Sáng/Tối"
              className="h-10 w-10 sm:h-9 sm:w-9"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            <NavLink
              to="/settings"
              className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              aria-label="Cài đặt"
            >
              <Settings className="h-4 w-4" />
            </NavLink>

            <Button
              type="button"
              size="sm"
              onClick={handleOpenCreate}
              className="h-10 sm:h-9 px-3 sm:px-4"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Thêm khách hàng</span>
              <span className="sm:hidden">Thêm</span>
            </Button>
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 px-4 sm:px-6 py-5 sm:py-6 pb-24 md:pb-8 max-w-7xl w-full mx-auto">
          <Routes>
            <Route
              path="/"
              element={
                <DashboardPage
                  onAddCustomer={handleOpenCreate}
                  onSelectCustomer={handleSelectCustomer}
                />
              }
            />
            <Route
              path="/customers"
              element={
                <CustomersPage
                  onAddCustomer={handleOpenCreate}
                  onEditCustomer={handleOpenEdit}
                  onSelectCustomer={handleSelectCustomer}
                />
              }
            />
            <Route
              path="/follow-ups"
              element={<FollowUpsPage onSelectCustomer={handleSelectCustomer} />}
            />
            <Route path="/data" element={<DataBackupPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>

      {/* Mobile Fixed Bottom Tab Bar (<= 15% mobile viewport height) */}
      <nav
        aria-label="Điều hướng di động"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-4 h-14">
          {MOBILE_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Create / Edit Customer Modal */}
      <CustomerFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        editingCustomer={editingCustomer}
      />

      {/* Customer Detail Drawer */}
      <CustomerDetailDrawer
        customer={selectedCustomer}
        open={Boolean(selectedCustomer)}
        onOpenChange={(open) => {
          if (!open) setSelectedCustomerId(null);
        }}
        onEdit={handleOpenEdit}
      />
    </div>
  );
}
