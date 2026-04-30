import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordInputProps = React.ComponentProps<'input'>;

export function PasswordInput({ className = '', autoComplete = 'new-password', ...props }: PasswordInputProps) {
    const [showPassword, setShowPassword] = useState(false);

    const togglePasswordVisibility = () => {
        setShowPassword((prev) => !prev);
    };

    return (
        <div className="relative w-full">
            <input
                {...props}
                type={showPassword ? 'text' : 'password'}
                className={`w-full pr-12 ${className}`}
                autoComplete={autoComplete}
            />
            <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
                {showPassword ? (
                    <EyeOff size={20} aria-hidden="true" />
                ) : (
                    <Eye size={20} aria-hidden="true" />
                )}
            </button>
        </div>
    );
}
