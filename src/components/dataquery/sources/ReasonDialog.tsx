import { FormDialog } from '@/components/shared';
import { useLocalize } from '@/hooks';

interface ReasonDialogProps {
  open: boolean;
  title: string;
  description?: string;
  reason: string;
  saving: boolean;
  error?: string | null;
  submitLabel?: string;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function ReasonDialog({
  open,
  title,
  description,
  reason,
  saving,
  error,
  submitLabel,
  onReasonChange,
  onSubmit,
  onClose,
}: ReasonDialogProps) {
  const localize = useLocalize();
  return (
    <FormDialog
      open={open}
      title={title}
      submitLabel={submitLabel ?? localize('com_ui_confirm')}
      submitDisabled={!reason.trim()}
      saving={saving}
      error={error ?? undefined}
      onSubmit={onSubmit}
      onClose={onClose}
    >
      {description && <p className="text-sm text-(--cui-color-text-muted)">{description}</p>}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {localize('com_data_query_reason')}
        <textarea
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          className="min-h-24 rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) p-3 text-sm font-normal"
        />
      </label>
    </FormDialog>
  );
}
