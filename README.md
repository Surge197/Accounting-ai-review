<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

The Windows Tally Connector foundation, backend setup, security boundaries, and TSplus test procedure are documented in [docs/tally-connector.md](docs/tally-connector.md). It is separate from the accounting UI and does not yet synchronize accounting data. Use Node.js 24 LTS and `npm ci` for the updated project.

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0647f2d3-0466-4e2a-9f07-70e843c5c7f6

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
