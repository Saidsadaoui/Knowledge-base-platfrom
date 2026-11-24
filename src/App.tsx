import React, { useEffect } from 'react';
import { AppShell } from './components/AppShell';
import { RouterProvider, useRouter } from './contexts/RouterContext';
import { useVault, VaultProvider } from './contexts/VaultContext';
import { HomePage } from './pages/HomePage';
import { ListPage } from './pages/ListPage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';

function VaultRoutes() {
  const { pathname, navigate } = useRouter();
  const { user, authLoading } = useVault();

  useEffect(() => {
    if (authLoading) return;
    if (!user && pathname !== '/login') {
      navigate('/login', { replace: true });
    } else if (user && pathname === '/login') {
      navigate('/', { replace: true });
    }
  }, [authLoading, user, pathname, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--bg)] text-[var(--text-muted)] text-[14px]">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  let content: React.ReactNode;
  if (pathname === '/') {
    content = <HomePage />;
  } else if (pathname === '/inbox') {
    content = <ListPage mode="inbox" />;
  } else if (pathname === '/search') {
    content = <ListPage mode="search" />;
  } else if (pathname === '/settings') {
    content = <SettingsPage />;
  } else if (pathname.startsWith('/c/')) {
    const id = decodeURIComponent(pathname.slice(3).split('/')[0] || '');
    content = <ListPage mode="category" categoryId={id} />;
  } else {
    content = <HomePage />;
  }

  return <AppShell>{content}</AppShell>;
}

export default function App() {
  return (
    <RouterProvider>
      <VaultProvider>
        <VaultRoutes />
      </VaultProvider>
    </RouterProvider>
  );
}
