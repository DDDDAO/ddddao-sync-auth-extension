import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface AlertProps {
  title: string;
  message: string;
  type: "confirm" | "info" | "error";
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export function Alert({
  title,
  message,
  type,
  onConfirm,
  onCancel,
  onClose,
}: AlertProps) {
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose?.()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {type === "confirm" ? (
            <>
              <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirm}>
                Continue
              </AlertDialogAction>
            </>
          ) : (
            <Button onClick={onClose}>Close</Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
