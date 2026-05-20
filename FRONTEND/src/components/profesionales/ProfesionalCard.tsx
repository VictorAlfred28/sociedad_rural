import { motion } from 'motion/react';
import type { ProfesionalDetalle } from './ProfesionalDetalleModal';

export interface ProfesionalCardData extends ProfesionalDetalle {
  id: string;
}

interface Props {
  prof: ProfesionalCardData;
  index?: number;
  onMasDetalle: (prof: ProfesionalCardData) => void;
}

export default function ProfesionalCard({ prof, index = 0, onMasDetalle }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.03 }}
      className="bg-[#f4eedd] dark:bg-stone-800 rounded-[2rem] px-5 py-4 flex items-center gap-4 shadow-sm border border-[#e5dfce] dark:border-stone-700/50 group active:scale-[0.98] transition-all relative overflow-hidden"
    >
      <div
        className="absolute -bottom-4 -right-4 w-20 h-20 text-[#8b9172] opacity-20 pointer-events-none"
        aria-hidden
      >
        <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 100 C 50 70, 70 50, 90 40 C 70 45, 55 60, 50 80 C 45 60, 30 45, 10 40 C 30 50, 50 70, 50 100 Z" />
          <path d="M50 70 C 50 50, 70 30, 80 20 C 65 30, 55 45, 50 60 C 45 45, 35 30, 20 20 C 30 30, 50 50, 50 70 Z" />
        </svg>
      </div>

      <div className="size-14 rounded-full bg-[#4b5e4a] flex items-center justify-center shrink-0 shadow-sm border border-white/10 z-10">
        <span className="material-symbols-outlined text-white text-2xl">assignment_ind</span>
      </div>

      <div className="flex-1 min-w-0 z-10">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-bold text-sm uppercase italic tracking-tighter text-stone-800 dark:text-white truncate font-display">
            {prof.nombre_apellido}
          </h4>
          <span className="text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest bg-[#4b5e4a]/10 text-[#4b5e4a] border border-[#4b5e4a]/20 shrink-0">
            Socio
          </span>
        </div>

        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {prof.rubro && (
            <span className="text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider italic">
              {prof.rubro}
            </span>
          )}
          {prof.municipio && (
            <span className="flex items-center gap-0.5 text-[9px] text-stone-400 font-bold uppercase tracking-tight">
              <span className="material-symbols-outlined text-[10px]">location_on</span>
              {prof.municipio}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onMasDetalle(prof)}
          className="inline-flex items-center gap-1.5 text-[9px] text-[#4b5e4a] dark:text-[#a8b89a] font-black mt-3 uppercase tracking-wider bg-[#4b5e4a]/10 px-3 py-1.5 rounded-xl border border-[#4b5e4a]/20 shadow-sm hover:bg-[#4b5e4a]/15 transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">info</span>
          Más detalle
        </button>
      </div>
    </motion.div>
  );
}
