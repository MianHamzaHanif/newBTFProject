import React, { useState } from "react";
import LeftSidebar from "./LeftSidebar";
import { Outlet } from "react-router-dom";
import RightSidebar from "./RightSidebar";
import "./layout.css";
const DashboardLayout = () => {
  const [sidebarOpen, SetSidebarOpen] = useState(false);
  return (
    <div className="dashboard-layout">
      <LeftSidebar sidebarOpen={sidebarOpen} SetSidebarOpen={SetSidebarOpen} />
      <main className="dashboard-content">
        <div className="hamburger" onClick={() => SetSidebarOpen(true)}>
          <span className="icon">
            <i class="bi bi-list"></i>
          </span>
        </div>
        <Outlet context={{ sidebarOpen, SetSidebarOpen }} />
      </main>
      <RightSidebar />
    </div>
  );
};

export default DashboardLayout;
