// Function to get the current tab's domain
function getCurrentTabDomain(callback: (domain: string | null) => void) {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
    console.log("Tabs:", tabs);
    if (tabs.length > 0 && tabs[0].url) {
      const url = new URL(tabs[0].url);
      const domain = url.hostname;
      console.log("Active tab found - domain:", domain);
      callback(domain);
    } else {
      // Fallback to query all windows if no active tab found in current window
      chrome.tabs.query({ active: true }, function (allTabs) {
        console.log("All window tabs:", allTabs);
        if (allTabs.length > 0 && allTabs[0].url) {
          const url = new URL(allTabs[0].url);
          const domain = url.hostname;
          console.log("Active tab found in another window - domain:", domain);
          callback(domain);
        } else {
          console.warn("No active tab found in any window");
          callback(null);
        }
      });
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
        domain.includes("bitget.com") ||
        domain.includes("bitgetapps.com") ||
        domain.includes("bybit.com")
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

// Special function to get Bybit secure-token cookie directly using the chrome.cookies API
function fetchBybitSecureToken(domain: string) {
  console.log("Attempting to fetch Bybit secure-token for domain:", domain);

  chrome.cookies.get(
    { url: `https://${domain}`, name: "secure-token" },
    function (cookie) {
      if (chrome.runtime.lastError) {
        console.error(
          "Error fetching Bybit secure-token:",
          chrome.runtime.lastError
        );
        return;
      }

      if (cookie) {
        console.log("Bybit secure-token found:", cookie.value);
        chrome.storage.local.set({ bybit_jwt: cookie.value }, function () {
          console.log("Bybit JWT token saved to storage");
        });
      } else {
        console.warn("No Bybit secure-token cookie found");
      }
    }
  );
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
    } else if (
      domain.includes("bitget.com") ||
      domain.includes("bitgetapps.com")
    ) {
      const jwtCookie = cookies.find(
        (cookie) => cookie.name === "bt_newsessionid"
      );
      if (jwtCookie) {
        console.log("Bitget JWT Token Found in cookies");
        chrome.storage.local.set({ bitget_jwt: jwtCookie.value });
      }
    } else if (domain.includes("bybit.com")) {
      // For Bybit, use the direct method to get the secure-token
      fetchBybitSecureToken(domain);

      // Also check for any non-httpOnly cookies
      const jwtCookie = cookies.find(
        (cookie) => cookie.name === "secure-token"
      );
      if (jwtCookie) {
        console.log("Bybit JWT Token Found in cookies");
        chrome.storage.local.set({ bybit_jwt: jwtCookie.value });
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

      // Check for Bybit JWT token
      if (items.bybit_jwt) {
        jwtTokens["bybit"] = items.bybit_jwt;
      }

      sendResponse(jwtTokens);
    });
    return true;
  }

  if (message.type === "FETCH_COOKIES_NOW") {
    // Manual trigger to fetch cookies from current tab
    console.log("Manual cookie fetch triggered");
    fetchCookiesForCurrentTab();

    // For Bybit specifically, try all known domains
    const bybitDomains = [
      "www.bybit.com",
      "bybit.com",
      "api.bybit.com",
      "one.bybit.com",
    ];
    for (const domain of bybitDomains) {
      fetchBybitSecureToken(domain);
    }

    sendResponse({ success: true });
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
      details.url.includes("bitget.com") ||
      details.url.includes("bitgetapps.com") ||
      details.url.includes("bybit.com")
    ) {
      fetchCookiesForCurrentTab();
    }
  },
  {
    urls: [
      "https://www.binance.com/*",
      "https://www.suitechsui.online/*",
      "https://www.okx.com/*",
      "https://www.bitget.com/*",
      "https://www.bitgetapps.com/*",
      "https://www.bybit.com/*",
      "https://*.bybit.com/*",
      "https://bybit.com/*",
    ],
  },
  ["requestHeaders"]
);

// Listen for tab updates to detect navigation to Bybit
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the tab has completed loading and has a URL
  if (changeInfo.status === "complete" && tab.url) {
    console.log("Tab updated:", tab.url);

    // Check if this is a Bybit URL
    if (tab.url.includes("bybit.com")) {
      console.log("Bybit page detected:", tab.url);

      // Get the domain from the URL
      try {
        const url = new URL(tab.url);
        const domain = url.hostname;
        console.log("Bybit domain:", domain);

        // Explicitly fetch cookies for this domain
        fetchCookiesForDomain(domain);
      } catch (error) {
        console.error("Error parsing Bybit URL:", error);
      }
    }
  }
});
