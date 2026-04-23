/**
 * Utilidad para reproducir sonidos de notificación
 * Maneja compatibilidad web y móvil (Capacitor)
 */

import { Capacitor } from '@capacitor/core';

// Crear elemento de audio reutilizable
let audioElement: HTMLAudioElement | null = null;
let lastPlayTime = 0;

const getAudioElement = (): HTMLAudioElement => {
    if (!audioElement) {
        audioElement = new Audio();
        // Ruta al archivo de sonido en public/assets/sounds/
        audioElement.src = '/assets/sounds/notification.mp3';
        audioElement.preload = 'auto';
    }
    return audioElement;
};

/**
 * Reproduce un sonido de notificación
 * @param soundEnabled - Si el usuario tiene habilitado el sonido
 * @param soundType - Tipo de sonido ('notification', 'message', etc.)
 * @returns true si se reprodujo, false si no
 */
export const playNotificationSound = async (
    soundEnabled: boolean = true,
    soundType: string = 'notification'
): Promise<boolean> => {
    // No reproducir si está deshabilitado
    if (!soundEnabled) {
        console.log('[Sound] Sonido deshabilitado por usuario');
        return false;
    }

    // Prevenir reproducción duplicada (máximo 1 vez por segundo)
    const now = Date.now();
    if (now - lastPlayTime < 1000) {
        console.log('[Sound] Evitando reproducción duplicada');
        return false;
    }

    lastPlayTime = now;

    try {
        // En plataforma nativa (Capacitor/Móvil)
        if (Capacitor.isNativePlatform()) {
            return await playMobileSound(soundType);
        }

        // En web, usar HTMLAudioElement
        return await playWebSound();
    } catch (error) {
        console.error('[Sound] Error reproduciendo sonido:', error);
        return false;
    }
};

/**
 * Reproduce sonido en web (navegador)
 */
const playWebSound = async (): Promise<boolean> => {
    try {
        const audio = getAudioElement();
        
        // Reiniciar desde el inicio cada vez
        audio.currentTime = 0;
        
        // Intentar reproducir (algunos navegadores requieren interacción previa)
        const playPromise = audio.play();

        if (playPromise !== undefined) {
            await playPromise;
            console.log('[Sound] Sonido reproducido en web');
            return true;
        }

        return false;
    } catch (error) {
        // Error común: NotAllowedError (falta interacción del usuario)
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
            console.warn('[Sound] Navegador requiere interacción previa del usuario para reproducir sonido');
        } else {
            console.error('[Sound] Error reproduciendo sonido web:', error);
        }
        return false;
    }
};

/**
 * Reproduce sonido en móvil (Capacitor Android/iOS)
 * Delega al sistema nativo de notificaciones
 */
const playMobileSound = async (soundType: string): Promise<boolean> => {
    try {
        // En Android/iOS, el sonido se maneja a través del payload de Firebase
        // Esta función es un placeholder para lógica adicional si es necesaria
        console.log(`[Sound] Sonido de tipo '${soundType}' en móvil (manejado por Firebase)`);
        
        // Opcional: si quieres reproducir sonido adicional en app abierta en móvil:
        // const soundFile = `Assets/sounds/${soundType}.mp3`;
        // await SoundService.play(soundFile);
        
        return true;
    } catch (error) {
        console.error('[Sound] Error en sonido móvil:', error);
        return false;
    }
};

/**
 * Detiene cualquier sonido en reproducción
 */
export const stopNotificationSound = (): void => {
    if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
        console.log('[Sound] Sonido detenido');
    }
};

/**
 * Obtiene el elemento de audio para control manual si es necesario
 */
export const getNotificationAudio = (): HTMLAudioElement | null => {
    if (Capacitor.isNativePlatform()) {
        return null; // No hay control de audio en nativo
    }
    return getAudioElement();
};

/**
 * Configura el volumen del sonido (0-1)
 */
export const setNotificationVolume = (volume: number): void => {
    const audio = getAudioElement();
    audio.volume = Math.max(0, Math.min(1, volume));
    console.log(`[Sound] Volumen ajustado a ${Math.round(audio.volume * 100)}%`);
};

/**
 * Realiza un test reproduciiendo el sonido independientemente de preferencias
 */
export const testNotificationSound = async (): Promise<boolean> => {
    console.log('[Sound] Realizando test de sonido...');
    return await playNotificationSound(true, 'test');
};
