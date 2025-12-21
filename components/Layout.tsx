
import React from 'react';
import { Sidebar } from './Sidebar';
import { AIChatbot } from './AIChatbot';

interface LayoutProps {
  children: React.ReactNode;
  noSidebar?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, noSidebar = false }) => {
  return (
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark">
      {!noSidebar && <Sidebar />}
      <div className={`flex-1 flex flex-col min-w-0 ${!noSidebar ? 'lg:pl-64' : ''}`}>
        <main className="flex-1">
          {children}
        </main>
      </div>
      {!noSidebar && <AIChatbot />}
    </div>
  );
};
