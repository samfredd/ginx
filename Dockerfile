FROM golang:1.22-bookworm AS gobuilder

ARG EVILGINX_VERSION=master
WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates make \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch ${EVILGINX_VERSION} https://github.com/kgretzky/evilginx2.git . \
    || git clone --depth 1 https://github.com/kgretzky/evilginx2.git .

RUN go build -o /build/evilginx .

FROM node:20-bookworm-slim AS frontend-builder

WORKDIR /build
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates libcap2-bin python3 build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -d /home/evilginx -s /bin/bash evilginx

WORKDIR /app

COPY --from=gobuilder /build/evilginx /app/evilginx
COPY --from=gobuilder /build/phishlets /app/phishlets
COPY --from=gobuilder /build/redirectors /app/redirectors

# Allow the non-root evilginx user to bind ports 80/443/53 directly.
RUN setcap 'cap_net_bind_service=+ep' /app/evilginx

COPY backend/package.json /app/backend/package.json
RUN cd /app/backend && npm install --omit=dev \
    && apt-get purge -y python3 build-essential && apt-get autoremove -y

COPY backend/src /app/backend/src
COPY --from=frontend-builder /build/dist /app/backend/public

RUN mkdir -p /home/evilginx/.evilginx \
    && chown -R evilginx:evilginx /home/evilginx /app

# Runs as root, not the 'evilginx' user: the backend needs to reach
# /var/run/docker.sock to restart the sibling gophish container, and that
# mount is already root-equivalent access to the whole host — dropping to a
# non-root user inside the container wouldn't meaningfully reduce that,
# while requiring extra machinery (matching the socket's host-side group
# GID, which varies per host) to make it work at all. The setcap grant above
# is harmless but no longer load-bearing now that we're root.
ENV HOME=/home/evilginx
ENV EVILGINX_BIN=/app/evilginx
ENV PHISHLETS_DIR=/app/phishlets
ENV REDIRECTORS_DIR=/app/redirectors
ENV EVILGINX_CONFIG_DIR=/home/evilginx/.evilginx
ENV WEB_UI_PORT=8080

EXPOSE 443/tcp 80/tcp 53/udp 8080/tcp

ENTRYPOINT ["node", "/app/backend/src/server.js"]
