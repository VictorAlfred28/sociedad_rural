import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Descarga y abre o guarda un archivo garantizando compatibilidad entre Web y Android Nativo.
 * @param blob El Blob del archivo (descargado via fetch/axios).
 * @param filename Nombre con extensión, ej: "reporte.pdf".
 */
export const handleNativeDownload = async (blob: Blob, filename: string): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    try {
      // 1. Convertir Blob a Base64 para Capacitor Filesystem
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            // Remover el prefijo data:mime/type;base64,
            const base64 = reader.result.split(',')[1];
            resolve(base64);
          } else {
            reject(new Error("Fallo al convertir el archivo a Base64."));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Asegurarse de que el nombre sea único para evitar problemas de caché o permisos
      const uniqueFilename = `${new Date().getTime()}_${filename}`;

      // 2. Guardar en el directorio de Cache del teléfono (no requiere permisos extra de almacenamiento en Android 10+)
      const savedFile = await Filesystem.writeFile({
        path: uniqueFilename,
        data: base64Data,
        directory: Directory.Cache,
      });

      // 3. Abrir el diálogo nativo para compartir/abrir el archivo con apps instaladas (visores PDF/Excel)
      await Share.share({
        title: filename,
        text: `Aquí tienes el reporte: ${filename}`,
        url: savedFile.uri,
        dialogTitle: 'Exportar Reporte'
      });
      
      return true;
    } catch (error) {
      console.error("Error nativo al procesar archivo:", error);
      throw error;
    }
  } else {
    // Fallback estándar para entorno Web
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    return true;
  }
};
