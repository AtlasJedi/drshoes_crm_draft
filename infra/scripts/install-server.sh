#!/usr/bin/env bash
# Dr Shoes — one-time server hardening for Ubuntu 24.04 on Hetzner Cloud.
# Run as root on a fresh box. Idempotent — safe to re-run.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "==> apt update + upgrade"
apt-get update
apt-get upgrade -y

echo "==> Installing system packages"
apt-get install -y --no-install-recommends \
    docker.io docker-compose-v2 \
    caddy \
    zstd awscli \
    ufw fail2ban unattended-upgrades \
    git curl ca-certificates

echo "==> Ensuring 'deploy' user exists"
if ! id -u deploy >/dev/null 2>&1; then
    adduser --disabled-password --gecos "" deploy
fi
usermod -aG docker,sudo deploy

# Mirror root's authorized_keys to deploy if deploy has none yet.
if [ -f /root/.ssh/authorized_keys ] && [ ! -f /home/deploy/.ssh/authorized_keys ]; then
    install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
    install -o deploy -g deploy -m 600 /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
fi

# Allow deploy to sudo systemctl reload caddy without password (used by deploy.sh).
cat > /etc/sudoers.d/deploy-caddy-reload <<'SUDOERS'
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl reload caddy
SUDOERS
chmod 440 /etc/sudoers.d/deploy-caddy-reload

echo "==> SSH hardening"
cat > /etc/ssh/sshd_config.d/99-hardening.conf <<'CONF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
MaxAuthTries 3
CONF
systemctl restart ssh

echo "==> UFW (deny incoming except SSH/80/443)"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> fail2ban + unattended-upgrades"
systemctl enable --now fail2ban
echo 'APT::Periodic::Unattended-Upgrade "1";' > /etc/apt/apt.conf.d/20auto-upgrades
echo 'APT::Periodic::Update-Package-Lists "1";' >> /etc/apt/apt.conf.d/20auto-upgrades

echo "==> /opt/drshoes (owned by deploy)"
install -d -o deploy -g deploy -m 755 /opt/drshoes

echo "==> Enable services"
systemctl enable --now docker
systemctl enable --now caddy

echo
echo "==> DONE. Next steps:"
echo "   su - deploy"
echo "   cd /opt/drshoes"
echo "   git clone <repo-url> ."
echo "   cp infra/.env.prod.example .env.prod && chmod 600 .env.prod"
echo "   # edit .env.prod, fill in [ZMIEŃ] values"
echo "   sudo ln -sf /opt/drshoes/infra/Caddyfile.prod /etc/caddy/Caddyfile"
echo "   sudo systemctl reload caddy"
echo "   ./infra/scripts/deploy.sh"
