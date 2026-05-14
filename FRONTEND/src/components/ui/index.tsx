/**
 * UI Components Library — Sociedad Rural NC Design System
 * 
 * Reusable, design-system-aligned components for consistent UI across all modules.
 * All components follow the existing beige/green/stone institutional palette.
 */

import { ReactNode, ButtonHTMLAttributes } from 'react';
import { motion } from 'motion/react';

// ─── GlassCard ────────────────────────────────────────────────────────────────
interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  animate?: boolean;
  delay?: number;
}

export function GlassCard({ children, className = '', onClick, animate = false, delay = 0 }: GlassCardProps) {
  const base = `bg-[#f4eedd] dark:bg-stone-800 rounded-[2rem] border border-[#e5dfce] dark:border-stone-700/50 shadow-sm transition-all ${onClick ? 'active:scale-[0.98] cursor-pointer' : ''} ${className}`;

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay, duration: 0.3 }}
        className={base}
        onClick={onClick}
      >
        {children}
      </motion.div>
    );
  }

  return <div className={base} onClick={onClick}>{children}</div>;
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'destacada';

const BADGE_STYLES: Record<BadgeVariant, string> = {
  success:   'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
  warning:   'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
  error:     'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800',
  info:      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
  neutral:   'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700',
  destacada: 'bg-amber-400 text-amber-900 border border-amber-300',
};

interface StatusBadgeProps {
  variant?: BadgeVariant;
  icon?: string;
  children: ReactNode;
  pulse?: boolean;
  className?: string;
}

export function StatusBadge({ variant = 'neutral', icon, children, pulse = false, className = '' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${BADGE_STYLES[variant]} ${pulse ? 'animate-pulse' : ''} ${className}`}>
      {icon && <span className="material-symbols-outlined text-[11px]">{icon}</span>}
      {children}
    </span>
  );
}

// ─── PremiumButton ────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'whatsapp' | 'danger';

const BTN_STYLES: Record<ButtonVariant, string> = {
  primary:   'bg-[#245b31] hover:bg-[#1e4f2a] text-white shadow-sm',
  secondary: 'bg-stone-900 dark:bg-stone-700 hover:bg-stone-800 text-white shadow-sm',
  ghost:     'border-2 border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700',
  whatsapp:  'bg-[#25D366] hover:bg-[#20b958] text-white shadow-sm',
  danger:    'bg-red-500 hover:bg-red-600 text-white shadow-sm',
};

interface PremiumButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: string;
  fullWidth?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const BTN_SIZES = {
  sm: 'py-2 px-4 text-[9px]',
  md: 'py-3 px-5 text-[10px]',
  lg: 'py-3.5 px-6 text-[11px]',
};

export function PremiumButton({
  variant = 'primary',
  icon,
  fullWidth = false,
  loading = false,
  size = 'md',
  children,
  className = '',
  disabled,
  ...rest
}: PremiumButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-xl font-black uppercase tracking-widest
        transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
        ${BTN_SIZES[size]}
        ${BTN_STYLES[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {loading ? (
        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
      ) : icon ? (
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

// ─── SectionTitle ─────────────────────────────────────────────────────────────
interface SectionTitleProps {
  children: ReactNode;
  dot?: boolean;
  count?: number;
  className?: string;
}

export function SectionTitle({ children, dot = false, count, className = '' }: SectionTitleProps) {
  return (
    <div className={`flex items-center justify-between mb-3 px-1 ${className}`}>
      <h2 className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-2 italic">
        {dot && <span className="size-1.5 rounded-full bg-[#245b31] animate-pulse" />}
        {children}
      </h2>
      {count !== undefined && (
        <span className="text-[9px] font-black uppercase bg-[#245b31]/10 text-[#245b31] px-2 py-0.5 rounded-lg border border-[#245b31]/20">
          {count}
        </span>
      )}
    </div>
  );
}

// ─── SkeletonCard ─────────────────────────────────────────────────────────────
interface SkeletonCardProps {
  lines?: number;
  hasImage?: boolean;
  className?: string;
}

export function SkeletonCard({ lines = 3, hasImage = false, className = '' }: SkeletonCardProps) {
  return (
    <div className={`bg-[#f4eedd] dark:bg-stone-800 rounded-[2rem] p-5 border border-[#e5dfce] dark:border-stone-700/50 animate-pulse ${className}`}>
      <div className="flex items-start gap-4">
        {hasImage && (
          <div className="size-14 rounded-2xl bg-stone-200 dark:bg-stone-700 shrink-0" />
        )}
        <div className="flex-1 space-y-2.5">
          <div className="h-3 bg-stone-200 dark:bg-stone-700 rounded w-3/4" />
          <div className="h-3 bg-stone-200 dark:bg-stone-700 rounded w-1/2" />
          {lines > 2 && <div className="h-3 bg-stone-200 dark:bg-stone-700 rounded w-5/6" />}
          {lines > 3 && <div className="h-3 bg-stone-200 dark:bg-stone-700 rounded w-2/3" />}
        </div>
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = 'inbox', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="size-24 rounded-[40px] bg-stone-100 dark:bg-stone-800 flex items-center justify-center mb-5 border border-stone-200 dark:border-stone-700">
        <span className="material-symbols-outlined text-5xl text-stone-300">{icon}</span>
      </div>
      <h3 className="text-base font-black uppercase italic tracking-tighter text-stone-700 dark:text-stone-200 font-display mb-2">{title}</h3>
      {description && (
        <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 max-w-[220px] leading-relaxed">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 px-5 py-2.5 bg-[#245b31] text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-sm active:scale-95 transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
