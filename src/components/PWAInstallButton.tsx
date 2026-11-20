import { useState } from 'react';
import { CheckCircle2, Download, PlusSquare, Share, Smartphone } from 'lucide-react';
import { Button } from './ui/button';
import { Modal } from './ui/modal';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'card';
}

export function PWAInstallButton({ variant = 'header' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    if (variant === 'header') return null;
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>Đang chạy ở chế độ ứng dụng Màn hình chính (Standalone).</span>
      </div>
    );
  }

  const handleAction = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowIOSGuide(true);
  };

  if (variant === 'header' && !isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      {variant === 'header' ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAction}
          className="h-10 sm:h-9 px-2.5 sm:px-3"
          title="Thêm vào màn hình chính"
        >
          <Smartphone className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">Cài App</span>
        </Button>
      ) : (
        <Button
          type="button"
          variant="default"
          onClick={handleAction}
          className="h-11 sm:h-10 w-full sm:w-auto"
        >
          {isInstallable ? (
            <>
              <Download className="h-4 w-4" />
              <span>Cài đặt ứng dụng ngay</span>
            </>
          ) : (
            <>
              <PlusSquare className="h-4 w-4" />
              <span>Hướng dẫn thêm vào Màn hình chính iPhone</span>
            </>
          )}
        </Button>
      )}

      <Modal
        open={showIOSGuide}
        onOpenChange={setShowIOSGuide}
        title="Thêm vào màn hình chính iPhone"
        description="Cài đặt Sổ Khách CRM như một ứng dụng độc lập, mở nhanh 1 chạm không có thanh trình duyệt."
        maxWidthClass="max-w-md"
        footer={
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowIOSGuide(false)}
            className="h-11 sm:h-10 w-full"
          >
            Đã hiểu
          </Button>
        }
      >
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-xs">
              1
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                Mở trang bằng trình duyệt Safari
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Nhấn vào nút <strong className="text-foreground inline-flex items-center gap-1"><Share className="h-3.5 w-3.5 text-primary" /> Chia sẻ (Share)</strong> ở thanh công cụ phía dưới màn hình iPhone.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-xs">
              2
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                Chọn &ldquo;Thêm vào MH chính&rdquo;
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cuộn xuống và chọn <strong className="text-foreground inline-flex items-center gap-1"><PlusSquare className="h-3.5 w-3.5 text-primary" /> Thêm vào MH chính</strong> (Add to Home Screen), sau đó bấm <strong className="text-foreground">Thêm</strong> ở góc phải trên.
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Lưu ý: Nên mở bằng Safari chuẩn (không mở trong Zalo hoặc Facebook) để quá trình thêm biểu tượng và đăng nhập Google hoạt động ổn định.
          </p>
        </div>
      </Modal>
    </>
  );
}
