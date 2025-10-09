# Donation Receipt Generator

A modern, offline-first Progressive Web App (PWA) for generating and managing donation receipts. This application is built with React, TypeScript, and Vite, and it uses a client-side SQLite database (`sql.js`) to store all data securely in the user's browser.

## Features

- **Offline First:** Fully functional without an internet connection thanks to a service worker and client-side database.
- **PWA Ready:** Installable on desktop and mobile devices for a native-app-like experience.
- **Persistent Data:** All donor and receipt information is saved locally in a SQLite database in the browser's IndexedDB.
- **Live Preview:** See a real-time preview of the PDF receipt as you type.
- **Donor Autocomplete:** When running in PWA mode, the donor name field provides suggestions from past donors.
- **Receipt History & Filtering:** View, search, and filter all past receipts.
- **PDF Generation:** Download professional-looking receipts as PDF files.
- **Multilingual Support:** Includes support for English and Hebrew.

## Local Development

**Prerequisites:**
- Node.js
- pnpm (If you don't have it, run `npm install -g pnpm`)

1. **Install dependencies:**
   ```bash
   pnpm install
   ```
2. **Run the development server:**
   ```bash
   pnpm run dev
   ```
   The application will be available at `http://localhost:5173`.

## Deploying to GitHub Pages

This project is pre-configured for easy deployment to GitHub Pages.

### Step 1: Configuration (Crucial!)

Before you deploy, you **must** configure the project to point to your repository's public URL.

1.  **`vite.config.ts`**:
    Open this file and change the `base` property to match the name of your GitHub repository.
    ```typescript
    // Example: if your repository is https://github.com/john-doe/my-receipt-app
    base: '/my-receipt-app/',
    ```

2.  **`package.json`**:
    Open this file and change the `homepage` property to the full URL where your site will be live.
    ```json
    // Example:
    "homepage": "https://john-doe.github.io/my-receipt-app/",
    ```

### Step 2: Deploy

After configuring the files, commit and push your changes. Then, run the deploy script:

```bash
pnpm run deploy
```

This command will build the application and push the final static files to a `gh-pages` branch on your repository.

### Step 3: Configure GitHub Repository

The final step is to tell GitHub to serve your site from the new `gh-pages` branch.

1.  In your GitHub repository, go to **Settings > Pages**.
2.  Under "Build and deployment", change the **Source** to **Deploy from a branch**.
3.  Set the **Branch** to **`gh-pages`** and the folder to **`/ (root)`**.
4.  Click **Save**.

Your application will be live at the URL you specified in a few minutes.
