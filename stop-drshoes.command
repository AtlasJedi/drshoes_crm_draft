#!/usr/bin/env bash
# Dwuklikiem zatrzymuje Dr Shoes. Dane (klienci, zlecenia, zdjęcia) zostają nietknięte.

set -e
cd "$(dirname "$0")"

echo ""
echo "Zatrzymuję Dr Shoes..."
docker compose down
echo ""
echo "✅ Aplikacja zatrzymana. Dane zostały zachowane."
echo "   Żeby uruchomić ponownie — dwukliknij start-drshoes.command"
echo ""

read -p "Naciśnij Enter żeby zamknąć..." _
