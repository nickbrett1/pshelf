#!/bin/bash
# This file is executed once per session to set up the devcontainer.
# For example:
# echo "Running devcontainer setup script..."
# npm install

CURRENT_USER=$(whoami)
USER_HOME_DIR="$HOME"

echo "INFO: Restoring or backing up SSH host keys..."
sudo mkdir -p /var/lib/tailscale/ssh
if [ -n "$(ls -A /var/lib/tailscale/ssh/ssh_host_* 2>/dev/null)" ]; then
    echo "INFO: Restoring SSH host keys from /var/lib/tailscale/ssh..."
    sudo cp -f /var/lib/tailscale/ssh/ssh_host_* /etc/ssh/
    sudo chmod 600 /etc/ssh/ssh_host_*_key
    sudo chmod 644 /etc/ssh/ssh_host_*_key.pub 2>/dev/null || true
else
    echo "INFO: Backing up SSH host keys to /var/lib/tailscale/ssh..."
    sudo ssh-keygen -A || true
    sudo cp -f /etc/ssh/ssh_host_* /var/lib/tailscale/ssh/
fi

echo "INFO: Ensuring SSH service is running..."
sudo service ssh restart



echo "INFO: Creating Oh My Zsh custom directories..."
mkdir -p "$USER_HOME_DIR/.oh-my-zsh/custom/themes" "$USER_HOME_DIR/.oh-my-zsh/custom/plugins"

if [ -f "/workspaces/pshelf/.devcontainer/.zshrc" ]; then
    echo "INFO: Copying .zshrc to $USER_HOME_DIR/.zshrc"
    cp "/workspaces/pshelf/.devcontainer/.zshrc" "$USER_HOME_DIR/.zshrc"
    sudo chown "$CURRENT_USER:$CURRENT_USER" "$USER_HOME_DIR/.zshrc"
else
    echo "INFO: /workspaces/pshelf/.devcontainer/.zshrc not found, skipping copy."
fi

if [ -f "/workspaces/pshelf/.devcontainer/.p10k.zsh" ]; then
    echo "INFO: Copying .p10k.zsh to $USER_HOME_DIR/.p10k.zsh"
    cp "/workspaces/pshelf/.devcontainer/.p10k.zsh" "$USER_HOME_DIR/.p10k.zsh"
    sudo chown "$CURRENT_USER:$CURRENT_USER" "$USER_HOME_DIR/.p10k.zsh"
else
    echo "INFO: /workspaces/pshelf/.devcontainer/.p10k.zsh not found, skipping copy."
fi

if [ -f "/workspaces/pshelf/.devcontainer/.tmux.conf" ]; then
    echo "INFO: Copying .tmux.conf to $USER_HOME_DIR/.tmux.conf"
    cp "/workspaces/pshelf/.devcontainer/.tmux.conf" "$USER_HOME_DIR/.tmux.conf"
    sudo chown "$CURRENT_USER:$CURRENT_USER" "$USER_HOME_DIR/.tmux.conf"
else
    echo "INFO: /workspaces/pshelf/.devcontainer/.tmux.conf not found, skipping copy."
fi

