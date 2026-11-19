import { useState } from 'react';
import {
  FileSpreadsheet,
  MapPin,
  MessageCircle,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { Button } from './ui/button';
import { useTheme } from '../contexts/ThemeContext';
import { useCrm } from '../contexts/CrmContext';

const HERO_IMAGE_URL = '/src/assets/images/login_workspace_studio_1795115542180.jpg';

export function LoginView() {
  const { signInWithGoogle, signingIn } = useCrm();
  const { theme, toggleTheme } = useTheme();
  const [imgError, setImgError] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm">
            SK
          </div>
          <span className="text-base font-semibold tracking-tight whitespace-nowrap">
            Sổ Khách CRM
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          aria-label="Chuyển giao diện sáng tối"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="hidden sm:inline">{theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}</span>
        </Button>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-10 lg:py-16 flex items-center">
        <div className="grid w-full grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          {/* Left: Authentication & Core Value */}
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-medium text-primary tracking-wide">
                CRM Cá Nhân · Sẵn Sàng Mở Rộng Team
              </p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-tight text-balance">
                Quản lý khách hàng nhanh gọn, đồng bộ thực tế trên Cloud Firestore.
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
                Lưu trữ nhiều số điện thoại trong một hồ sơ, mở nhanh Zalo và Google Maps, ghi chú lịch sử trao đổi, xuất Excel và sao lưu toàn bộ dữ liệu bất cứ lúc nào.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-4 max-w-md">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Đăng nhập không gian làm việc
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Dữ liệu khách hàng được cách ly riêng tư theo tài khoản Google của bạn.
                </p>
              </div>

              <Button
                type="button"
                size="lg"
                onClick={signInWithGoogle}
                disabled={signingIn}
                className="w-full h-12 text-sm font-medium"
              >
                {signingIn ? (
                  'Đang kết nối Google...'
                ) : (
                  <>
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                      />
                    </svg>
                    <span>Tiếp tục với Google</span>
                  </>
                )}
              </Button>

              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                <span>Bảo vệ bởi Firebase Authentication & Firestore Rules</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-border">
              <div className="space-y-1">
                <Phone className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium text-foreground">Đa số điện thoại</p>
                <p className="text-xs text-muted-foreground">Quản lý tới 10 số / khách</p>
              </div>
              <div className="space-y-1">
                <MessageCircle className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium text-foreground">Mở nhanh Zalo</p>
                <p className="text-xs text-muted-foreground">Nhắn tin chỉ với 1 chạm</p>
              </div>
              <div className="space-y-1">
                <MapPin className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium text-foreground">Google Maps</p>
                <p className="text-xs text-muted-foreground">Không cần API trả phí</p>
              </div>
              <div className="space-y-1">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium text-foreground">Excel & JSON</p>
                <p className="text-xs text-muted-foreground">Xuất, nhập & khôi phục</p>
              </div>
            </div>
          </div>

          {/* Right: Editorial Studio Image */}
          <div className="lg:col-span-6 flex">
            <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-muted min-h-[280px] lg:min-h-[460px]">
              {!imgError ? (
                <img
                  src={HERO_IMAGE_URL}
                  alt="Không gian làm việc quản lý khách hàng chuyên nghiệp"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-primary/15 via-muted to-secondary p-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl font-semibold">
                    SK
                  </div>
                  <p className="mt-4 text-base font-semibold text-foreground">
                    Sổ Khách CRM
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                    Nhanh · Đơn giản · Trực quan · Chuyên nghiệp
                  </p>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/35 to-transparent p-6 text-white">
                <p className="text-sm font-medium">
                  Thiết kế tối ưu cho thao tác một tay trên di động và bảng dữ liệu trên máy tính.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
