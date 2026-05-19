import { motion, AnimatePresence } from 'motion/react';
import { openWhatsAppSmart, normalizeWhatsAppPhone } from '../../utils/whatsapp';

export interface ProfesionalDetalle {
  nombre_apellido: string;
  rubro?: string | null;
  matricula?: string | null;
  municipio?: string | null;
  provincia?: string | null;
  direccion?: string | null;
  telefono?: string | null;
}

interface Props {
  profesional: ProfesionalDetalle | null;
  onClose: () => void;
}

function hasText(value?: string | null): boolean {
  return Boolean(value && String(value).trim());
}

export default function ProfesionalDetalleModal({ profesional, onClose }: Props) {
  const whatsappDisponible = Boolean(
    profesional?.telefono && normalizeWhatsAppPhone(profesional.telefono)
  );

  const handleWhatsApp = () => {
    if (!profesional?.telefono || !whatsappDisponible) return;
    const nombre = profesional.nombre_apellido || 'profesional';
    openWhatsAppSmart(
      profesional.telefono,
      `Hola ${nombre}, te contacto desde el directorio de Socios Profesionales de la Sociedad Rural del Norte.`
    );
  };

  const municipioLabel = [profesional?.municipio, profesional?.provincia]
    .filter(hasText)
    .join(', ');

  return (
    <AnimatePresence>
      {profesional && (
        <motion.div
          key="profesional-detalle-modal"
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profesional-detalle-titulo"
        >
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-950/70 backdrop-blur-sm"
            aria-label="Cerrar"
          />

          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="relative w-full max-w-md bg-[#f4eedd] dark:bg-stone-800 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl border border-[#e5dfce] dark:border-stone-700 overflow-hidden max-h-[92vh] flex flex-col"
          >
            <motion.div
              className="bg-[#4b5e4a] px-6 pt-6 pb-8 relative overflow-hidden shrink-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.1 }}
              >
                <span className="material-symbols-outlined text-8xl text-white">assignment_ind</span>
              </motion.div>

              <div className="flex items-start justify-between gap-3 relative z-10">
                <motion.div
                  className="size-16 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/20 shadow-sm"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                >
                  <span className="material-symbols-outlined text-white text-3xl">verified</span>
                </motion.div>
                <button
                  type="button"
                  onClick={onClose}
                  className="size-10 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                  aria-label="Cerrar detalle"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <motion.h2
                id="profesional-detalle-titulo"
                className="mt-4 font-black text-xl uppercase italic tracking-tight text-white font-display relative z-10"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                {profesional.nombre_apellido}
              </motion.h2>
              <p className="text-stone-200 text-[10px] font-bold uppercase tracking-widest mt-1 relative z-10">
                Socio Profesional · Directorio Institucional
              </p>
            </motion.div>

            <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
              <DetalleFila
                icon="work"
                label="Profesión"
                value={hasText(profesional.rubro) ? profesional.rubro! : 'No especificada'}
              />
              <DetalleFila
                icon="badge"
                label="Matrícula profesional"
                value={hasText(profesional.matricula) ? profesional.matricula! : 'No especificada'}
              />
              {municipioLabel && (
                <DetalleFila icon="location_on" label="Municipio" value={municipioLabel} />
              )}
              {hasText(profesional.direccion) ? (
                <DetalleFila icon="home_pin" label="Dirección profesional" value={profesional.direccion!.trim()} />
              ) : (
                <DetalleFila
                  icon="home_pin"
                  label="Dirección profesional"
                  value="Dirección no especificada"
                  muted
                />
              )}

              <div className="pt-2 border-t border-[#e5dfce] dark:border-stone-700">
                {whatsappDisponible ? (
                  <button
                    type="button"
                    onClick={handleWhatsApp}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#25D366] hover:bg-[#20b958] text-white font-black uppercase text-xs tracking-widest shadow-sm transition-all active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-lg">chat</span>
                    Contactar por WhatsApp
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-stone-200 dark:bg-stone-700 text-stone-400 dark:text-stone-500 font-black uppercase text-xs tracking-widest cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-lg">chat_bubble_outline</span>
                    WhatsApp no disponible
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DetalleFila({
  icon,
  label,
  value,
  muted = false,
}: {
  icon: string;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <motion.div
        className="size-10 rounded-xl bg-[#4b5e4a]/10 dark:bg-[#4b5e4a]/20 flex items-center justify-center shrink-0"
        whileHover={{ scale: 1.05 }}
      >
        <span className="material-symbols-outlined text-[#4b5e4a] dark:text-[#8b9172] text-xl">{icon}</span>
      </motion.div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">{label}</p>
        <p
          className={`text-sm font-bold mt-0.5 leading-snug ${
            muted
              ? 'text-stone-400 dark:text-stone-500 italic font-medium'
              : 'text-stone-800 dark:text-stone-100'
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
