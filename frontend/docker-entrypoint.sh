#!/bin/sh
# Genera config.js a runtime con le variabili d'ambiente
cat > /usr/share/nginx/html/config.js <<EOF
window.__API_URL__ = "${VITE_API_URL:-}";
EOF

# Avvia nginx tramite il meccanismo template standard
exec /docker-entrypoint.sh "$@"
