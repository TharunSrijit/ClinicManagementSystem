import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { SidebarProvider } from '../context/SidebarContext';

export const DashboardLayout = () => {
  return (
    <SidebarProvider>
      <div className="dashboard-shell">
        <Sidebar />
        <div className="main-content">
          <Navbar />
          <main className="page-body">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
