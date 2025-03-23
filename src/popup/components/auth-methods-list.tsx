import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Badge } from "../../components/ui/badge";
import { DDCookie } from "../../types/auth";

interface AuthMethodsListProps {
  methods: DDCookie[];
  actionLoading: number | null;
  onUpdate: (id: number) => void;
  onDelete: (id: number) => void;
}

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Authentication Methods</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {methods.map((method) => (
              <Card key={method.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">ID: {method.id}</Badge>
                        <Badge variant="secondary">
                          {method.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Created: {new Date(method.createdAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Updated: {new Date(method.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdate(method.id)}
                        disabled={actionLoading === method.id}
                      >
                        {actionLoading === method.id ? (
                          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          "Update"
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDelete(method.id)}
                        disabled={actionLoading === method.id}
                      >
                        {actionLoading === method.id ? (
                          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          "Delete"
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
