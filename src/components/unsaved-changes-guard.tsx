import { useCallback, useRef } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type UnsavedChangesGuardProps = {
  isDirty: boolean;
};

export function UnsavedChangesGuard({ isDirty }: UnsavedChangesGuardProps) {
  const { t } = useTranslation();
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const shouldBlockFn = useCallback(() => isDirtyRef.current, []);

  const blocker = useBlocker({
    shouldBlockFn,
    enableBeforeUnload: isDirty,
    withResolver: true,
    disabled: !isDirty,
  });

  const isBlocked = blocker.status === "blocked";

  return (
    <AlertDialog
      open={isBlocked}
      onOpenChange={(open) => {
        if (!open) blocker.reset?.();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("common.unsavedChangesTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("common.unsavedChangesDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset?.()}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              blocker.proceed?.();
            }}
          >
            {t("common.leaveWithoutSaving")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
