import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { CustomersPage } from './pages/CustomersPage';
import { ProductsPage } from './pages/ProductsPage';
import { DevicesPage } from './pages/DevicesPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditPage } from './pages/AuditPage';

export const AppContent: React.FC = () => {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  if (!user) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardPage
            onNewInvoice={() => {
              setCurrentTab('invoices');
              setShowInvoiceModal(true);
            }}
            onNewExpense={() => {
              setCurrentTab('expenses');
              setShowExpenseModal(true);
            }}
          />
        );
      case 'invoices':
        return (
          <InvoicesPage
            showCreateModal={showInvoiceModal}
            onOpenCreateModal={() => setShowInvoiceModal(true)}
            onCloseCreateModal={() => setShowInvoiceModal(false)}
          />
        );
      case 'expenses':
        return (
          <ExpensesPage
            showCreateModal={showExpenseModal}
            onOpenCreateModal={() => setShowExpenseModal(true)}
            onCloseCreateModal={() => setShowExpenseModal(false)}
          />
        );
      case 'customers':
        return <CustomersPage />;
      case 'products':
        return <ProductsPage />;
      case 'devices':
        return <DevicesPage />;
      case 'reports':
        return <ReportsPage />;
      case 'audit':
        return <AuditPage />;
      default:
        return <DashboardPage onNewInvoice={() => {}} onNewExpense={() => {}} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return <AppContent />;
}
