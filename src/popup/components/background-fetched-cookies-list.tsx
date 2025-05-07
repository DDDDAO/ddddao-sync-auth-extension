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
  const getStorageKey = (key: string) => `${profileId}:${key}`;

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
      console.log("[loadAll] Linked statuses:", result);
      if (result[`${profile.id}:linkedAuthMethods`]) {
        // clear linked statuses whose id+platform is not in authMethods
        const filteredLinkedStatuses = Object.fromEntries(
          Object.entries(result[`${profile.id}:linkedAuthMethods`]).filter(
            ([key]) => authMethods.some((m) => m.id === parseInt(key))
          )
        );
        console.log(
          "[loadAll] Filtered linked statuses:",
          filteredLinkedStatuses
        );
        setLinkedStatuses(filteredLinkedStatuses);
        // set back to chrome storage
        chrome.storage.local.set({
          [`${profile.id}:linkedAuthMethods`]: filteredLinkedStatuses,
        });
      }
    });
    fetchData();
  };

  useEffect(() => {
    loadAll();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const sync = async (
    platform: EnumPlatform,
    token: string,
    linkedId?: number
  ) => {
    try {
      if (!linkedStatuses[platform]) {
        toast.error("Please link an auth method first");
        return;
      }
      const success = await AuthService.sync(platform, token, linkedId);
      if (success) {
        toast.success("Synced successfully");
      } else {
        toast.error("Sync failed");
      }
    } catch (error) {
      console.error("sync", error);
      toast.error("Sync failed with uncaught error");
    }
  };

  const openSyncDialog = (
    platform: EnumPlatform,
    token: string,
    linkedId?: number
  ) => {
    setSelectedPlatform(platform);
    setSelectedToken(token);
    setSelectedAuthMethod(authMethods.find((m) => m.id === linkedId) || null);
    setDialogOpen(true);
  };

  const handleSync = async () => {
    if (!selectedPlatform || !selectedToken) return;

    try {
      if (selectedAuthMethod) {
        // Link to selected auth method
        const newLinkedStatuses = {
          ...linkedStatuses,
          [selectedPlatform]: selectedAuthMethod.id,
        };
        setLinkedStatuses(newLinkedStatuses);
        chrome.storage.local.set({
          [getStorageKey("linkedAuthMethods")]: newLinkedStatuses,
        });
      }
      // upsert new auth method
      const success = await AuthService.sync(
        selectedPlatform,
        selectedToken,
        selectedAuthMethod?.id
      );
      if (success) {
        toast.success("Synced successfully");
      } else {
        toast.error("Sync failed");
      }
    } catch (error) {
      console.error("sync error", error);
      toast.error("Operation failed with uncaught error");
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
          {linkedMethod && (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="text-green-400">Linked</span>
              <div className="grid grid-cols-2">
                {col("ID", linkedMethod.id)}
                {col("Nickname", linkedMethod.metadata["nickname"])}
              </div>
            </div>
          )}
          {str && <CopyButton contentToCopy={str} />}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => sync(EnumPlatform.BINANCE, str, linkedId)}
            disabled={!linked || !hasToken}
          >
            Sync
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openSyncDialog(EnumPlatform.BINANCE, str, linkedId)}
            disabled={!hasToken}
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
          {linkedMethod && (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="text-green-400">Linked</span>
              <div className="grid grid-cols-2 gap-2">
                {col("ID", linkedMethod.id)}
                {col("Nickname", linkedMethod.metadata["nickname"])}
              </div>
            </div>
          )}
          {okxToken && <CopyButton contentToCopy={okxToken} />}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => sync(EnumPlatform.OKX, okxToken, linkedId)}
            disabled={!linked || !hasToken}
          >
            Sync
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasToken}
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
          {linkedMethod && (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="text-green-400">Linked</span>
              <div className="grid grid-cols-2 gap-2">
                {col("ID", linkedMethod.id)}
                {col("Nickname", linkedMethod.metadata["nickname"])}
              </div>
            </div>
          )}
          {bitgetToken && <CopyButton contentToCopy={bitgetToken} />}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => sync(EnumPlatform.BITGET, bitgetToken, linkedId)}
            disabled={!linked || !hasToken}
          >
            Sync
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasToken}
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
          {linkedMethod && (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="text-green-400">Linked</span>
              <div className="grid grid-cols-2 gap-2">
                {col("ID", linkedMethod.id)}
                {col("Nickname", linkedMethod.metadata["nickname"])}
              </div>
            </div>
          )}
          {bybitToken && <CopyButton contentToCopy={bybitToken} />}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => sync(EnumPlatform.BYBIT, bybitToken, linkedId)}
            disabled={!linked || !hasToken}
          >
            Sync
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasToken}
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
        <Button
          size="sm"
          variant="outline"
          onClick={triggerCookieFetch}
          disabled={fetching}
        >
          {fetching ? "Refreshing..." : "Refresh Now"}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {binanceCard()}
        {okxCard()}
        {bitgetCard()}
        {bybitCard()}
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
            <Button onClick={handleSync}>
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
