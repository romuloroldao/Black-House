#!/bin/bash
# Cria swap de 2GB se não existir — reduz risco de OOM em VPS pequena.
set -euo pipefail

SWAP_SIZE="${SWAP_SIZE:-2G}"
SWAP_FILE="/swapfile"

if swapon --show | grep -q "$SWAP_FILE"; then
  echo "Swap já ativo em $SWAP_FILE"
  swapon --show
  exit 0
fi

if [[ -f "$SWAP_FILE" ]]; then
  echo "Ativando swap existente..."
  swapon "$SWAP_FILE"
  exit 0
fi

echo "Criando swap ${SWAP_SIZE} em ${SWAP_FILE}..."
fallocate -l "$SWAP_SIZE" "$SWAP_FILE" || dd if=/dev/zero of="$SWAP_FILE" bs=1M count=2048
chmod 600 "$SWAP_FILE"
mkswap "$SWAP_FILE"
swapon "$SWAP_FILE"

if ! grep -q "$SWAP_FILE" /etc/fstab; then
  echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
fi

sysctl -w vm.swappiness=10
if ! grep -q '^vm.swappiness' /etc/sysctl.conf; then
  echo "vm.swappiness=10" >> /etc/sysctl.conf
fi

echo "Swap configurado:"
swapon --show
free -h
