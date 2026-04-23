// Generador de archivo de sonido de notificación
// Ejecutar en consola del navegador para crear el archivo

(function generateNotificationSound() {
    // Parámetros del sonido
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;
    
    // Crear osciladores para un sonido de campana corto (500ms)
    const duration = 0.5;
    
    // Oscilador 1: Nota principal
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    
    osc1.frequency.setValueAtTime(800, now);
    osc1.frequency.exponentialRampToValueAtTime(600, now + duration);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    // Oscilador 2: Armónico (para más riqueza)
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    
    osc2.frequency.setValueAtTime(1200, now);
    osc2.frequency.exponentialRampToValueAtTime(800, now + duration);
    gain2.gain.setValueAtTime(0.2, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    osc1.start(now);
    osc1.stop(now + duration);
    osc2.start(now);
    osc2.stop(now + duration);
    
    console.log('Sonido de notificación generado');
})();
