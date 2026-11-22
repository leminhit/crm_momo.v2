import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Banknote,
  CalendarClock,
  LayoutDashboard,
  Moon,
  Plus,
  Settings,
  ShoppingBag,
  Sun,
  Users,
} from 'lucide-react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { CustomerFormModal } from './CustomerFormModal';
import { OfflineIndicator } from './OfflineIndicator';
import { PWAInstallButton } from './PWAInstallButton';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { useCrm } from '../contexts/CrmContext';
import { useTheme } from '../contexts/ThemeContext';
import { getInitials } from '../lib/utils';
import { DashboardPage } from '../pages/DashboardPage';
import type { CustomerRecord } from '../types/crm';

const loadCustomersPage = () => import('../pages/CustomersPage');
const loadOrdersPage = () => import('../pages/OrdersPage');
const loadPayrollPage = () => import('../pages/PayrollPage');
const loadFollowUpsPage = () => import('../pages/FollowUpsPage');
const loadSettingsPage = () => import('../pages/SettingsPage');
const loadCustomerDetailDrawer = () => import('./CustomerDetailDrawer');

const CustomersPage = lazy(() =>
  loadCustomersPage().then((m) => ({ default: m.CustomersPage }))
);
const OrdersPage = lazy(() =>
  loadOrdersPage().then((m) => ({ default: m.OrdersPage }))
);
const PayrollPage = lazy(() =>
  loadPayrollPage().then((m) => ({ default: m.PayrollPage }))
);
const FollowUpsPage = lazy(() =>
  loadFollowUpsPage().then((m) => ({ default: m.FollowUpsPage }))
);
const SettingsPage = lazy(() =>
  loadSettingsPage().then((m) => ({ default: m.SettingsPage }))
);
const CustomerDetailDrawer = lazy(() =>
  loadCustomerDetailDrawer().then((m) => ({ default: m.CustomerDetailDrawer }))
);

function RoutePageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

const NAV_ITEMS = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Khách hàng', icon: Users, end: false },
  { to: '/orders', label: 'Đơn hàng', icon: ShoppingBag, end: false },
  { to: '/payroll', label: 'Bảng lương', icon: Banknote, end: false },
  { to: '/follow-ups', label: 'Chăm sóc', icon: CalendarClock, end: false },
  { to: '/settings', label: 'Cài đặt', icon: Settings, end: false },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Tổng quan CRM',
  '/customers': 'Danh sách khách hàng',
  '/orders': 'Quản lý đơn hàng',
  '/payroll': 'Bảng lương & Hoa hồng',
  '/follow-ups': 'Lịch hẹn & Chăm sóc',
  '/settings': 'Cài đặt & Dữ liệu',
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

  useEffect(() => {
    let idleId: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const prefetchChunks = () => {
      void loadCustomersPage();
      void loadOrdersPage();
      void loadPayrollPage();
      void loadCustomerDetailDrawer();
    };

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === 'function') {
      idleId = win.requestIdleCallback(prefetchChunks, { timeout: 2000 });
    } else {
      timerId = setTimeout(prefetchChunks, 1200);
    }

    return () => {
      if (idleId !== null && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleId);
      }
      if (timerId !== null) {
        clearTimeout(timerId);
      }
    };
  }, []);

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
            <PWAInstallButton variant="header" />

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
              to="/orders"
              className={({ isActive }) =>
                `md:hidden inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
              aria-label="Đơn hàng"
            >
              <ShoppingBag className="h-4 w-4 shrink-0" />
              <span>Đơn hàng</span>
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `md:hidden flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted'
                }`
              }
              aria-label="Cài đặt"
            >
              <Settings className="h-4 w-4" />
            </NavLink>

            <Button
              type="button"
              size="sm"
              onClick={handleOpenCreate}
              className="hidden md:inline-flex h-9 px-4"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm khách hàng</span>
            </Button>
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 px-4 sm:px-6 py-5 sm:py-6 pb-24 md:pb-8 max-w-7xl w-full mx-auto">
          <Suspense fallback={<RoutePageFallback />}>
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
                path="/orders"
                element={<OrdersPage onSelectCustomer={handleSelectCustomer} />}
              />
              <Route
                path="/payroll"
                element={
                  <PayrollPage
                    onSelectCustomer={handleSelectCustomer}
                    onEditCustomer={handleOpenEdit}
                    onAddCustomer={handleOpenCreate}
                  />
                }
              />
              <Route
                path="/follow-ups"
                element={<FollowUpsPage onSelectCustomer={handleSelectCustomer} />}
              />
              <Route path="/data" element={<Navigate to="/settings" replace />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      {/* Mobile Fixed Bottom Tab Bar (5 Columns with Center Quick-Add CTA) */}
      <nav
        aria-label="Điều hướng di động"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-5 h-16 items-center px-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-[10px] font-medium whitespace-nowrap transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>Tổng quan</span>
          </NavLink>

          <NavLink
            to="/customers"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-[10px] font-medium whitespace-nowrap transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Users className="h-5 w-5" />
            <span>Khách hàng</span>
          </NavLink>

          <div className="flex items-center justify-center px-1">
            <button
              type="button"
              onClick={handleOpenCreate}
              aria-label="Thêm nhanh khách hàng"
              className="flex flex-col items-center justify-center w-full h-11 rounded-xl bg-primary text-primary-foreground shadow-sm active:scale-[0.97] transition-transform cursor-pointer"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[10px] font-semibold leading-none mt-0.5 whitespace-nowrap">
                Thêm
              </span>
            </button>
          </div>

          <NavLink
            to="/payroll"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-[10px] font-medium whitespace-nowrap transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Banknote className="h-5 w-5" />
            <span>Bảng lương</span>
          </NavLink>

          <NavLink
            to="/follow-ups"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-[10px] font-medium whitespace-nowrap transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <CalendarClock className="h-5 w-5" />
            <span>Chăm sóc</span>
          </NavLink>
        </div>
      </nav>

      <OfflineIndicator />

      {/* Create / Edit Customer Modal */}
      <CustomerFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        editingCustomer={editingCustomer}
      />

      {/* Customer Detail Drawer */}
      {selectedCustomer && (
        <Suspense fallback={null}>
          <CustomerDetailDrawer
            customer={selectedCustomer}
            open={Boolean(selectedCustomer)}
            onOpenChange={(open) => {
              if (!open) setSelectedCustomerId(null);
            }}
            onEdit={handleOpenEdit}
          />
        </Suspense>
      )}
    </div>
  );
}
