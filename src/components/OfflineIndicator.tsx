import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 z-40 flex items-center justify-center md:justify-start gap-2 rounded-xl border border-amber-500/30 bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Đang ngoại tuyến — hiển thị dữ liệu đã lưu tạm.</span>
    </div>
  );
}
