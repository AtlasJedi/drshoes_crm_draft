#!/usr/bin/env bash
# Dwuklikiem otwiera Terminal i uruchamia Dr Shoes.
# Nie wymaga znajomości terminala. Pierwsze uruchomienie trwa ~5 min (build).

set -e
cd "$(dirname "$0")"

echo ""
echo "================================================"
echo "  Dr Shoes — uruchamiam aplikację"
echo "================================================"
echo ""

# 1. Sprawdź czy Docker działa
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker Desktop NIE jest uruchomiony."
  echo ""
  echo "Co zrobić:"
  echo "  1. Otwórz aplikację 'Docker Desktop' (Spotlight: Cmd+Spacja → wpisz 'Docker')"
  echo "  2. Poczekaj aż ikonka wieloryba na pasku menu przestanie migać"
  echo "  3. Kliknij ponownie ten skrypt"
  echo ""
  read -p "Naciśnij Enter żeby zamknąć..." _
  exit 1
fi

echo "✓ Docker działa"

# 2. Utwórz .env z szablonu jeśli nie istnieje
if [ ! -f .env ]; then
  echo "✓ Tworzę plik konfiguracyjny .env z szablonu"
  cp .env.example .env
fi

# 3. Wystartuj wszystko
echo ""
echo "Uruchamiam kontenery (pierwsze uruchomienie ~5 min, kolejne <1 min)..."
echo ""
docker compose up -d --build

# 4. Poczekaj aż backend będzie gotowy
echo ""
echo "Czekam aż backend wstanie..."
for i in {1..60}; do
  if curl -fsS http://localhost:8080/actuator/health > /dev/null 2>&1; then
    break
  fi
  printf "."
  sleep 2
done
echo ""

# 5. Poczekaj aż frontend będzie gotowy
echo "Czekam aż panel admina wstanie..."
for i in {1..30}; do
  if curl -fsS http://localhost:3000 > /dev/null 2>&1; then
    break
  fi
  printf "."
  sleep 2
done
echo ""

# 6. Otwórz przeglądarkę
echo ""
echo "================================================"
echo "  ✅ Dr Shoes działa!"
echo "================================================"
echo ""
echo "  Panel admina: http://localhost:3000/admin/login"
echo ""
echo "  Login początkowy:"
echo "     Email:  misza@drshoes.pl"
echo "     Hasło:  change-me-on-first-login"
echo ""
echo "  ⚠️  Po pierwszym logowaniu zmień hasło — zobacz HANDOFF.md sekcja 5"
echo ""
echo "================================================"
echo ""

open "http://localhost:3000/admin/login"

read -p "Naciśnij Enter żeby zamknąć to okno (aplikacja działa dalej w tle)..." _
