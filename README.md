# ArchivalLens V3

An AI-powered archival document processing tool for research teams. Upload scanned document pages, run automatic OCR and transcription via Google Gemini, cluster pages into logical documents, and extract structured metadata (senders, recipients, entities, dates).

## Features

- **Automatic clustering** — pairwise boundary detection assigns every page to a document; no unassigned pages
- **OCR & transcription** — per-page transcription, translation, and confidence scoring via Gemini
- **Metadata extraction** — senders, recipients, entities, document types, dates, subjects
- **Manual correction** — drag-to-reorder pages, split documents, merge, refresh AI summary after edits
- **Irrelevant page marking** — flag pages as irrelevant; excluded from metadata and the Research Index
- **Research Index** — entity reconciliation across all documents against a controlled vocabulary
- **Google Drive integration** — optional save/load via Drive
- **Project backup** — export/import as `.aln_project.zip`

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file in the project root:
   ```
   VITE_GEMINI_API_KEY=your_gemini_api_key
   VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id   # optional, only needed for Drive integration
   ```

3. Run the app:
   ```
   npm run dev
   ```

The app will be available at `http://localhost:3000`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GEMINI_API_KEY` | Yes | Google Gemini API key |
| `VITE_GOOGLE_CLIENT_ID` | No | Google OAuth client ID (only needed for Google Drive integration) |
