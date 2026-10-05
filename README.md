# Abanoub George — Personal Portfolio

An English portfolio for Abanoub George Youssef Youssef, covering AI, AI automation, web development, and Shopify development.

Live website: https://abanoubgeorge20.github.io/

## Project management

The repository includes the local dashboard source in `portfolio-admin/`. On Windows, download and extract the repository, install Node.js 20+ and GitHub CLI, sign in with `gh auth login`, then open `Open-Portfolio-Admin.cmd`. Create your local password on first launch. See `portfolio-admin/README.md` for setup and usage.

The dashboard also manages client reviews with optional screenshots from freelancing platforms, and lets the owner replace their profile photo. Save changes to a draft, then publish them together. Local password files are excluded from the repository. The administration server runs on your computer, not on GitHub Pages.

The owner's local Portfolio Studio dashboard adds, edits, deletes, and reorders projects, uploads images, and publishes changes through their GitHub CLI login. Credentials are never included in this repository. Open `Open-Portfolio-Admin.cmd` on the owner's computer to launch the dashboard.

`projects.json` contains the collection. Publishing also updates the generated gallery between the project markers in `index.html`, so projects remain visible without JavaScript. Keep both files in sync for manual changes.

## Preview

Open index.html in a browser. No installation or build step is required. Google Fonts uses an internet connection; system fonts provide a fallback.

## Features

- Responsive desktop and mobile layout.
- Nine n8n workflow projects, with original screenshots and category filters.
- Screenshot previews with Escape-to-close and keyboard focus restoration.
- Personal photograph and direct GitHub/LinkedIn links.
- All content and project image links remain accessible without JavaScript.

## Files

- index.html: biography, project descriptions, and social links.
- styles.css and personal.css: layout and styling.
- script.js: filters, image preview, and current year.
- assets/: supplied portrait and project screenshots.

Project descriptions summarize the visible workflow structure. They do not claim measured business results or verified production execution. The duplicate market-intelligence screenshot is represented once.

## GitHub Pages

Upload this folder's contents to the root of a dedicated GitHub repository. The index.html file must be at the publishing root. Configure GitHub Pages for that repository using the official instructions:
https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

Suggested repository name: abanoubgeorge20.github.io
The site is published at https://abanoubgeorge20.github.io/.

Upload only this portfolio folder, not the surrounding education-platform project.
