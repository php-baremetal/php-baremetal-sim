# Deploying the php-baremetal simulator

Three GitHub Actions, all started by hand (Actions → workflow → **Run workflow**):

| Repository | Workflow | What it does |
|---|---|---|
| `php-baremetal-sim-qemu` | **php-baremetal: libqemu release** | builds `libqemu-*.so` and publishes them with the ROMs as a Release (`qemu-…` tag). Needed once, and again only when the QEMU source changes. |
| `php-baremetal-sim` | **php-baremetal: image** | builds `Dockerfile.php-baremetal` and pushes `ghcr.io/php-baremetal/php-baremetal-sim:{latest,sha-…}` |
| `php-baremetal-sim` | **php-baremetal: deploy** | on the server: pulls the chosen tag, restarts the container, checks `/health` |

## One-time setup

### GitHub
1. `php-baremetal-sim-qemu`: Actions → run **php-baremetal: libqemu release** with tag `qemu-98580369`
   (or push that tag). Disable **sync-jira** (hourly cron from the imported tree).
2. `php-baremetal-sim`: Settings → Secrets → Actions → `PHPBM_READ_TOKEN` = a fine-grained token,
   repository `php-baremetal/phpbm`, permission **Contents: read**.
3. `php-baremetal-sim`: Settings → Environments → **production** (optionally "Required reviewers"),
   with the secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` (and `DEPLOY_PORT` if not 22).
4. `php-baremetal-sim`: Actions → disable the upstream workflows this fork does not use:
   `library-compile` (daily cron), `discord-issues`, `discord-release-notify`.
5. After the first image: Organization → Packages → `php-baremetal-sim` → Package settings →
   **Change visibility: public** (the server then pulls without a token; the code is AGPL anyway).
   While it is private, add `GHCR_READ_TOKEN` (read:packages) to the production environment.

### Server (Debian/Ubuntu, ≥ 2 vCPU / 4 GB RAM, ~15 GB disk for the image)
```bash
# Docker + compose plugin: https://docs.docker.com/engine/install/
sudo useradd -m -s /bin/bash -G docker deploy
sudo mkdir -p /opt/php-baremetal-sim && sudo chown deploy: /opt/php-baremetal-sim

# deploy key: generate on your PC, public half on the server
ssh-keygen -t ed25519 -f php-baremetal-deploy -N '' -C github-actions-deploy
# → php-baremetal-deploy.pub into ~deploy/.ssh/authorized_keys
# → php-baremetal-deploy (private) into the DEPLOY_SSH_KEY secret
ssh-keyscan -t ed25519 <server>   # → DEPLOY_KNOWN_HOSTS secret
```
HTTPS: install Caddy and use `deploy/Caddyfile` (change the host name); point the DNS
record of `sim.php-baremetal.com` at the server. The container listens only on `127.0.0.1:3080`.

## A release
1. **php-baremetal: image** (inputs: QEMU release tag, phpbm ref) → note the `sha-…` tag in the summary.
2. **php-baremetal: deploy** with `latest` or that `sha-…` tag. To roll back, deploy an older `sha-…`.

The site's "Source of this site" link points at the exact commit the image was built from
(`VITE_SOURCE_URL`), as the AGPLv3 asks for a network service.
