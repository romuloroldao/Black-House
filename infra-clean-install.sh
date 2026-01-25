#!/bin/bash
# Instalação Limpa de Dependências
# INFRA-05: Force clean install

set -e

echo "🔥 INFRA-05: Instalação limpa de dependências..."
cd /root

echo "Removendo node_modules, dist, build..."
rm -rf node_modules 2>/dev/null || true
rm -rf dist 2>/dev/null || true
rm -rf build 2>/dev/null || true
rm -rf server/node_modules 2>/dev/null || true
rm -rf server/dist 2>/dev/null || true
rm -rf server/build 2>/dev/null || true

echo "Limpando cache do npm..."
npm cache clean --force 2>/dev/null || true

echo "Instalando dependências..."
cd server
npm install

echo "✅ Instalação limpa concluída!"