echo "INFO: Ensuring doppler directory permissions..."
mkdir -p "$USER_HOME_DIR/.doppler"
sudo chown -R "$CURRENT_USER:$CURRENT_USER" "$USER_HOME_DIR/.doppler"
# Round-5 (memo genproj-fixes-round5): guarantee the CLI is on PATH. The
# Dockerfile installs it for fresh projects, but a regenerated project whose
# Dockerfile was preserved (round-3 idempotent overwrite) needs the fallback.
# (A devcontainer feature was tried first but ghcr.io/devcontainers-contrib
# features are no longer reliably pullable — 'denied'.)
if ! command -v doppler &> /dev/null; then
    echo "INFO: Installing Doppler CLI (fallback)..."
    (curl -Ls --tlsv1.2 --proto "=https" --retry 3 https://cli.doppler.com/install.sh || wget -t 3 -qO- https://cli.doppler.com/install.sh) | sudo sh
fi
# genproj-doppler-context-pin (memo Gi8CN7XqpH6CxFAc2YUJsK): ambient
# DOPPLER_PROJECT/DOPPLER_CONFIG/DOPPLER_ENVIRONMENT from the launching session
# override doppler.yaml (env > yaml) and silently point every 'doppler' command
# at the wrong project. Pin the repo context in ~/.bashrc + ~/.zshrc so new
# shells (including agent-spawned ones) inherit it. The marker keeps the
# append idempotent across post-create re-runs.
DOPPLER_RC_MARKER='# genproj-doppler-context-pin'
if ! grep -qF "$DOPPLER_RC_MARKER" "$HOME/.bashrc" 2>/dev/null; then
    cat >> "$HOME/.bashrc" <<'EOF'
# genproj-doppler-context-pin: this repo's doppler.yaml context wins over ambient env
export DOPPLER_PROJECT=common
export DOPPLER_CONFIG=dev
unset DOPPLER_ENVIRONMENT 2>/dev/null || true

EOF
    echo "INFO: Pinned doppler context (common/dev) in ~/.bashrc"
fi
if ! grep -qF "$DOPPLER_RC_MARKER" "$HOME/.zshrc" 2>/dev/null; then
    cat >> "$HOME/.zshrc" <<'EOF'
# genproj-doppler-context-pin: this repo's doppler.yaml context wins over ambient env
export DOPPLER_PROJECT=common
export DOPPLER_CONFIG=dev
unset DOPPLER_ENVIRONMENT 2>/dev/null || true

EOF
    echo "INFO: Pinned doppler context (common/dev) in ~/.zshrc"
fi
# Apply to this shell too, then verify resolution is never silently wrong.
export DOPPLER_PROJECT=common
export DOPPLER_CONFIG=dev
unset DOPPLER_ENVIRONMENT 2>/dev/null || true
if command -v doppler &> /dev/null && doppler whoami &> /dev/null 2>&1; then
    RESOLVED_PROJECT="$(doppler run -- printenv DOPPLER_PROJECT 2>/dev/null | tail -n 1)"
    if [ -n "$RESOLVED_PROJECT" ] && [ "$RESOLVED_PROJECT" != "common" ]; then
        echo "WARNING: 'doppler run' resolves project '$RESOLVED_PROJECT', but doppler.yaml"
        echo "         declares 'common'. An ambient DOPPLER_* export is overriding"
        echo "         the repo context. Run: unset DOPPLER_PROJECT DOPPLER_CONFIG DOPPLER_ENVIRONMENT"
        echo "         then 'doppler setup --no-interactive --project common --config dev'."
    elif [ -z "$RESOLVED_PROJECT" ]; then
        echo "WARNING: could not resolve the doppler project via 'doppler run'. If"
        echo "         'doppler projects get common' 404s, create it and run"
        echo "         'doppler setup --no-interactive --project common --config dev'."
    else
        echo "INFO: doppler context verified: common/dev"
    fi
fi



echo "INFO: Installing uv tool..."
curl -LsSf https://astral.sh/uv/install.sh | sudo env CARGO_HOME=/usr/local UV_INSTALL_DIR=/usr/local/bin sh

echo "INFO: Installing Cursor CLI..."
curl https://cursor.com/install -fsS | bash





# Setup node dependencies and expose node_modules/.bin on PATH
# (memo: genproj node devcontainer .venv PATH — same class of bug as python
# .venv). postCreate runs with the workspace as CWD, but cd explicitly so
# this also works when invoked from elsewhere.
cd "/workspaces/pshelf" 2>/dev/null || true

if [ -f "package.json" ]; then
    echo "INFO: Installing dependencies with npm install..."
    npm install
fi

# genproj-node-bin-path: expose node_modules/.bin on PATH for shells that do
# NOT inherit devcontainer.json remoteEnv (VS Code terminals get PATH from
# remoteEnv; ssh / 'bash -lc' / tmux panes started outside VS Code do not).
# The marker comment keeps this idempotent across post-create re-runs.
NODE_BIN_MARKER='# genproj-node-bin-path'
if ! grep -qF "$NODE_BIN_MARKER" "$HOME/.bashrc" 2>/dev/null; then
    cat >> "$HOME/.bashrc" <<'EOF'
# genproj-node-bin-path: prefer project node_modules/.bin
if [ -d "/workspaces/pshelf/node_modules/.bin" ]; then
    export PATH="/workspaces/pshelf/node_modules/.bin:$PATH"
fi
EOF
    echo "INFO: Added node_modules/.bin PATH hook to ~/.bashrc"
fi
if ! grep -qF "$NODE_BIN_MARKER" "$HOME/.zshrc" 2>/dev/null; then
    cat >> "$HOME/.zshrc" <<'EOF'
# genproj-node-bin-path: prefer project node_modules/.bin
if [ -d "/workspaces/pshelf/node_modules/.bin" ]; then
    export PATH="/workspaces/pshelf/node_modules/.bin:$PATH"
fi
EOF
    echo "INFO: Added node_modules/.bin PATH hook to ~/.zshrc"
fi



echo "INFO: Configuring git safe directory..."
git config --global --add safe.directory /workspaces/pshelf

echo "INFO: Installing git pre-commit hooks (lint-staged)..."
(cd /workspaces/pshelf && npx --yes simple-git-hooks) || echo "WARN: Run 'npx simple-git-hooks' to install hooks manually."





echo "INFO: Setting up goose configuration and MCP servers..."

# Create goose config directory
mkdir -p "$HOME/.config/goose"

# Never overwrite an existing goose config: the user's real config.yaml
# (provider + extensions) is bind-mounted into the devcontainer. Clobbering it
# drops the configured provider and surfaces as:
#   error: No provider configured. Run 'goose configure' first.
if [ -f "$HOME/.config/goose/config.yaml" ]; then
    echo "INFO: Keeping existing $HOME/.config/goose/config.yaml (provider + extensions preserved)."
else
    echo "INFO: No goose config found yet - run 'goose configure' inside the container to set up your provider."
fi

echo "INFO: Registering project-selected goose MCP extensions..."

# Idempotently register a project-selected goose MCP extension. Never clobbers:
# skips keys already present, only appends the missing block under extensions:.
ensure_goose_extension() {
  local key="$1" block="$2" config="$HOME/.config/goose/config.yaml"
  [ -f "$config" ] || { echo "WARN: no goose config yet - project extensions apply after 'goose configure'"; return 0; }
  grep -qE "^  ${key}:" "$config" && { echo "INFO: goose extension '${key}' already registered."; return 0; }
  grep -q '^extensions:' "$config" || echo "extensions:" >> "$config"
  awk -v frag="$block" '/^extensions:/ { print; printf "%s", frag; next } { print }' "$config" > "${config}.tmp" && mv "${config}.tmp" "$config"
  echo "INFO: Registered goose extension '${key}'."
}

ensure_goose_extension "circleci" '  circleci:
    type: stdio
    name: circleci
    enabled: true
    cmd: doppler
    args: ["run", "--", "npx", "-y", "@circleci/mcp-server-circleci"]
    timeout: 300
'

echo "INFO: Ensuring goose recipes are available (spec-first development process)..."
RECIPES_DIR="$HOME/.config/goose/recipes"
if [ -d "$RECIPES_DIR/.git" ]; then
    (cd "$RECIPES_DIR" && git pull --ff-only --quiet)         || echo "WARN: Could not update goose-recipes (offline or conflict); keeping existing copy."
else
    mkdir -p "$HOME/.config/goose"
    git clone --quiet https://github.com/nickbrett1/goose-recipes.git "$RECIPES_DIR"         || echo "WARN: Could not clone goose-recipes; recipes will be unavailable."
fi

echo "INFO: goose configuration complete."





echo "INFO: Checking Tailscale status..."
if ! command -v tailscale &> /dev/null; then
    echo "INFO: Installing Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
fi

if ! pgrep -x tailscaled > /dev/null; then
    echo "INFO: Starting Tailscale daemon..."
    sudo start-stop-daemon --start --background --oknodo --pidfile /var/run/tailscaled.pid --make-pidfile --exec /usr/sbin/tailscaled -- --state=/var/lib/tailscale/tailscaled.state
fi

echo -e "\nINFO: Custom container setup script finished."
echo -e "\n⚠️  To complete cloud login, run:"
echo "    cd /workspaces/pshelf && bash scripts/cloud_login.sh"
