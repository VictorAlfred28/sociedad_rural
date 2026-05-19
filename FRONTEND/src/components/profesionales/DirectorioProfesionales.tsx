import { motion } from 'motion/react';
import ProfesionalCard, { type ProfesionalCardData } from './ProfesionalCard';
import ProfesionalDetalleModal from './ProfesionalDetalleModal';

interface Props {
  profesionales: ProfesionalCardData[];
  loading: boolean;
  selected: ProfesionalCardData | null;
  onSelect: (prof: ProfesionalCardData | null) => void;
}

export default function DirectorioProfesionales({
  profesionales,
  loading,
  selected,
  onSelect,
}: Props) {
  return (
    <>
      <motion.div
        key="profesionales-banner"
        className="bg-[#4b5e4a] p-6 rounded-[2rem] flex items-center gap-5 relative overflow-hidden shadow-lg border border-[#3a4a3a]"
      >
        <motion.div
          className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none translate-x-1/2 -translate-y-1/2"
          aria-hidden
        >
          <span className="material-symbols-outlined text-9xl text-white">assignment_ind</span>
        </motion.div>
        <div className="size-14 rounded-full bg-white/20 flex items-center justify-center shrink-0 shadow-sm border border-white/20">
          <span className="material-symbols-outlined text-white text-3xl">verified</span>
        </motion.div>
        <motion.div className="relative z-10 text-white">
          <h3 className="font-black text-lg uppercase tracking-tight italic font-display">Socios Profesionales</h3>
          <p className="text-stone-200 text-[10px] font-bold uppercase tracking-widest mt-1">Directorio Institucional</p>
        </motion.div>
      </motion.div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-[2rem] bg-[#f4eedd] animate-pulse border border-[#e5dfce]" />
          ))}
        </motion.div>
      ) : profesionales.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center">
          <span className="material-symbols-outlined text-6xl text-stone-200">person_off</span>
          <p className="text-stone-400 font-bold mt-4 italic uppercase text-xs tracking-widest">Sin registros</p>
        </motion.div>
      ) : (
        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {profesionales.map((prof, idx) => (
            <ProfesionalCard key={prof.id} prof={prof} index={idx} onMasDetalle={onSelect} />
          ))}
        </motion.div>
      )}

      <ProfesionalDetalleModal profesional={selected} onClose={() => onSelect(null)} />
    </>
  );
}
