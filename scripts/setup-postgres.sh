#!/bin/bash
# Script para configurar PostgreSQL no servidor

set -e

echo "=== Configurando PostgreSQL ==="

# Atualizar sistema
echo "Atualizando sistema..."
sudo apt update && sudo apt upgrade -y

# Instalar PostgreSQL 15
echo "Instalando PostgreSQL 15..."
sudo apt install postgresql-15 postgresql-contrib-15 -y

# Iniciar e habilitar serviço
echo "Iniciando PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Solicitar informações do banco
read -p "Nome do banco de dados [blackhouse_db]: " DB_NAME
DB_NAME=${DB_NAME:-blackhouse_db}

read -p "Nome do usuário [app_user]: " DB_USER
DB_USER=${DB_USER:-app_user}

read -sp "Senha do usuário: " DB_PASSWORD
echo

# Criar usuário e banco
echo "Criando usuário e banco de dados..."
sudo -u postgres psql <<EOF
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
\q
EOF

# Instalar extensões
echo "Instalando extensões PostgreSQL..."
sudo -u postgres psql -d $DB_NAME <<EOF
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
\q
EOF

echo "=== PostgreSQL configurado com sucesso! ==="
echo "Banco: $DB_NAME"
echo "Usuário: $DB_USER"
echo ""
echo "Próximos passos:"
echo "1. Execute o script de migração: psql -U $DB_USER -d $DB_NAME -f migration/migration_postgres.sql"
echo "2. Configure o arquivo server/.env com as credenciais acima"
