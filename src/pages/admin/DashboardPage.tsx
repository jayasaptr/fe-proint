import React from "react";

const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-slate-500 mt-1">
            Here's what's happening with your recruitment today.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
