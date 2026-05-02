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
 * Reproduce un sonido de notificación.
 * REGLA: solo se llama en FOREGROUND (app abierta).
 * Background y notificaciones del OS gestionan el sonido automáticamente.
 *
 * @param soundEnabled - Si el usuario tiene habilitado el sonido
 * @param soundType    - Tipo de sonido (reservado para uso futuro)
 * @returns true si se reprodujo, false si no
 */
export const playNotificationSound = async (
    soundEnabled: boolean = true,
    soundType: string = 'notification'
): Promise<boolean> => {
    // Nunca reproducir si está deshabilitado
    if (!soundEnabled) {
        console.log('[Sound] Sonido deshabilitado por usuario');
        return false;
    }

    // Nunca reproducir en Service Worker (background)
    if (typeof window === 'undefined') {
        console.log('[Sound] Contexto SW — sonido gestionado por OS');
        return false;
    }

    // En plataforma nativa (Capacitor), el canal Android/iOS gestiona el sonido
    if (Capacitor.isNativePlatform()) {
        console.log('[Sound] Plataforma nativa — sonido gestionado por canal FCM');
        return false;
    }

    // Prevenir reproducción duplicada (máximo 1 vez por segundo)
    const now = Date.now();
    if (now - lastPlayTime < 1000) {
        console.log('[Sound] Evitando reproducción duplicada');
        return false;
    }
    lastPlayTime = now;

    return await playWebSound();
};

/**
 * Reproduce sonido en web (navegador, FOREGROUND únicamente)
 */
const playWebSound = async (): Promise<boolean> => {
    try {
        const audio = getAudioElement();
        audio.currentTime = 0;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
            await playPromise;
            console.log('[Sound] ✅ Sonido reproducido en foreground');
            return true;
        }
        return false;
    } catch (error) {
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
            // Chrome bloquea autoplay hasta que el usuario interactúa con la página
            console.warn('[Sound] ⚠️ Bloqueado por política de autoplay del navegador (requiere interacción previa del usuario)');
        } else {
            console.error('[Sound] Error reproduciendo sonido web:', error);
        }
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
