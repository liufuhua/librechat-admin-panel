import { Check } from 'lucide-react';
import { useLocalize } from '@/hooks';

export interface GrantUserChoice {
  id: string;
  name: string;
  email: string;
}

export function GrantUserChoices({ users, selectedUser, onSelect }: {
  users: GrantUserChoice[];
  selectedUser: GrantUserChoice | null;
  onSelect: (user: GrantUserChoice) => void;
}) {
  const localize = useLocalize();
  return (
    <div className="flex flex-col gap-2">
      {selectedUser && (
        <p role="status" className="rounded-md bg-teal-50 px-3 py-2 text-sm font-medium text-teal-900 dark:bg-teal-950 dark:text-teal-100">
          {localize('com_data_query_grant_selected_user', { name: selectedUser.name, email: selectedUser.email })}
        </p>
      )}
      {users.map((user) => {
        const selected = selectedUser?.id === user.id;
        return (
          <button
            key={user.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(user)}
            className={`flex w-full items-center gap-3 rounded-lg border-2 p-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${selected
              ? 'border-teal-600 bg-teal-50 text-teal-950 dark:border-teal-400 dark:bg-teal-950 dark:text-teal-50'
              : 'border-(--cui-color-stroke-default) bg-(--cui-color-background-default) text-(--cui-color-text-default) hover:border-teal-500'}`}
          >
            <span aria-hidden="true" className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-400 dark:bg-teal-400 dark:text-teal-950' : 'border-gray-400'}`}>
              {selected && <Check size={16} strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block break-words font-semibold">{user.name}</span>
              <span className="block break-all text-xs opacity-80">{user.email}</span>
            </span>
            <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${selected ? 'bg-teal-700 text-white dark:bg-teal-400 dark:text-teal-950' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
              {localize(selected ? 'com_data_query_grant_user_selected' : 'com_data_query_grant_user_select')}
            </span>
          </button>
        );
      })}
    </div>
  );
}
