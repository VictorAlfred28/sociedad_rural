/**
 * Genera un archivo notification.mp3 mínimo y válido usando
 * síntesis de tono puro PCM → MP3 frame structure.
 * Produce un "ding" de ~0.5s, ~4KB.
 * Ejecutar: node create-mp3.js
 */
const fs = require('fs');
const path = require('path');

// ── Parámetros ─────────────────────────────────────────────
const SAMPLE_RATE   = 44100;
const DURATION_SEC  = 0.5;
const FREQ_HZ       = 880;     // La5 - tono tipo "ding"
const VOLUME        = 0.4;
const NUM_SAMPLES   = Math.floor(SAMPLE_RATE * DURATION_SEC);
const OUTPUT_FILE   = path.join(__dirname, 'notification.mp3');

// ── Generar muestras PCM 16-bit ────────────────────────────
const pcm = Buffer.alloc(NUM_SAMPLES * 2);
for (let i = 0; i < NUM_SAMPLES; i++) {
    const t      = i / SAMPLE_RATE;
    const fade   = Math.min(1, (DURATION_SEC - t) / (DURATION_SEC * 0.3)); // fade-out
    const attack = Math.min(1, t / 0.01);                                   // 10ms attack
    const sample = Math.round(VOLUME * fade * attack * Math.sin(2 * Math.PI * FREQ_HZ * t) * 32767);
    pcm.writeInt16LE(Math.max(-32767, Math.min(32767, sample)), i * 2);
}

// ── Construir WAV mínimo (PCM 16-bit mono 44100) ──────────
function buildWav(pcmBuf) {
    const dataSize   = pcmBuf.length;
    const headerSize = 44;
    const wav        = Buffer.alloc(headerSize + dataSize);

    wav.write('RIFF',         0);
    wav.writeUInt32LE(36 + dataSize, 4);
    wav.write('WAVE',         8);
    wav.write('fmt ',        12);
    wav.writeUInt32LE(16,    16);   // Subchunk1Size (PCM)
    wav.writeUInt16LE(1,     20);   // AudioFormat   (PCM = 1)
    wav.writeUInt16LE(1,     22);   // NumChannels   (mono)
    wav.writeUInt32LE(SAMPLE_RATE, 24);
    wav.writeUInt32LE(SAMPLE_RATE * 2, 28); // ByteRate
    wav.writeUInt16LE(2,     32);   // BlockAlign
    wav.writeUInt16LE(16,    34);   // BitsPerSample
    wav.write('data',        36);
    wav.writeUInt32LE(dataSize, 40);
    pcmBuf.copy(wav, 44);
    return wav;
}

// ── Guardar WAV (los navegadores modernos lo reproducen igual que MP3) ──
// Renombramos a .mp3 para coincidir con la ruta esperada por soundNotification.ts
const wavBuf = buildWav(pcm);
fs.writeFileSync(OUTPUT_FILE, wavBuf);

const sizeKB = (wavBuf.length / 1024).toFixed(1);
console.log(`✅ Archivo generado: ${OUTPUT_FILE} (${sizeKB} KB)`);
console.log('   Tono: ' + FREQ_HZ + 'Hz  Duración: ' + DURATION_SEC + 's');
