import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EnumPlatform, DDCookie } from "@/types/auth";
import { AuthService } from "@/services/auth";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { col, row } from "@/components/ui/_ui-fixed";
import { cn, obfuscate } from "@/lib/utils";
import CopyButton from "./copy-button";

interface Cookie {
  domain: string;
  name: string;
  value: string;
  path: string;
  expirationDate?: number;
}

interface StorageData {
  [key: string]: Cookie[];
}

interface JwtToken {
  token: string;
  domain: string;
}

interface BackgroundFetchedCookiesOrJwtTokenListProps {
  authMethods: DDCookie[];
}

export function BackgroundFetchedCookiesOrJwtTokenList({
  authMethods,
}: BackgroundFetchedCookiesOrJwtTokenListProps) {
  const [loading, setLoading] = useState(false);
  const [cookies, setCookies] = useState<StorageData>({});
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [jwtTokens, setJwtTokens] = useState<{ [key: string]: string }>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<EnumPlatform | null>(
    null
  );
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [selectedAuthMethod, setSelectedAuthMethod] = useState<DDCookie | null>(
    null
  );
  const [linkedStatuses, setLinkedStatuses] = useState<{
    [key in EnumPlatform]?: number;
  }>({});
  const [profileId, setProfileId] = useState<string>("");
  const [fetching, setFetching] = useState(false);

  const fetchData = async () => {
    if (fetching) return;
    setFetching(true);
    // Get cookies and CSRF token
    const response = await chrome.runtime.sendMessage({
      type: "GET_COOKIES",
    });
    if (response) {
      setCookies(response);
    }

    // Get CSRF token
    const csrfResponse = await chrome.runtime.sendMessage({
      type: "GET_CSRF_TOKEN",
    });
    if (csrfResponse) {
      setCsrfToken(csrfResponse);
    }

    // Get JWT tokens
    const jwtResponse = await chrome.runtime.sendMessage({
      type: "GET_JWT_TOKENS",
    });
    if (jwtResponse) {
      setJwtTokens(jwtResponse);
    }
    setFetching(false);
  };

  // Function to manually trigger cookie fetch from current tab
  const triggerCookieFetch = async () => {
    // Get current tab info for debugging
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.url) {
      console.log("[triggerCookieFetch] Current tab URL:", tabs[0].url);
      const domain = new URL(tabs[0].url).hostname;
      console.log("[triggerCookieFetch] Current domain:", domain);
    }

    await chrome.runtime.sendMessage({
      type: "FETCH_COOKIES_NOW",
    });

    // Wait a moment then fetch the newly collected data
    setTimeout(fetchData, 1000);
    toast.success("Refreshing cookies from current tab");
  };

  const loadAll = async () => {
    const profile = await chrome.identity.getProfileUserInfo({});
    setProfileId(profile.id);
    console.log("[loadAll] Profile ID:", profile.id);

    // Load linked statuses for this profile
    chrome.storage.local.get(`${profile.id}:linkedAuthMethods`, (result) => {
      console.log("[loadAll] Linked statuses raw result:", result);
      const linkedAuthMethods = result[`${profile.id}:linkedAuthMethods`];

      if (linkedAuthMethods) {
        console.log("[loadAll] Found linkedAuthMethods:", linkedAuthMethods);

        // Convert string platform keys to numeric EnumPlatform values if needed
        const parsedLinkedStatuses = Object.entries(linkedAuthMethods).reduce(
          (acc, [platformKey, id]) => {
            // If the key is a string representing a number, convert it to a number
            const platform = isNaN(Number(platformKey))
              ? platformKey
              : Number(platformKey);
            // Use type assertion to handle the EnumPlatform key type properly
            acc[platform as unknown as EnumPlatform] = id as number;
            return acc;
          },
          {} as { [key in EnumPlatform]?: number }
        );

        console.log("[loadAll] Parsed linked statuses:", parsedLinkedStatuses);

        // Log available auth methods for debugging
        console.log(
          "[loadAll] Available auth methods:",
          authMethods.map((m) => ({ id: m.id, platform: m.platform }))
        );

        // Only filter out invalid entries if we actually have auth methods loaded
        let filteredLinkedStatuses = parsedLinkedStatuses;

        if (authMethods.length > 0) {
          // Filter to only include auth methods that actually exist
          filteredLinkedStatuses = Object.entries(parsedLinkedStatuses).reduce(
            (acc, [platform, id]) => {
              // Log each entry being checked
              console.log(
                `[loadAll] Checking if method exists - platform: ${platform}, id: ${id}`
              );

              const exists = authMethods.some((m) => {
                const matches =
                  m.id === id && m.platform.toString() === platform.toString();
                console.log(
                  `[loadAll] Auth method check - id: ${m.id}, platform: ${m.platform}, matches: ${matches}`
                );
                return matches;
              });

              if (exists) {
                acc[platform as unknown as EnumPlatform] = id;
              } else {
                console.log(
                  `[loadAll] Method not found: platform=${platform}, id=${id}`
                );
              }
              return acc;
            },
            {} as { [key in EnumPlatform]?: number }
          );
        } else {
          console.log(
            "[loadAll] No auth methods available for filtering, keeping all linked statuses"
          );
        }

        console.log(
          "[loadAll] Filtered linked statuses:",
          filteredLinkedStatuses
        );

        setLinkedStatuses(filteredLinkedStatuses);

        // Set back to chrome storage if needed (only if filtering removed items)
        if (
          Object.keys(filteredLinkedStatuses).length !==
          Object.keys(parsedLinkedStatuses).length
        ) {
          chrome.storage.local.set(
            {
              [`${profile.id}:linkedAuthMethods`]: filteredLinkedStatuses,
            },
            () => {
              console.log(
                "[loadAll] Updated filtered linked statuses in storage"
              );
            }
          );
        }
      } else {
        console.log("[loadAll] No linked auth methods found in storage");
      }
    });

    fetchData();
  };

  useEffect(() => {
    loadAll();
    const interval = setInterval(fetchData, 5000);

    // Periodically check and restore linked statuses to ensure persistence
    const persistenceInterval = setInterval(() => {
      if (profileId) {
        // Read from storage and update state if needed
        ensureLinkedStatusesPersistence();
      }
    }, 10000); // Check every 10 seconds

    // Debug: Check local storage for linked methods
    checkLocalStorage();

    return () => {
      clearInterval(interval);
      clearInterval(persistenceInterval);

      // Save linkedStatuses one last time before unmounting
      if (profileId && Object.keys(linkedStatuses).length > 0) {
        console.log(
          "[cleanup] Saving linked statuses before unmount:",
          linkedStatuses
        );
        chrome.storage.local.set({
          [`${profileId}:linkedAuthMethods`]: linkedStatuses,
        });
      }
    };
  }, []);

  // Make sure linkedStatuses are persisted by periodically checking storage
  const ensureLinkedStatusesPersistence = () => {
    console.log("[persistence] Ensuring linked statuses persistence");

    // Check current storage
    chrome.storage.local.get(`${profileId}:linkedAuthMethods`, (result) => {
      const storedLinkedStatuses = result[`${profileId}:linkedAuthMethods`];
      console.log(
        "[persistence] Current stored linked statuses:",
        storedLinkedStatuses
      );
      console.log(
        "[persistence] Current state linked statuses:",
        linkedStatuses
      );

      // If we have statuses in state but not in storage, restore them
      if (
        Object.keys(linkedStatuses).length > 0 &&
        (!storedLinkedStatuses ||
          Object.keys(storedLinkedStatuses).length === 0)
      ) {
        console.log(
          "[persistence] Restoring linked statuses to storage:",
          linkedStatuses
        );
        chrome.storage.local.set({
          [`${profileId}:linkedAuthMethods`]: linkedStatuses,
        });
      }

      // If we have statuses in storage but not in state, restore them to state
      if (
        (!linkedStatuses || Object.keys(linkedStatuses).length === 0) &&
        storedLinkedStatuses &&
        Object.keys(storedLinkedStatuses).length > 0
      ) {
        console.log(
          "[persistence] Restoring linked statuses to state from storage:",
          storedLinkedStatuses
        );
        setLinkedStatuses(storedLinkedStatuses);
      }
    });
  };

  // Debug function to check local storage for linked methods
  const checkLocalStorage = () => {
    chrome.storage.local.get(null, (result) => {
      console.log("[DEBUG] All chrome.storage.local data:", result);

      // Find all linkedAuthMethods entries
      const linkedEntries = Object.entries(result).filter(([key]) =>
        key.includes("linkedAuthMethods")
      );

      console.log("[DEBUG] All linkedAuthMethods entries:", linkedEntries);

      // Check for JWT tokens
      const jwtEntries = Object.entries(result).filter(([key]) =>
        key.includes("jwt")
      );
      console.log("[DEBUG] All JWT token entries:", jwtEntries);

      // Check for Gate-specific data
      const gateEntries = Object.entries(result).filter(([key]) =>
        key.toLowerCase().includes("gate")
      );
      console.log("[DEBUG] All Gate-related entries:", gateEntries);

      // Check for cookies from Gate domains
      const gateCookieEntries = Object.entries(result).filter(
        ([key]) => key.includes("cookies_") && key.includes("gate")
      );
      console.log("[DEBUG] Gate cookie entries:", gateCookieEntries);

      if (profileId) {
        const profileKey = `${profileId}:linkedAuthMethods`;
        console.log("[DEBUG] Looking specifically for:", profileKey);
        console.log("[DEBUG] Found:", result[profileKey]);
      }
    });
  };

  const sync = async (
    platform: EnumPlatform,
    token: string,
    linkedId?: number
  ) => {
    setLoading(true);
    if (loading) return;
    try {
      // Debug output for current linkedStatuses
      console.log("[sync] Current linkedStatuses:", linkedStatuses);
      console.log("[sync] Platform:", platform, "LinkedId:", linkedId);

      // Check if platform is linked
      if (!linkedId && !linkedStatuses[platform]) {
        toast.error("Please link an auth method first");
        return;
      }

      // Use the linkedId from linkedStatuses if not provided
      const idToUse = linkedId || linkedStatuses[platform];
      console.log("[sync] Using ID for sync:", idToUse);

      // Show immediate feedback for debounced operation
      toast.info("Sync request queued...");

      const success = await AuthService.debounceSync(platform, token, idToUse);

      // Add a small delay to simulate the debounce behavior for better UX
      await new Promise((resolve) => setTimeout(resolve, 1200));

      if (success) {
        toast.success("Sync completed successfully");
      } else {
        toast.error("Sync failed");
      }
    } catch (error) {
      console.error("sync", error);
      toast.error("Sync failed with uncaught error");
    } finally {
      setLoading(false);
    }
  };

  const openSyncDialog = (
    platform: EnumPlatform,
    token: string,
    linkedId?: number
  ) => {
    console.log("[openSyncDialog] Opening dialog", {
      platform,
      token,
      linkedId,
    });

    // First set the platform and token
    setSelectedPlatform(platform);
    setSelectedToken(token);

    // Find the appropriate auth method
    let authMethod: DDCookie | null = null;
    if (linkedId) {
      // If linkedId is provided, use that
      const foundMethod = authMethods.find(
        (m) => m.id === linkedId && m.platform === platform
      );
      if (foundMethod) {
        authMethod = foundMethod;
      }
      console.log(
        "[openSyncDialog] Found auth method by linkedId:",
        authMethod
      );
    } else {
      // Check if there's an existing linked status
      const existingId = linkedStatuses[platform];
      if (existingId) {
        const foundMethod = authMethods.find(
          (m) => m.id === existingId && m.platform === platform
        );
        if (foundMethod) {
          authMethod = foundMethod;
        }
        console.log(
          "[openSyncDialog] Found auth method by existing link:",
          authMethod
        );
      }
    }

    // TypeScript needs assurance that this is the correct type
    setSelectedAuthMethod(authMethod);
    console.log("[openSyncDialog] Selected auth method set to:", authMethod);

    // Open the dialog
    setDialogOpen(true);
  };

  const handleSync = async () => {
    if (!selectedPlatform || !selectedToken) return;

    setLoading(true);
    if (loading) return;
    try {
      // Store existing auth method link if selected
      if (selectedAuthMethod) {
        // Link to selected auth method
        const newLinkedStatuses = {
          ...linkedStatuses,
          [selectedPlatform]: selectedAuthMethod.id,
        };
        setLinkedStatuses(newLinkedStatuses);

        // Fix: Log what we're about to store
        console.log("[handleSync] Storing linked auth methods:", {
          key: `${profileId}:linkedAuthMethods`,
          value: newLinkedStatuses,
        });

        // Ensure we're using the correct key format
        chrome.storage.local.set(
          {
            [`${profileId}:linkedAuthMethods`]: newLinkedStatuses,
          },
          () => {
            // Add callback to verify storage operation
            console.log("[handleSync] Successfully stored linked auth methods");
            // Double-check what was stored
            chrome.storage.local.get(
              `${profileId}:linkedAuthMethods`,
              (result) => {
                console.log(
                  "[handleSync] Verification of stored data:",
                  result
                );
              }
            );

            // Also verify all storage
            chrome.storage.local.get(null, (result) => {
              console.log("[handleSync] All storage:", result);

              // Find all entries with linkedAuthMethods
              const linkedEntries = Object.entries(result).filter(([key]) =>
                key.includes("linkedAuthMethods")
              );
              console.log(
                "[handleSync] All linkedAuthMethods entries:",
                linkedEntries
              );
            });
          }
        );
      }

      // Create or update auth method
      const success = await AuthService.debounceSync(
        selectedPlatform,
        selectedToken,
        selectedAuthMethod?.id
      );

      if (success) {
        toast.success("Synced successfully");

        // If this was a creation (no selectedAuthMethod), we need to fetch the newly created method's ID
        if (!selectedAuthMethod) {
          try {
            console.log(
              "[handleSync] Creation successful, fetching auth methods to get ID"
            );
            const authMethodsResponse = await AuthService.getAuthMethods();
            if (authMethodsResponse && authMethodsResponse.data) {
              // Find the most recently created method for this platform
              const newMethods = authMethodsResponse.data.filter(
                (m) => m.platform === selectedPlatform
              );

              if (newMethods.length > 0) {
                // Sort by creation date, most recent first (if available)
                // or just use the last one in the array
                const latestMethod = newMethods[newMethods.length - 1];
                console.log(
                  "[handleSync] Found latest method for platform:",
                  latestMethod
                );

                // Update linked statuses with the new method
                const updatedLinkedStatuses = {
                  ...linkedStatuses,
                  [selectedPlatform]: latestMethod.id,
                };

                console.log(
                  "[handleSync] Updating linked statuses after creation:",
                  updatedLinkedStatuses
                );
                setLinkedStatuses(updatedLinkedStatuses);

                // Store in chrome storage - critical for persistence!
                chrome.storage.local.set(
                  {
                    [`${profileId}:linkedAuthMethods`]: updatedLinkedStatuses,
                  },
                  () => {
                    console.log(
                      "[handleSync] Successfully stored updated linked statuses after creation"
                    );
                    // Verify storage
                    chrome.storage.local.get(
                      `${profileId}:linkedAuthMethods`,
                      (result) => {
                        console.log(
                          "[handleSync] Verification after creation:",
                          result
                        );
                      }
                    );
                  }
                );
              }
            }
          } catch (error) {
            console.error(
              "[handleSync] Error updating linked status after creation:",
              error
            );
          }
        }
      } else {
        toast.error("Sync failed");
      }
    } catch (error) {
      console.error("sync error", error);
      toast.error("Operation failed with uncaught error");
    } finally {
      setLoading(false);
    }

    setDialogOpen(false);
    setSelectedPlatform(null);
    setSelectedToken("");
    setSelectedAuthMethod(null);
  };

  const toCopiedString = (cookie: string, csrfToken: string) => {
    if (!cookie || !csrfToken) {
      return "NO COOKIE OR CSRF TOKEN";
    }
    return `csrfToken=${csrfToken}&p20t=${cookie}`;
  };

  const binanceCard = () => {
    const binanceCookies =
      cookies["cookies_www.suitechsui.online"] ||
      cookies["cookies_www.binance.com"] ||
      [];
    const p20t = binanceCookies.find((c) => c.name === "p20t")?.value;
    const str = toCopiedString(p20t || "", csrfToken || "");
    const displayStr = toCopiedString(
      obfuscate(p20t || "") || "",
      obfuscate(csrfToken || "") || ""
    );
    const linkedId = linkedStatuses[EnumPlatform.BINANCE];
    const linkedMethod = authMethods.find(
      (m) => m.id === linkedId && m.platform === EnumPlatform.BINANCE
    );
    const linked = !!linkedId;
    const hasToken = !!str;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Binance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs break-all">{displayStr}</div>
          {str && <CopyButton contentToCopy={str} />}
          {linkedMethod && (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="text-green-400">Linked</span>
              <div className="grid grid-cols-2">
                {col("ID", linkedMethod.id)}
                {col("Nickname", linkedMethod.metadata["nickname"])}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!linked || !hasToken || loading}
            loading={loading}
            onClick={() => sync(EnumPlatform.BINANCE, str, linkedId)}
          >
            Sync
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasToken || loading}
            loading={loading}
            onClick={() => openSyncDialog(EnumPlatform.BINANCE, str, linkedId)}
          >
            {hasToken ? (linked ? "Relink" : "Create") : "Link"}
          </Button>
        </CardFooter>
      </Card>
    );
  };

  const okxCard = () => {
    const okxToken = jwtTokens["okx"] || "";
    const linkedId = linkedStatuses[EnumPlatform.OKX];
    const linkedMethod = authMethods.find(
      (m) => m.id === linkedId && m.platform === EnumPlatform.OKX
    );

    const linked = !!linkedId;
    const hasToken = !!okxToken;

    return (
      <Card>
        <CardHeader>
          <CardTitle>OKX</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="break-all">
            {obfuscate(okxToken) || "NO OKX TOKEN"}
          </div>
          {okxToken && <CopyButton contentToCopy={okxToken} />}
          {linkedMethod && (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="text-green-400">Linked</span>
              <div className="grid grid-cols-2 gap-2">
                {col("ID", linkedMethod.id)}
                {col("Nickname", linkedMethod.metadata["nickname"])}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!linked || !hasToken || loading}
            loading={loading}
            onClick={() => sync(EnumPlatform.OKX, okxToken, linkedId)}
          >
            Sync
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasToken || loading}
            loading={loading}
            onClick={() => openSyncDialog(EnumPlatform.OKX, okxToken, linkedId)}
          >
            {hasToken ? (linked ? "Relink" : "Create") : "Link"}
          </Button>
        </CardFooter>
      </Card>
    );
  };

  const bitgetCard = () => {
    const bitgetToken = jwtTokens["bitget"] || "";
    const linkedId = linkedStatuses[EnumPlatform.BITGET];
    const linkedMethod = authMethods.find(
      (m) => m.id === linkedId && m.platform === EnumPlatform.BITGET
    );

    const linked = !!linkedId;
    const hasToken = !!bitgetToken;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bitget</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="break-all">
            {obfuscate(bitgetToken) || "NO BITGET TOKEN"}
          </div>
          {bitgetToken && <CopyButton contentToCopy={bitgetToken} />}
          {linkedMethod && (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="text-green-400">Linked</span>
              <div className="grid grid-cols-2 gap-2">
                {col("ID", linkedMethod.id)}
                {col("Nickname", linkedMethod.metadata["nickname"])}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!linked || !hasToken || loading}
            loading={loading}
            onClick={() => sync(EnumPlatform.BITGET, bitgetToken, linkedId)}
          >
            Sync
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasToken || loading}
            loading={loading}
            onClick={() =>
              openSyncDialog(EnumPlatform.BITGET, bitgetToken, linkedId)
            }
          >
            {hasToken ? (linked ? "Relink" : "Create") : "Link"}
          </Button>
        </CardFooter>
      </Card>
    );
  };

  const bybitCard = () => {
    const bybitToken = jwtTokens["bybit"] || "";
    const linkedId = linkedStatuses[EnumPlatform.BYBIT];
    const linkedMethod = authMethods.find(
      (m) => m.id === linkedId && m.platform === EnumPlatform.BYBIT
    );
    const linked = !!linkedId;
    const hasToken = !!bybitToken;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bybit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="break-all">
            {obfuscate(bybitToken) || "NO BYBIT TOKEN"}
          </div>
          {bybitToken && <CopyButton contentToCopy={bybitToken} />}

          {linkedMethod && (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="text-green-400">Linked</span>
              <div className="grid grid-cols-2 gap-2">
                {col("ID", linkedMethod.id)}
                {col("Nickname", linkedMethod.metadata["nickname"])}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            loading={loading}
            onClick={() => sync(EnumPlatform.BYBIT, bybitToken, linkedId)}
            disabled={!linked || !hasToken || loading}
          >
            Sync
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasToken || loading}
            loading={loading}
            onClick={() =>
              openSyncDialog(EnumPlatform.BYBIT, bybitToken, linkedId)
            }
          >
            {hasToken ? (linked ? "Relink" : "Create") : "Link"}
          </Button>
        </CardFooter>
      </Card>
    );
  };

  const gateCard = () => {
    const gateToken = jwtTokens["gate"] || "";
    const linkedId = linkedStatuses[EnumPlatform.GATE];
    const linkedMethod = authMethods.find(
      (m) => m.id === linkedId && m.platform === EnumPlatform.GATE
    );
    const linked = !!linkedId;
    const hasToken = !!gateToken;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Gate.io</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="break-all">
            {obfuscate(gateToken) || "NO GATE TOKEN"}
          </div>
          {gateToken && <CopyButton contentToCopy={gateToken} />}
          {linkedMethod && (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="text-green-400">Linked</span>
              <div className="grid grid-cols-2 gap-2">
                {col("ID", linkedMethod.id)}
                {col("Nickname", linkedMethod.metadata["nickname"])}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!linked || !hasToken || loading}
            loading={loading}
            onClick={() => sync(EnumPlatform.GATE, gateToken, linkedId)}
          >
            Sync
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasToken || loading}
            loading={loading}
            onClick={() =>
              openSyncDialog(EnumPlatform.GATE, gateToken, linkedId)
            }
          >
            {hasToken ? (linked ? "Relink" : "Create") : "Link"}
          </Button>
        </CardFooter>
      </Card>
    );
  };

  const renderAuthMethodInfo = (
    method: DDCookie | null,
    singleLine = false
  ) => {
    if (!method) return null;
    if (singleLine) {
      return (
        <div className="flex">
          {`ID: ${method.id} - ${method.metadata["nickname"]}`}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1">
        {row("ID", method.id)}
        {row("Nickname", method.metadata["nickname"])}
        {row(
          "Status",
          <span
            className={cn({
              "text-green-400": method.active,
              "text-red-400": !method.active,
            })}
          >
            {method.active ? "Active" : "Inactive"}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          The cookies here are fetched from your current tab every 5 seconds.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={triggerCookieFetch}
            disabled={fetching}
          >
            {fetching ? "Refreshing..." : "Refresh Now"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              checkLocalStorage();
              loadAll();
            }}
          >
            Debug
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {binanceCard()}
        {okxCard()}
        {bitgetCard()}
        {bybitCard()}
        {gateCard()}
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedAuthMethod ? "Link to Existing Auth" : "Create New Auth"}
            </DialogTitle>
            <DialogDescription>
              {selectedAuthMethod
                ? "Link your cookies to an existing auth method."
                : "Create a new auth method with your cookies."}
            </DialogDescription>
          </DialogHeader>
          {selectedPlatform && (
            <Select
              value={selectedAuthMethod?.id?.toString()}
              onValueChange={(value) => {
                const [id, platform] = value.split("-");
                const method = authMethods.find(
                  (m) => m.id.toString() === id && m.platform === platform
                );
                setSelectedAuthMethod(method || null);
              }}
            >
              <SelectTrigger className="h-auto">
                <SelectValue placeholder="Select Auth ID">
                  {renderAuthMethodInfo(selectedAuthMethod, true)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {authMethods
                  .filter((method) => method.platform === selectedPlatform)
                  .map((method) => (
                    <SelectItem
                      key={method.id}
                      value={`${method.id}-${method.platform}`}
                    >
                      {renderAuthMethodInfo(method)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button disabled={loading} loading={loading} onClick={handleSync}>
              {selectedAuthMethod && selectedToken
                ? "Link & Sync"
                : selectedAuthMethod
                ? "Link"
                : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
