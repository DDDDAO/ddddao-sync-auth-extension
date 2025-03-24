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

  useEffect(() => {
    // Load linked statuses from storage
    chrome.storage.local.get(["linkedAuthMethods"], (result) => {
      if (result.linkedAuthMethods) {
        setLinkedStatuses(result.linkedAuthMethods);
      }
    });

    const fetchData = async () => {
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
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Update linked statuses when auth methods change
  useEffect(() => {
    const newLinkedStatuses: { [key in EnumPlatform]?: number } = {};
    authMethods.forEach((method) => {
      if (method.active) {
        newLinkedStatuses[method.platform] = method.id;
      }
    });
    setLinkedStatuses(newLinkedStatuses);
    chrome.storage.local.set({ linkedAuthMethods: newLinkedStatuses });
  }, [authMethods]);

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

  const openSyncDialog = (platform: EnumPlatform, token: string) => {
    setSelectedPlatform(platform);
    setSelectedToken(token);
    setDialogOpen(true);
  };

  const handleSync = async () => {
    if (!selectedPlatform || !selectedToken) return;

    if (selectedAuthMethod) {
      // Link to selected auth method
      const newLinkedStatuses = {
        ...linkedStatuses,
        [selectedPlatform]: selectedAuthMethod.id,
      };
      setLinkedStatuses(newLinkedStatuses);
      chrome.storage.local.set({ linkedAuthMethods: newLinkedStatuses });
      toast.success("Linked successfully");
    } else {
      // Create new auth method
      await sync(selectedPlatform, selectedToken);
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
    const str = toCopiedString(binanceCookies[0]?.value || "", csrfToken || "");
    const displayStr = toCopiedString(
      obfuscate(binanceCookies[0]?.value) || "",
      obfuscate(csrfToken) || ""
    );
    const linkedId = linkedStatuses[EnumPlatform.BINANCE];
    const linkedMethod = authMethods.find((m) => m.id === linkedId);
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
            onClick={() => openSyncDialog(EnumPlatform.BINANCE, str)}
            disabled={!linked || !hasToken}
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
    const linkedMethod = authMethods.find((m) => m.id === linkedId);

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
            disabled={!linked || !hasToken}
            onClick={() => openSyncDialog(EnumPlatform.OKX, okxToken)}
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
    const linkedMethod = authMethods.find((m) => m.id === linkedId);

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
            onClick={() => openSyncDialog(EnumPlatform.BITGET, bitgetToken)}
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
      <p className="text-sm text-gray-500">
        The cookies here are fetched from your current tab every 5 seconds.
      </p>
      <div className="grid grid-cols-2 gap-4">
        {binanceCard()}
        {okxCard()}
        {bitgetCard()}
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
                const method = authMethods.find(
                  (m) => m.id.toString() === value
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
                    <SelectItem key={method.id} value={method.id.toString()}>
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
              {selectedAuthMethod ? "Link" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
