// Quick-add several interests from templates.

import { TemplatePickerModal } from './TemplatePickerModal.jsx';

export function QuickAddInterestModal({ personName, onClose, onSave }) {
  return (
    <TemplatePickerModal
      title="Quick add interest"
      subtitle={`Adding to ${personName}'s interests`}
      onClose={onClose}
      onPick={(text, emoji) => onSave({ emoji: emoji || '⭐', text })}
      allowMultiple
    />
  );
}
