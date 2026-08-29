import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LocucaoTeleprompterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
};

export function LocucaoTeleprompterDialog({
  open,
  onOpenChange,
  text,
}: LocucaoTeleprompterDialogProps) {
  const { t } = useTranslation();
  const trimmed = text.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,calc(100vh-2rem))] w-[min(100vw-2rem,48rem)] max-w-3xl flex-col gap-4 overflow-hidden overflow-y-hidden">
        <DialogHeader>
          <DialogTitle>{t("project.detail.teleprompterTitle")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("project.detail.teleprompterTitle")}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {trimmed ? (
            <p className="whitespace-pre-wrap text-2xl leading-relaxed sm:text-3xl sm:leading-relaxed">
              {text}
            </p>
          ) : (
            <p className="text-muted-foreground">{t("project.detail.teleprompterEmpty")}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
