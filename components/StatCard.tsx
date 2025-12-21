
import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  icon: string;
  trend: string;
  colorClass: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, colorClass }) => {
  return (
    <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
      <div className="flex justify-between">
        <span className="text-sm font-medium text-text-secondary uppercase">{title}</span>
        <span className={`material-symbols-outlined ${colorClass}`}>{icon}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold dark:text-white">{value}</span>
        <span className="text-xs bg-green-100 text-green-800 px-2 rounded font-bold">{trend}</span>
      </div>
    </div>
  );
};
