# Archivo de Sonido de Notificación

## Instrucciones

El archivo `notification.mp3` debe colocarse en esta carpeta para que las notificaciones reproduzcan sonido.

### Opciones para obtener el archivo de sonido:

#### 1. Usar un sonido online (Recomendado para desarrollo)
Si no tienes un archivo MP3, puedes descargarlo de sitios como:
- Freesound.org
- Zapsplat.com
- Notification sounds gratuitos

El sonido debe ser:
- **Duración**: 0.5 - 1 segundo (breve, no intrusivo)
- **Formato**: MP3, WAV, OGG, o WebM
- **Tamaño**: < 100KB (para carga rápida)
- **Tema**: Campana, ping, o sonido de alerta simple

#### 2. Generar un sonido programáticamente
Ejecuta el siguiente código en la consola del navegador:

```javascript
// Generador de sonido de campana simple
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const now = audioContext.currentTime;
const duration = 0.5;

const osc1 = audioContext.createOscillator();
const gain1 = audioContext.createGain();
osc1.connect(gain1);
gain1.connect(audioContext.destination);

osc1.frequency.setValueAtTime(800, now);
osc1.frequency.exponentialRampToValueAtTime(600, now + duration);
gain1.gain.setValueAtTime(0.3, now);
gain1.gain.exponentialRampToValueAtTime(0.01, now + duration);

osc1.start(now);
osc1.stop(now + duration);
```

Luego descarga el audio capturado.

#### 3. Usar un servidor de notificaciones con sonido
Firebase Cloud Messaging puede reproducir sonidos nativos en Android:
- En `AndroidNotification`, especificar `sound="notification"`
- El sistema operativo reproduce el sonido de notificación por defecto

### Archivos soportados:
- `.mp3` (Recomendado)
- `.wav`
- `.ogg`
- `.webm`
- `.m4a` (iOS)

### Verificación:
Una vez agregado el archivo, prueba abriendo la consola del navegador (F12):

```javascript
// Probar reproducción del sonido
const audio = new Audio('/assets/sounds/notification.mp3');
audio.play().then(() => console.log('Sonido reproducido')).catch(e => console.error('Error:', e));
```

### Alternativa: Sin archivo de sonido
Si no tienes un archivo MP3, el sistema seguirá funcionando:
- El sonido no se reproducirá en web, pero las notificaciones se mostrarán normalmente
- En Android/iOS, Firebase reproducirá el sonido del sistema de notificaciones
- La campanita visual seguirá funcionando

### Licencia de sonidos gratuitos:
Algunos sitios recomendados con licencia Creative Commons 0:
- Zapsplat.com
- Freesound.org (búscar por "notification sound")
- Pixabay.com/sounds

## Pasos para agregar tu archivo:

1. **Descargar o crear un archivo MP3** con las características mencionadas
2. **Guardar en esta carpeta** con el nombre `notification.mp3`
3. **Commit a tu repositorio** (git add, git commit, git push)
4. **Verificar en desarrollo** abriendo un inspector de red (F12) para confirmar que el archivo se carga

¡Listo! Las notificaciones reproducirán sonido automáticamente.
