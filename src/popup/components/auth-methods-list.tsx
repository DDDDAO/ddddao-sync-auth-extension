import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { DDCookie, EnumPlatform } from "../../types/auth";
import { cn, obfuscate } from "@/lib/utils";
import { CheckIcon, XIcon } from "lucide-react";
import { IconButton } from "@/components/ui/button";

interface AuthMethodsListProps {
  methods: DDCookie[];
  actionLoading: number | null;
  onUpdate: (id: number) => void;
  onDelete: (id: number, platform: EnumPlatform) => void;
}

const JsonDisplay = ({ data }: { data: Record<string, any> | string }) => {
  let jsonData: Record<string, any>;

  if (typeof data === "string") {
    try {
      jsonData = JSON.parse(data);
    } catch (e) {
      // If parsing fails, just display the raw string
      // show data with `xx...xx` if it's too long
      return (
        <div className="font-mono break-all text-sm">
          {data.slice(0, 10)}...{data.slice(-10)}
        </div>
      );
    }
  } else {
    jsonData = data;
  }

  return (
    <div className="font-mono max-w-32 text-sm">
      {Object.entries(jsonData).map(([key, value]) => (
        <div key={key} className="flex flex-col items-start py-1">
          <span className="mr-2 font-semibold text-blue-500 dark:text-blue-400">
            {key}:
          </span>
          <span className="break-all text-slate-700 dark:text-gray-300">
            {typeof value === "object"
              ? JSON.stringify(value)
              : value?.toString()}
          </span>
        </div>
      ))}
    </div>
  );
};

export function AuthMethodsList({
  methods,
  actionLoading,
  onUpdate,
  onDelete,
}: AuthMethodsListProps) {
  if (methods.length === 0) {
    return (
      <p className="text-muted-foreground">No authentication methods found.</p>
    );
  }

  const timeDiff = (date1: Date, date2: Date) => {
    const diff = Math.abs(date1.getTime() - date2.getTime());
    const diffDays = (diff / (1000 * 3600 * 24)).toFixed(1);
    const days = parseFloat(diffDays);
    return days === 0
      ? "today"
      : `${diffDays} ${days === 1 ? "day" : "days"} ago`;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>id</TableHead>
          <TableHead>platform</TableHead>
          <TableHead>status</TableHead>
          <TableHead>updatedAt</TableHead>

          <TableHead>Value</TableHead>
          <TableHead>Metadata</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {methods.map((dc) => (
          <TableRow key={dc.id}>
            <TableCell>{dc.id}</TableCell>
            <TableCell>{dc.platform}</TableCell>

            <TableCell>
              <Badge
                className={cn("text-white", {
                  "bg-green-500": dc.active,
                  "bg-red-500": !dc.active,
                })}
                variant={"outline"}
              >
                {dc.active ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <XIcon className="size-4" />
                )}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex flex-col space-y-1">
                <span>
                  {new Date(dc.updatedAt)
                    .toLocaleString("en-US", {
                      hour12: false,
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                    .replace(",", "")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {timeDiff(new Date(dc.updatedAt), new Date())}
                </span>
              </div>
            </TableCell>

            <TableCell>
              <div className="break-all">{obfuscate(dc.value)}</div>
            </TableCell>
            <TableCell>
              <JsonDisplay data={dc.metadata as Record<string, any>} />
            </TableCell>
            <TableCell>
              <IconButton onClick={() => onDelete(dc.id, dc.platform)}>
                <XIcon />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
