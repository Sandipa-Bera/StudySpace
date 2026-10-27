import React from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { MobileNav } from '../components/layout/MobileNav';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
      <MobileNav />
    </div>
  );
}
