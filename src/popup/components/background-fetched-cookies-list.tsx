import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { ScrollArea } from "../../components/ui/scroll-area";

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

export function BackgroundFetchedCookiesOrJwtTokenList() {
  const [cookies, setCookies] = useState<StorageData>({});
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [jwtTokens, setJwtTokens] = useState<{ [key: string]: string }>({});

  useEffect(() => {
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

  const hasBinanceCookies = Object.keys(cookies).some((key) =>
    key.includes("binance")
  );
  const hasJwtTokens = Object.keys(jwtTokens).length > 0;

  if (!hasBinanceCookies && !hasJwtTokens) {
    return (
      <div className="text-sm text-muted-foreground mb-4">
        No authentication data found in background storage
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-4">
      {/* Binance Section */}
      {hasBinanceCookies && (
        <div>
          <h3 className="text-sm font-medium mb-2">Binance Authentication</h3>
          <ScrollArea className="h-[200px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Expiration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* CSRF Token Row */}
                {csrfToken && (
                  <TableRow>
                    <TableCell>
                      <Badge variant="secondary">CSRF Token</Badge>
                    </TableCell>
                    <TableCell className="font-mono">csrftoken</TableCell>
                    <TableCell>
                      <div className="font-mono text-xs max-w-48 truncate">
                        {csrfToken}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">-</span>
                    </TableCell>
                  </TableRow>
                )}
                {/* Cookie Rows */}
                {Object.entries(cookies)
                  .filter(([domain]) => domain.includes("binance"))
                  .map(([domain, cookieList]) =>
                    cookieList.map((cookie, index) => (
                      <TableRow key={`${domain}-${cookie.name}-${index}`}>
                        <TableCell>
                          <Badge variant="outline">Cookie</Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          {cookie.name}
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-xs max-w-48 truncate">
                            {cookie.value}
                          </div>
                        </TableCell>
                        <TableCell>
                          {cookie.expirationDate ? (
                            <span className="text-xs text-muted-foreground">
                              {new Date(
                                cookie.expirationDate * 1000
                              ).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Session
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}

      {/* JWT Tokens Section */}
      {hasJwtTokens && (
        <div>
          <h3 className="text-sm font-medium mb-2">JWT Tokens</h3>
          <ScrollArea className="h-[100px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Token</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(jwtTokens).map(([domain, token]) => (
                  <TableRow key={domain}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono capitalize">
                        {domain}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {domain === "okx" ? (
                        <span>Cookie: 'token'</span>
                      ) : domain === "bitget" ? (
                        <span>Cookie: 'bt_newsessionid'</span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs max-w-96 truncate">
                        {token}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
