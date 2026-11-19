import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginView } from './components/LoginView';
import { Skeleton } from './components/ui/skeleton';
import { CrmProvider, useCrm } from './contexts/CrmContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

function RootRouter() {
  const { user, loadingAuth } = useCrm();
  const { theme } = useTheme();

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-10 w-40 mx-auto" />
          <Skeleton className="h-4 w-56 mx-auto" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      {user ? (
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      ) : (
        <LoginView />
      )}
      <Toaster
        position="top-right"
        richColors
        theme={theme}
        toastOptions={{
          duration: 3000,
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <CrmProvider>
          <RootRouter />
        </CrmProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
