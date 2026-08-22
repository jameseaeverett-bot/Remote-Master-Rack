# Remote Master Rack — Holding Page & Owner Portal

A small static holding page for Remote Master Rack, plus the first Owner Portal module: Website Content.

## Edit public wording

1. Open `owner-portal.html` through the local preview server.
2. Edit the fields in Website Content and choose **Save content file**.
3. Select this project’s `website-content.json` when prompted.
4. Save, commit, and push.

## Preview locally

From this folder, run:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173/owner-portal.html` to use the Owner Portal.

The public homepage reads `website-content.json` dynamically. Future Owner Portal modules belong beside `owner-portal.html` and can use the existing module navigation without redesigning the shell.
