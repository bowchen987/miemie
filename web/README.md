# miemie PWA

This is the no-Apple-Developer-account trial version of miemie.

## Run Locally

From the project root:

```sh
./scripts/start_pwa.sh
```

The default address is:

```text
http://0.0.0.0:8787
```

Open the Mac's LAN IP from both iPhones, for example:

```text
http://192.168.1.23:8787
```

Then use Safari's Share menu to add the page to the Home Screen.

## Current Trial Capabilities

- Add todos, resources, messages, and photos.
- Toggle todo status between incomplete and completed.
- Filter all / todos / resources / messages.
- Sync changes in real time while both web apps are open.
- Sync foreground location and show the latest distance.
- Show browser notifications while the PWA is open and notification permission is granted.

## Public Deployment On Render

The repo includes a Render Blueprint at `../render.yaml`.

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Open Render Dashboard and create a new Blueprint from that repository.
3. Render will create one Node web service named `miemie-pwa`.
4. Fill the `FAMILY_CODE` secret when Render prompts for it. Both phones will enter this same code.
5. The service uses `DATA_DIR=/var/data/miemie` and a 1 GB persistent disk mounted at `/var/data`.
6. After deploy, open the `https://*.onrender.com` URL on both iPhones in Safari.
7. Use Safari's Share menu to add miemie to the Home Screen.

This setup is intended for daily use because posts and uploaded photos survive deploys and restarts. Render persistent disks are only available on paid services, and the disk keeps the service single-instance.

## Production Notes

- iOS Web Push for background notifications requires HTTPS and a Web Push subscription flow.
- HTTPS is required for reliable Home Screen PWA, geolocation, and notification behavior.
- Local development stores data in `web/data/`, which is intentionally ignored by git.
- Public deployment stores data under `DATA_DIR`.
- Set `FAMILY_CODE` in production so family data is not open to anyone who finds the URL.
