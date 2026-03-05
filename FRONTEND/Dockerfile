FROM node:22-slim AS build

WORKDIR /app

# Copiamos solo los archivos de configuración primero (caché de Docker eficiente)
COPY package.json ./

# Instalamos de forma estándar, forzando la recreación del lockfile para evitar bugs
# de dependencias nativas opcionales (Tailwind oxide) entre Windows y Linux.
RUN npm install

# Copiamos todo el código
COPY . .

# Declaramos variables de entorno para Vite en tiempo de construcción
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Forzamos la creación del archivo .env localmente en el contenedor
# Esto garantiza al 100% que Vite lea estas variables en el paso `npm run build`
RUN echo "VITE_API_URL=${VITE_API_URL}" >> .env.production && \
    echo "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}" >> .env.production && \
    echo "VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}" >> .env.production

# Construimos la versión optimizada a la carpeta dist/
# Vite va a leer las variables inyectadas en .env.production
RUN npm run build

# Etapa 2: Servidor Web Nginx liviano
FROM nginx:alpine

# Copiamos la build generada
COPY --from=build /app/dist /usr/share/nginx/html

# Configuramos Nginx para Single Page Applications (React Router) y Desactivamos Caché
RUN echo 'server { \
    listen 80; \
    location / { \
    root /usr/share/nginx/html; \
    index index.html index.htm; \
    try_files $uri $uri/ /index.html; \
    } \
    location ~* \.html$ { \
    root /usr/share/nginx/html; \
    expires -1; \
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"; \
    add_header Pragma "no-cache"; \
    } \
    }' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
