# Portfolio Studio

To use a downloaded copy of the GitHub repository on Windows, extract the ZIP, install Node.js 20+ and GitHub CLI, and run `gh auth login` as `abanoubgeorge20`. Then open the launcher below. GitHub Pages serves the public portfolio; the administration server runs locally on your computer.

Double-click `Open-Portfolio-Admin.cmd` in the parent folder. The dashboard opens at http://127.0.0.1:4318 and uses the GitHub CLI login on this Windows computer.

On first launch, create your own password of 12–128 characters. The launcher opens a one-time setup link. After setup, sign in with that password. Use **Sign out** when finished. Sessions expire after 8 hours or when the server restarts. Five incorrect attempts temporarily block login for five minutes.

Password authentication is enforced by the server for project reads and publication. Only a salted scrypt hash is stored in the local `.private` folder; session cookies are HttpOnly and SameSite=Strict. That folder must never be uploaded or included in shared backups. Keep access to your Windows account private as well, since it owns the files and GitHub login.

1. Click **New project**.
2. Add a title, description, category, image, tags, and optional live/code links.
3. Click **Save to draft**.
4. Click **Publish changes** to update GitHub. The status message tracks deployment.

Edit, delete, or reorder existing projects before publishing. Draft changes remain in browser memory. Use **Export draft** before closing if you want to resume later; **Import draft** restores projects and new images. Reload asks before discarding unpublished work.

## Client Reviews

Use **Client Reviews → Add review** to add feedback as text, a screenshot, or both. Upload a PNG, JPG, or WebP screenshot (up to 5 MB), preview it, and optionally add the platform name and an HTTPS link to the original review. A screenshot can be published without retyping the feedback or client name. With text-only reviews, a client name is required. Role/company and 1–5 star rating are optional.

Screenshots can be replaced or removed. Visitors can enlarge the full image and follow the original review link. Reviews can be edited, deleted, and reordered. **Save to draft** keeps changes unpublished; **Publish changes** saves projects, reviews, and their new images together. The public section appears after the first review is published and disappears when the last review is removed. No sample testimonials are published.

Draft exports include reviews and their uploaded screenshots. Importing an older project-only draft preserves the reviews currently loaded. Up to 50 reviews are supported.

## Personal Profile

Open **Personal Profile** near the top of the dashboard. Choose a PNG, JPG, or WebP photo up to 5 MB. The preview uses the same framing as the public portrait. Use **Cancel selection** to discard a new selection, or **Save photo to draft** to keep it. Then select **Publish changes** to update your public photo.

The selected image is included in draft exports and is uploaded atomically with the site update. Importing older drafts preserves your current profile photo. Publishing project or review changes also preserves the profile photo unless you explicitly replace it. The existing image file is retained in GitHub history and assets.

The server listens only on this computer. GitHub credentials stay in GitHub CLI, never in browser storage or the public website. Only portfolio project data, generated gallery markup, and new images are committed. Existing unrelated files and old images are preserved. Publishing rejects an outdated starting commit instead of overwriting other edits.

Requirements: Node.js 20+ and GitHub CLI signed in as `abanoubgeorge20`. If needed, run `gh auth login` to reconnect. The dashboard stays running in the background after closing the tab and can be reopened using the launcher. Restart Windows to stop it.

Limits: 100 projects, 8 tags per project, PNG/JPEG/WebP images up to 5 MB each, and 20 MB of new image data per publication. This dashboard is local; it cannot be opened from another computer without installing these files and signing into GitHub there.

No build dependencies are required. Run `node --test portfolio-admin/test.cjs` from the parent directory to verify validation, publication behavior, and local request protection.
