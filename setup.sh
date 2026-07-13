#!/usr/bin/env bash
# Bootstraps this project on a fresh machine: installs Docker if missing,
# generates a .env with a random WEB_UI_PASSWORD if one doesn't exist,
# configures the firewall (Linux/ufw), then builds and starts the stack
# (evilginx + gophish, both start by default — gophish's admin container is
# where the web console's restart/logs features point). Safe to re-run.
#
# Usage: ./setup.sh [--no-firewall]

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

SKIP_FIREWALL=0
for arg in "$@"; do
  case "$arg" in
    --no-firewall) SKIP_FIREWALL=1 ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$1" >&2; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$1" >&2; exit 1; }

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null 2>&1 && SUDO="sudo"
fi

install_docker_linux() {
  log "Docker not found — installing via Docker's official convenience script"
  curl -fsSL https://get.docker.com | $SUDO sh
  if [ -n "$SUDO" ] && ! groups "$USER" 2>/dev/null | grep -q '\bdocker\b'; then
    $SUDO usermod -aG docker "$USER" || true
    warn "Added $USER to the docker group — log out/in (or run 'newgrp docker') for it to take effect."
    warn "Using sudo for the rest of this run instead."
    DOCKER_CMD="$SUDO docker"
  fi
}

DOCKER_CMD="docker"

if ! command -v docker >/dev/null 2>&1; then
  case "$(uname -s)" in
    Linux) install_docker_linux ;;
    Darwin) die "Docker not found. Install Docker Desktop for Mac: https://www.docker.com/products/docker-desktop then re-run this script." ;;
    *) die "Docker not found and this OS isn't auto-installable. Install Docker manually: https://docs.docker.com/get-docker/" ;;
  esac
else
  # Docker present but current user can't talk to the daemon without sudo.
  if ! docker info >/dev/null 2>&1 && [ -n "$SUDO" ]; then
    DOCKER_CMD="$SUDO docker"
  fi
fi

$DOCKER_CMD info >/dev/null 2>&1 || die "Docker is installed but not usable (daemon not running, or permissions). Check 'docker info' manually."

if $DOCKER_CMD compose version >/dev/null 2>&1; then
  COMPOSE="$DOCKER_CMD compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  die "Neither 'docker compose' nor 'docker-compose' is available. Install the Compose plugin: https://docs.docker.com/compose/install/"
fi

setup_firewall() {
  if [ "$(uname -s)" != "Linux" ]; then
    return
  fi
  if ! command -v ufw >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
      log "Installing ufw"
      $SUDO apt-get update -qq && $SUDO apt-get install -y -qq ufw
    else
      warn "ufw not found and no apt-get to install it — configure your firewall manually (allow SSH, 80/tcp, 443/tcp, 53/udp)."
      return
    fi
  fi

  log "Configuring firewall (ufw): SSH, 80/tcp, 443/tcp, 53/udp"
  # SSH first, always — enabling ufw before this rule exists can lock you
  # out of the very box you're running this script on. Falls back to the
  # raw port in case the 'OpenSSH' app profile isn't registered (happens on
  # some minimal images) — either way this must succeed before `ufw enable`.
  $SUDO ufw allow OpenSSH || $SUDO ufw allow 22/tcp
  $SUDO ufw allow 80/tcp
  $SUDO ufw allow 443/tcp
  $SUDO ufw allow 53/udp   # only needed if evilginx is your domain's authoritative nameserver; harmless otherwise
  $SUDO ufw --force enable
  $SUDO ufw status
}

if [ "$SKIP_FIREWALL" -eq 0 ]; then
  setup_firewall
else
  log "Skipping firewall configuration (--no-firewall)"
fi

if [ ! -f .env ]; then
  log "Generating .env with a random WEB_UI_PASSWORD"
  if command -v openssl >/dev/null 2>&1; then
    PASSWORD=$(openssl rand -hex 20)
  else
    PASSWORD=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  fi
  # Writes to a new file rather than using sed -i, whose in-place syntax
  # differs between BSD (macOS) and GNU (Linux) sed.
  sed "s#^WEB_UI_PASSWORD=.*#WEB_UI_PASSWORD=${PASSWORD}#" .env.example > .env
else
  log ".env already exists — leaving it as-is"
fi

log "Building and starting the stack (this can take a few minutes on first run)"
$COMPOSE up -d --build

WEB_UI_PASSWORD=$(grep '^WEB_UI_PASSWORD=' .env | cut -d= -f2-)

log "Done"
echo "  Web console : http://127.0.0.1:8080  (password: ${WEB_UI_PASSWORD})"
echo "  Gophish     : https://127.0.0.1:3333  (self-signed cert — see README for first-run admin password via 'docker compose logs gophish')"
echo
echo "Next: set your domain/IP on the Config page (or 'docker compose exec evilginx' style access via the Terminal page), see README.md for details."
