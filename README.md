# Metabase TV

A static Vite React app for rotating public Metabase dashboards on shared TVs.
It loads dashboard URLs from `public/config.json`, renders one dashboard at a
time in a fullscreen iframe, and advances automatically.

## Configure Dashboards

Edit `public/config.json`:

```json
{
  "defaults": {
    "durationSeconds": 60
  },
  "dashboards": [
    {
      "title": "Sales Overview",
      "url": "https://metabase.example.com/public/dashboard/abc123",
      "accent": "#2f7d80"
    }
  ]
}
```

The current config contains the Hidden Skipper public Metabase dashboards.

## Run Locally

```bash
npm install
npm run dev
```

Open the printed localhost URL on the TV. For Chrome kiosk mode on Windows, use:

```powershell
chrome.exe --kiosk http://localhost:5173
```

## Build

```bash
npm run build
```

The static output is written to `dist/`.

## Azure Static Web Apps

Use these build settings:

- App location: `/`
- Output location: `dist`
- Build command: `npm run build`

## Notes

- Public Metabase links must allow iframe embedding.
- For private dashboards, signed Metabase embeds are the safer long-term path.
- Cross-origin dashboards cannot be auto-scrolled from the parent page, so each
  dashboard should be designed to fit the TV viewport.
