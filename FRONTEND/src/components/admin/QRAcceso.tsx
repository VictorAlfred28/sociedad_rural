import QRCode from "react-qr-code";
import { motion } from "framer-motion";

export default function QRAcceso() {
  const loginUrl = "https://sociedadruraldelnorte.agentech.ar/login";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-[500px] w-full p-4 md:p-8"
    >
      <div className="bg-admin-card border border-admin-border rounded-3xl p-8 md:p-10 flex flex-col items-center shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-center size-12 rounded-full bg-admin-accent/10 mb-4">
          <span className="material-symbols-outlined text-admin-accent text-2xl">qr_code_scanner</span>
        </div>
        <h2 className="text-2xl font-bold text-admin-text mb-2 tracking-tight text-center">Código QR de acceso</h2>
        <p className="text-sm text-slate-400 text-center mb-8 px-2 leading-relaxed">
          Escaneá este código con tu dispositivo móvil para ingresar a Sociedad Rural del Norte.
        </p>
        
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-inner mb-8">
          <QRCode
            value={loginUrl}
            size={256}
            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
            viewBox={`0 0 256 256`}
            level="H"
          />
        </div>
        
        <div className="w-full bg-admin-bg/50 rounded-xl p-4 border border-admin-border text-center">
          <p className="text-[11px] font-mono text-admin-accent/80 tracking-widest break-all select-all">
            {loginUrl}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
