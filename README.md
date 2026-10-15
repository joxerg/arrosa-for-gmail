# Arrosa for Gmail

Fork of [Gmail Auto Dark Mode](https://github.com/renefs/gmail-auto-dark-mode) by Rene Fernandez, by BURU labs.
It keeps the original automatic dark mode untouched and adds a pink color layer on top:

- Unread messages: pink sender and subject, plus a pink marker bar
- Read messages: muted grey text, same black background as unread
- Compose button and the selected folder filled in pink
- Gmail's blue accents (cursor bar, text selection, Send button, Unsubscribe link) turned pink
- Email content is left untouched

All Arrosa changes live in `extension/arrosa.css` (plus the recolored icons and the manifest),
so `content.js` stays identical to upstream and upstream updates can be merged cleanly.

Gmail is a trademark of Google LLC. This project is not affiliated with or endorsed by Google.

---

*Original README follows.*

# Gmail Auto Dark Mode

Automatically applies a dark theme to Gmail when your OS is in dark mode — and reverts instantly when you switch back.

![Gmail Auto Dark Mode - Your system switches, Gmail follows](store-assets/png/gmail-light-dark-comparison.png)

## Features

- Follows your OS dark mode preference automatically — no buttons or settings
- Switches in real time without a page reload
- Counter-inverts images, videos, and icons in emails, chats, and side panel companion apps (Keep, Calendar, Tasks, Contacts) so they look normal
- Reapplies the theme after Gmail's internal navigation via a `MutationObserver`
- No data collected — nothing is read, stored, or transmitted

## Screenshots

### Dark theme

![Gmail in dark mode](store-assets/png/gmail-dark-fictional-inbox.png)

### Light theme

![Gmail in light mode](store-assets/png/gmail-light-fictional-inbox.png)

## How it works

Injects a dark theme style adjustment into Gmail on load, driven by the `prefers-color-scheme` Web API. Images, videos, canvases, and icons in Gmail and its integrated side panel companion apps (like Keep, Calendar, Tasks, Contacts) are mathematically counter-inverted to preserve -as much as possible- their original colors and appearance.

## Installation

### Chrome Web Store

[<img src="https://developer.chrome.com/static/docs/webstore/branding/image/HRs9MPufa1J1h5glNhut.png" alt="Available in the Chrome Web Store" height="58">](https://chromewebstore.google.com/detail/gmail-auto-dark-mode/gdpghafiebdcfbkdimnllfimfjllaifb)

### Manual (developer mode)

1. Clone or download this repo.
2. Go to `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the `extension/` subfolder.

## Enabling OS dark mode

The extension activates automatically once your system is in dark mode.

**macOS:** System Settings → Appearance → Dark

**Windows 10/11:** Settings → Personalization → Colors → Dark

**Ubuntu (GNOME):**
```bash
gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'
```

## Privacy

![Private by design](store-assets/png/gmail-private-by-design.png)

No data is collected or transmitted. All processing is local. See [Privacy Policy](PRIVACY.md).

## Development

```bash
zip -r gmail-auto-dark-mode.zip extension/
```

## License

[MIT](LICENSE)