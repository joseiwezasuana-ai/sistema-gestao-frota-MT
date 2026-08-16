#!/bin/bash

# Parar a execução se algum comando falhar
set -e

APP_DIR="$(pwd)"
BACKUP_DIR="$APP_DIR/backups"
TIMESTAMP=$(date +"%Y%m%m_%H%M%S")

echo "🚀 Iniciando o processo de deploy do TaxiControl..."

# 1. Criar pasta de backup se não existir
mkdir -p "$BACKUP_DIR"

# 2. Backup de segurança do arquivo .env
if [ -f "$APP_DIR/.env" ]; then
    echo "📦 Criando backup do arquivo .env..."
    cp "$APP_DIR/.env" "$BACKUP_DIR/.env.backup_$TIMESTAMP"
else
    echo "⚠️  Aviso: Arquivo .env não encontrado na raiz!"
fi

# 3. Instalar/Atualizar dependências do Node.js
echo "📥 Instalando dependências..."
npm install --production=false

# 4. Gerar o build de produção (Vite + backend)
echo "🛠️  Executando build da aplicação..."
npm run build

# 5. Reiniciar a aplicação
echo "🔄 Reiniciando o servidor..."

# Opção A: Se você utiliza PM2 (Recomendado para produção)
if command -v pm2 &> /dev/null; then
    pm2 restart taxicontrol || pm2 start dist/server.js --name "taxicontrol"
# Opção B: Reinício básico de processo Node
else
    echo "ℹ️  PM2 não detectado. Garanta que seu gerenciador de processos (systemd/docker) receba o sinal de restart."
fi

echo "✅ Deploy concluído com sucesso!"