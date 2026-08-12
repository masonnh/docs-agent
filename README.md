# docs-agent

Chrome extension that validates live GitHub, Google Docs, and ChatGPT connections and recommends documentation updates for pull requests.

## What is implemented

- Real GitHub connection check using `GET /user`
- Real repository access verification using `GET /repos/{owner}/{repo}`
- Real Google Docs connection check using `documents.get`
- Real ChatGPT/OpenAI connection check using `GET /v1/models`
- Repository monitoring toggle (`owner/repo`) with API validation
- PR analysis trigger from popup
- ChatGPT-powered documentation recommendation generation
- Result states:
  - `No documentation updates needed.`
  - `Documentation Update Recommended` with **Accept** / **Reject**

## Environment setup

Create `/home/runner/work/docs-agent/docs-agent/.env` with:

```env
GITHUB_TOKEN=...
GOOGLE_DOCS_API_KEY=...
GOOGLE_DOC_ID=...
OPENAI_API_KEY=...
```

Supported aliases:

- GitHub token: `GH_TOKEN`, `GITHUB_API_TOKEN`
- Google API key: `GOOGLE_API_KEY`
- Google doc id: `GOOGLE_DOCS_DOCUMENT_ID`

## Run locally

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `/home/runner/work/docs-agent/docs-agent`
5. Open the extension popup and run the workflow

## Notes

The extension reads `.env` from the extension root when loaded unpacked, so keep keys in that file locally and never commit it.