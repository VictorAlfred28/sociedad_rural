// ============================================================
// Sistema centralizado de validaciones — Sociedad Rural Norte
// ============================================================

export type FieldState = 'idle' | 'valid' | 'error' | 'checking';

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

// ── DNI ──────────────────────────────────────────────────────
export function validateDNI(value: string): ValidationResult {
  // Solo dígitos
  if (!/^\d+$/.test(value) && value.length > 0) {
    return { valid: false, message: 'El DNI debe contener únicamente números.' };
  }
  if (value.length > 0 && value.length !== 8) {
    return { valid: false, message: 'El DNI debe tener exactamente 8 dígitos.' };
  }
  if (value.length === 0) {
    return { valid: false, message: 'Debe ingresar su DNI.' };
  }
  return { valid: true };
}

// ── Email ─────────────────────────────────────────────────────
export function validateEmailFormat(value: string): ValidationResult {
  if (!value || value.length === 0) {
    return { valid: false, message: 'Debe ingresar un correo electrónico.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return { valid: false, message: 'Ingrese un correo electrónico válido.' };
  }
  return { valid: true };
}

// ── Check email existente (async) ─────────────────────────────
export async function checkEmailExists(
  email: string,
  type: 'socio' | 'comercio' = 'socio'
): Promise<ValidationResult> {
  const format = validateEmailFormat(email);
  if (!format.valid) return format;

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const resp = await fetch(`${apiUrl}/api/check-email?email=${encodeURIComponent(email)}&type=${type}`);
    const data = await resp.json();
    if (data.exists) {
      return {
        valid: false,
        message: type === 'comercio'
          ? 'Ya existe un comercio registrado con este correo.'
          : 'Ya existe una cuenta registrada con este correo.',
      };
    }
    return { valid: true };
  } catch (_) {
    // Si el endpoint no responde, no bloqueamos — el backend validará al submit
    return { valid: true };
  }
}

// ── Campos requeridos ─────────────────────────────────────────
export function validateRequired(value: string, fieldName: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { valid: false, message: `Debe ingresar ${fieldName}.` };
  }
  return { valid: true };
}

// ── Contraseña ────────────────────────────────────────────────
export function validatePassword(value: string): ValidationResult {
  if (!value || value.length === 0) {
    return { valid: false, message: 'Debe ingresar una contraseña.' };
  }
  if (value.length < 8) {
    return { valid: false, message: 'La contraseña debe tener al menos 8 caracteres.' };
  }
  return { valid: true };
}

export function validatePasswordMatch(pass: string, confirm: string): ValidationResult {
  if (pass !== confirm) {
    return { valid: false, message: 'Las contraseñas no coinciden.' };
  }
  return { valid: true };
}

// ── Teléfono ─────────────────────────────────────────────────
export function validatePhone(value: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { valid: false, message: 'Debe ingresar un teléfono de contacto.' };
  }
  return { valid: true };
}

// ── Normalizar errores del backend ──────────────────────────
export function parseBackendError(detail: unknown): string {
  if (!detail) return 'Error desconocido. Intente nuevamente.';

  if (Array.isArray(detail)) {
    // Pydantic validation errors
    return detail
      .map((e: any) => {
        const field = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : '';
        return `${field ? `${field}: ` : ''}${e.msg}`;
      })
      .join(' · ');
  }

  const msg = String(detail).toLowerCase();

  if (msg.includes('correo ya se encuentra registrado') || msg.includes('user already registered') || msg.includes('email')) {
    return 'Ya existe una cuenta registrada con ese correo.';
  }
  if (msg.includes('dni') && msg.includes('duplicate')) {
    return 'Ya existe un socio registrado con ese DNI.';
  }
  if (msg.includes('duplicate key') || msg.includes('ya existe')) {
    return 'Ya existe una cuenta con estos datos.';
  }
  if (msg.includes('exactamente 8')) {
    return 'El DNI debe tener exactamente 8 dígitos.';
  }
  if (msg.includes('constancia')) {
    return detail as string;
  }

  // Devolver el mensaje original si es legible
  if (typeof detail === 'string' && detail.length < 200 && !detail.includes('traceback')) {
    return detail;
  }

  return 'No se pudo completar el registro. Intente nuevamente.';
}
