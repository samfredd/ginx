# Evilginx (Docker Lab Setup + Web Console)

A containerized build of [Evilginx2/3](https://github.com/kgretzky/evilginx2) for
**isolated lab use only** — testing your own domains/infrastructure, learning how
reverse-proxy phishing kits work, or defensive research (e.g. building detections).
Includes a password-protected web UI for managing everything without touching
the CLI, though the CLI is always one click away in the built-in Terminal page.

Do not point this at real third-party services, other people's accounts, or
domains you do not own/control.

## Prerequisites

- Docker + Docker Compose
- A domain you own, with DNS you can point at this host (Evilginx needs to be
  the authoritative host for the phishing subdomains it issues, and can act as
  its own DNS nameserver on UDP/53)
- Ports 80, 443, and 53 free on the host

## Build & run

Fastest path on a fresh machine: `./setup.sh` (installs Docker if missing,
generates `.env` with a random password, builds, and starts everything). See
[Fresh-machine setup](#fresh-machine-setup) below for details, or do it by hand:

```bash
cp .env.example .env
# edit .env and set WEB_UI_PASSWORD to something long and random
docker compose up -d --build
```

Then open **http://127.0.0.1:8080** and sign in with `WEB_UI_PASSWORD`. The
web UI port is bound to `127.0.0.1` only by default (not exposed on your LAN)
— edit the port mapping in `docker-compose.yml` if you need remote access, and
put it behind a reverse proxy / VPN rather than exposing it directly.

The full Evilginx console is also still available directly:

```bash
docker attach evilginx      # Ctrl+P, Ctrl+Q to detach without stopping
```

## Web UI

- **Dashboard** — phishlet status/visibility, active lures, captured sessions
  at a glance; upload an existing phishlet YAML or jump into the Builder
- **Phishlet Builder** — form-based phishlet creation (proxy hosts, sub
  filters, auth tokens, credentials, login) with a live YAML preview you can
  also hand-edit directly (takes over from the form once you start typing)
- **Phishlet detail page** — enable/disable/hide/unhide, set hostname,
  override `unauth_url`, generate hosts-file entries, create/delete child
  phishlets (templated phishlets with custom params), and a raw YAML editor
- **Lures** — create/delete, get URL, pause/unpause, and edit every field
  (hostname, path, redirector, ua_filter, redirect_url, phishlet, info,
  opengraph title/description/image/url)
- **Sessions** — view captured credentials/tokens, view full detail, delete
- **Blacklist** — mode (all/unauth/noadd/off), log toggle, and a direct editor
  for the IP/mask list
- **Config** — domain, external/bind IP, autocert toggle + certificate test,
  custom certificate upload (bypasses Let's Encrypt for a given domain),
  outbound proxy (type/address/port/credentials), Gophish integration, a
  direct `config.json` editor, plus a raw `config <args>` escape hatch
- **File Editor** — browse and directly edit any file under `phishlets/`,
  `redirectors/`, or the Evilginx config directory; HTML files can be
  previewed rendered (sandboxed iframe) as well as edited as source
- **Live Logs** — read-only, colorized live tail of the Evilginx console
  (history + streaming) — safe to leave open without risk of sending input
- **Terminal** — a real terminal (xterm.js) wired straight into the running
  Evilginx console over a WebSocket, for anything the other pages don't cover
- **Command Reference** — every Evilginx console command and its description,
  pulled live from Evilginx's own `help` output, with one-click copy
- **Gophish** — container status, a live log tail (`gophish.log`, including
  the first-run admin password after a restart), and a restart button

Phishlets can be uploaded (Dashboard → **Upload phishlet**) as well as built
from the form or hand-written in the raw editor.

**Important:** Evilginx only scans the `phishlets/` directory at startup, so
phishlets created or deleted through the Builder/File Editor won't be usable
(enable, hostname, etc.) until Evilginx restarts. The Builder does this
automatically after creating a phishlet; otherwise use the **Restart evilginx**
button in the sidebar. This restarts only the Evilginx child process, not the
container — its config/certs/sessions persist across it.

## First-time configuration

Via the Config page, or directly in the Terminal:

```
config domain yourlab.example
config ipv4 external <public-ip-of-this-host>
```

Evilginx auto-generates Let's Encrypt certs for phishlet domains once DNS is
pointed correctly and the phishlet is enabled.

Enable a phishlet and create a lure (via the UI, or in the Terminal):

```
phishlets hostname <phishlet-name> yourlab.example
phishlets enable <phishlet-name>
lures create <phishlet-name>
lures get-url 0
```

## Gophish (campaign tracking)

A [Gophish](https://github.com/gophish/gophish) instance is included as a
second service (`gophish`), built from source the same way Evilginx is, and
starts by default alongside Evilginx. Its own phishing-page server is never
published — Evilginx handles that — only its admin API is used.

```bash
docker compose logs gophish | grep "Please login"
```

That log line has the auto-generated admin username/password for first login
(also visible in the web console's **Gophish** page, which tails this same
log). Then:

1. Open **https://127.0.0.1:3333** (self-signed cert — accept the browser warning)
   and log in with the credentials from the log line above.
2. Create an API key for your account (Account Settings in the Gophish UI).
3. In the web console's **Config** page → Gophish integration:
   - Admin URL: `https://gophish:3333` (resolves over the Docker network —
     this container, not your host, is what needs to reach it)
   - API key: paste what you generated
   - Click **Allow self-signed cert**, then **Test connection**

The web console's **Gophish** page shows the container's running/restart
status, tails `gophish.log` live, and can restart the container — see
[Notes](#notes) for how that's implemented and what it costs security-wise.

Gophish's own data (sqlite db, self-signed admin cert, logs) persists in the
`gophish-data` volume, independent of the `evilginx-*` volumes.

## Data persistence

Everything a user creates through the UI survives container rebuilds/recreates
via named volumes:

- `evilginx-data` → `/home/evilginx/.evilginx` (config, certs, sessions)
- `evilginx-phishlets` → `/app/phishlets` (built-in `example.yaml` plus
  anything created via the Builder/File Editor)
- `evilginx-redirectors` → `/app/redirectors`
- `gophish-data` → `/data` in the `gophish` container (db, admin cert, logs)

## Stopping / cleaning up

```bash
docker compose down          # stop, keep data volumes
docker compose down -v       # stop and wipe all data volumes
```

## Fresh-machine setup

`./setup.sh` bootstraps a brand-new Linux host (e.g. a fresh cloud VPS for a
lab engagement) end to end:

```bash
git clone <this-repo-url>
cd ginx
./setup.sh
```

It installs Docker + the Compose plugin if they're missing (via the
distro's package manager — apt/dnf/yum, or Docker's convenience script as a
fallback), generates `.env` with a random `WEB_UI_PASSWORD` if one doesn't
already exist, then runs `docker compose up -d --build` and prints the access
URL and password (both Evilginx and Gophish). Safe to re-run — it won't
overwrite an existing `.env` or touch containers beyond rebuilding/restarting
them.

## Notes

- **The `evilginx` container runs as root and has `/var/run/docker.sock`
  mounted into it**, so the web console can restart the sibling `gophish`
  container (Gophish has no API of its own to restart itself — the only way
  to bounce it is at the container level). This is root-equivalent access to
  your Docker host: anything with a shell in this container can control any
  other container, mount arbitrary host paths, etc. It's the standard
  tradeoff any container-management UI makes (Portainer, Watchtower, etc.),
  consistent with this project's isolated-lab threat model — but it's worth
  knowing it's there. If you'd rather not grant it, remove the
  `/var/run/docker.sock` volume line and the `GOPHISH_*` env vars from the
  `evilginx` service in `docker-compose.yml`; you'll lose the Gophish page's
  restart button and live logs (its own log line still prints to `docker
  compose logs gophish` either way) but nothing else depends on the socket.
- Only the build stage has network access to fetch source; adjust the
  `EVILGINX_VERSION` build arg to pin a specific git tag/branch instead of
  `master` if you want reproducible builds.
- Port 53/udp is only needed if you're using Evilginx as the authoritative
  nameserver for your lab domain. If your DNS is handled elsewhere (e.g. an
  A/CNAME record pointing at this host from a registrar), you can drop that
  port mapping.
- Set `DEBUG_EVILGINX_PTY=1` in the environment before `docker compose up` to
  have the backend log the raw/cleaned PTY buffers for each console command —
  useful if you're debugging the web UI's command parsing itself.
- Phishlet names can't contain underscores — Evilginx derives a phishlet's
  registered name from its filename using a regex that doesn't include `_`,
  so e.g. `new_phishlet.yaml` would silently register as just `phishlet`. The
  Builder/upload/API all reject underscores outright to avoid this; use
  hyphens instead.
