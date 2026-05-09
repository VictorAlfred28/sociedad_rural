import React, { useState, useRef } from 'react';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import type { FieldState } from '../../utils/validations';

interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  fieldState?: FieldState;
  errorMessage?: string;
  hint?: string;
  icon?: string; // material symbol name
  inputClassName?: string;
  containerClassName?: string;
  onValidate?: (value: string) => void;
  onBlurValidate?: (value: string) => Promise<void> | void;
  rightSlot?: React.ReactNode;
}

export function ValidatedInput({
  label,
  fieldState = 'idle',
  errorMessage,
  hint,
  icon,
  inputClassName = '',
  containerClassName = '',
  onValidate,
  onBlurValidate,
  rightSlot,
  onChange,
  onBlur,
  ...props
}: ValidatedInputProps) {
  const hasIcon = !!icon;
  const isError = fieldState === 'error';
  const isValid = fieldState === 'valid';
  const isChecking = fieldState === 'checking';

  // Border color
  const borderColor = isError
    ? 'border-red-500 dark:border-red-400'
    : isValid
    ? 'border-emerald-500 dark:border-emerald-400'
    : 'border-slate-200 dark:border-slate-700 focus-within:border-primary';

  // Glow
  const glowClass = isError
    ? 'shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
    : isValid
    ? 'shadow-[0_0_0_3px_rgba(16,185,129,0.12)]'
    : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    onValidate?.(e.target.value);
  };

  const handleBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    onBlur?.(e);
    await onBlurValidate?.(e.target.value);
  };

  const baseInput =
    `w-full h-14 rounded-xl border transition-all duration-200 bg-white dark:bg-slate-900 ` +
    `text-slate-900 dark:text-slate-100 text-base font-normal leading-normal ` +
    `placeholder:text-slate-400 dark:placeholder:text-slate-500 ` +
    `focus:outline-none focus:ring-0 ` +
    `${hasIcon ? 'pl-12' : 'pl-4'} ${rightSlot || isError || isValid || isChecking ? 'pr-12' : 'pr-4'} ` +
    `${borderColor} ${glowClass} ${inputClassName}`;

  return (
    <div className={`flex flex-col gap-1 py-2 ${containerClassName}`}>
      <label className="flex flex-col w-full gap-0">
        <span className="text-slate-900 dark:text-slate-100 text-sm font-semibold pb-2">
          {label}
        </span>
        <div className="relative">
          {/* Left icon */}
          {icon && (
            <span
              className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] pointer-events-none transition-colors duration-200 ${
                isError ? 'text-red-500' : isValid ? 'text-emerald-500' : 'text-primary'
              }`}
            >
              {icon}
            </span>
          )}

          <input
            {...props}
            className={baseInput}
            onChange={handleChange}
            onBlur={handleBlur}
          />

          {/* Right status icon */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            {isChecking && (
              <Loader size={18} className="text-primary animate-spin" />
            )}
            {isValid && !isChecking && (
              <CheckCircle size={18} className="text-emerald-500" />
            )}
            {isError && !isChecking && (
              <XCircle size={18} className="text-red-500" />
            )}
            {rightSlot && !isChecking && !isValid && !isError && rightSlot}
          </div>
        </div>
      </label>

      {/* Error or hint */}
      <div className="min-h-[18px] px-1">
        {isError && errorMessage && (
          <p className="text-red-500 dark:text-red-400 text-xs font-medium flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
            <XCircle size={12} />
            {errorMessage}
          </p>
        )}
        {!isError && hint && (
          <p className="text-slate-400 dark:text-slate-500 text-xs">{hint}</p>
        )}
      </div>
    </div>
  );
}
