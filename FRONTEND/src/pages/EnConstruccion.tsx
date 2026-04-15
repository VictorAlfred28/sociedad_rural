import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function EnConstruccion() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-background-dark flex flex-col items-center justify-center p-6 text-center font-display">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl shadow-green-900/10 border border-slate-200 dark:border-slate-800"
            >
                <motion.div
                    animate={{
                        rotate: [0, -10, 10, -10, 10, 0],
                        scale: [1, 1.1, 1]
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatDelay: 3
                    }}
                    className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                    <span className="material-symbols-outlined text-5xl text-[#357a38]">construction</span>
                </motion.div>

                <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
                    ¡Estamos Trabajando! 🚧
                </h1>

                <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                    Muy pronto podrás pagar tus cuotas de forma rápida y segura a través de <span className="font-bold text-[#357a38]">Mercado Pago</span>.
                    <br /><br />
                    Por el momento, por favor utiliza la opción de
                    <span className="font-bold whitespace-nowrap"> "Subir Comprobante"</span>
                    en la sección de Gestión de Cuotas.
                </p>

                <div className="space-y-3">
                    <Link
                        to="/cuotas"
                        className="block w-full py-4 bg-[#357a38] text-white rounded-2xl font-bold shadow-lg shadow-green-900/20 active:scale-[0.98] transition-all"
                    >
                        Ir a Gestión de Cuotas
                    </Link>

                    <Link
                        to="/home"
                        className="block w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                        Volver al Inicio
                    </Link>
                </div>

                <p className="mt-8 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                    Sociedad Rural del Norte de Corrientes
                </p>
            </motion.div>
        </div>
    );
}
