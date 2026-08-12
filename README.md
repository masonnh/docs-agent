# docs-agent

Chrome extension MVP that connects GitHub + Google Docs and recommends documentation updates for pull requests.

## What is implemented

- GitHub and Google Docs connection state in extension storage
- Repository monitoring toggle (`owner/repo`)
- PR analysis trigger from popup
- TOC-scoped documentation section selection before suggestion generation
- Result states:
  - `No documentation updates needed.`
  - `Documentation Update Recommended` with **Accept** / **Reject**

## Run locally

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `/home/runner/work/docs-agent/docs-agent`
5. Open the extension popup and run the workflow

## Notes

This is an MVP workflow implementation. Real GitHub and Google Docs API calls are represented by integration points in `background.js`.