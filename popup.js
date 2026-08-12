// save the docs link to local storage on button click
document.getElementById("save-docs-btn").addEventListener("click", () => {
  const docsUrl = document.getElementById("google-doc-url").value;
  if (docsUrl) {
    chrome.storage.local.set({ docsUrl }, () => {
      document.getElementById("docs-status").textContent = "Saved!";
    });
  } else {
    document.getElementById("docs-status").textContent =
      "Please enter a valid URL.";
  }
});

// load the docs link from local storage when the popup is opened
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get("docsUrl", (data) => {
    if (data.docsUrl) {
      document.getElementById("google-doc-url").value = data.docsUrl;
      document.getElementById("docs-status").textContent = "Docs loaded!";
    } else {
      document.getElementById("docs-status").textContent = "Not saved";
    }
  });
});

// save the PR link to local storage on button click
document.getElementById("save-pr-btn").addEventListener("click", () => {
  const prUrl = document.getElementById("pr-url").value;
  if (prUrl) {
    chrome.storage.local.set({ prUrl }, () => {
      document.getElementById("pr-status").textContent = "PR link saved!";
    });
  } else {
    document.getElementById("pr-status").textContent =
      "Please enter a valid PR URL.";
  }
});

// load the PR link from local storage when the popup is opened
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get("prUrl", (data) => {
    if (data.prUrl) {
      document.getElementById("pr-url").value = data.prUrl;
      document.getElementById("pr-status").textContent = "PR loaded!";
    } else {
      document.getElementById("pr-status").textContent = "No PR link saved";
    }
  });
});

// if there is a pr link and a docs link, show the suggestions panel
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["prUrl", "docsUrl"], (data) => {
    if (data.prUrl && data.docsUrl) {
      document.getElementById("suggestions-panel").classList.remove("hidden");
    }
  });
});

// when suggestions button is clicked, send a message to the background script to get suggestions
document.getElementById("get-suggestions-btn").addEventListener("click", () => {
  chrome.storage.local.get(["prUrl", "docsUrl"], (data) => {
    if (data.prUrl && data.docsUrl) {
      chrome.runtime.sendMessage({
        action: "getSuggestions",
        prUrl: data.prUrl,
        docsUrl: data.docsUrl,
      });
    }
  });
});

function markdownToHtml(markdown) {
  let html = markdown;

  // Escape HTML first
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks
  html = html.replace(
    /```(?:\w+)?\n([\s\S]*?)```/g,
    "<pre><code>$1</code></pre>",
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headings
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");

  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");

  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Unordered lists
  html = html.replace(/^[-*] (.*)$/gm, "<li>$1</li>");

  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

  // Numbered lists
  html = html.replace(/^\d+\. (.*)$/gm, "<li>$1</li>");

  // Paragraphs / line breaks
  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");

  return `<p>${html}</p>`;
}

// Load previously saved suggestions when the popup opens
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get("savedSuggestions", (data) => {
    if (data.savedSuggestions) {
      const suggestionsStatus = document.getElementById("suggestions-status");
      const copySuggestion = document.getElementById("copy-suggestion");

      suggestionsStatus.innerHTML = markdownToHtml(data.savedSuggestions);

      copySuggestion.classList.remove("hidden");
    }
  });
});

// Listen for new suggestions from the background script
chrome.runtime.onMessage.addListener((message) => {
  console.log("Received message in popup.js:", message);

  if (message.action === "displaySuggestions") {
    const suggestions = message.suggestions;

    const suggestionsStatus = document.getElementById("suggestions-status");
    const copySuggestion = document.getElementById("copy-suggestion");

    // Display the suggestions
    suggestionsStatus.innerHTML = markdownToHtml(suggestions);

    // Show copy button
    copySuggestion.classList.remove("hidden");

    // Save suggestions for the next time the popup opens
    chrome.storage.local.set({ savedSuggestions: suggestions }, () => {
      console.log("Suggestions saved to local storage");
    });
  }
});
