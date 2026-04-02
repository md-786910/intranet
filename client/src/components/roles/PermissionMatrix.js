import React, { useState, useMemo } from 'react';

// Human-readable labels and descriptions for each module:action
const PERMISSION_LABELS = {
  NEWS: {
    _name: 'News',
    VIEW: { label: 'View articles', desc: 'View news articles in the feed' },
    CREATE: { label: 'Create articles', desc: 'Create new draft articles' },
    EDIT: { label: 'Edit articles', desc: 'Edit existing articles' },
    DELETE: { label: 'Delete articles', desc: 'Permanently remove articles' },
    PUBLISH: { label: 'Publish articles', desc: 'Publish drafts to the live feed' },
  },
  DOCUMENTS: {
    _name: 'Documents',
    VIEW: { label: 'View documents', desc: 'Browse and read documents' },
    CREATE: { label: 'Upload documents', desc: 'Upload new documents' },
    EDIT: { label: 'Edit documents', desc: 'Edit metadata and upload new versions' },
    DELETE: { label: 'Delete documents', desc: 'Remove documents from the system' },
    PUBLISH: { label: 'Publish documents', desc: 'Make documents visible to targeted users' },
  },
  PUSH: {
    _name: 'Push Notifications',
    VIEW: { label: 'View campaigns', desc: 'View push notification campaigns' },
    CREATE: { label: 'Create campaigns', desc: 'Create new push campaigns' },
    SEND: { label: 'Send campaigns', desc: 'Send push notifications to users' },
    CANCEL: { label: 'Cancel campaigns', desc: 'Cancel scheduled campaigns' },
  },
  DIRECTORY: {
    _name: 'Directory',
    VIEW: { label: 'View directory', desc: 'Browse the employee directory' },
    EXPORT: { label: 'Export directory', desc: 'Export employee data' },
    MANAGE_PROFILE: { label: 'Manage profiles', desc: 'Edit employee profiles' },
  },
  SEARCH: {
    _name: 'Search',
    QUERY: { label: 'Search content', desc: 'Use global search across the platform' },
  },
  SAVED: {
    _name: 'Saved Items',
    VIEW: { label: 'View saved items', desc: 'View bookmarked content' },
    SAVE: { label: 'Save items', desc: 'Bookmark content for later' },
    REMOVE: { label: 'Remove saved', desc: 'Remove bookmarked items' },
  },
  ANALYTICS: {
    _name: 'Analytics',
    VIEW: { label: 'View analytics', desc: 'Access analytics dashboards' },
  },
  ADMIN: {
    _name: 'Administration',
    MANAGE_OFFICE_LOCATIONS: { label: 'Manage offices', desc: 'Create and edit office locations' },
    MANAGE_VERTICALS: { label: 'Manage verticals', desc: 'Create and edit business verticals' },
    MANAGE_DEPARTMENTS: { label: 'Manage departments', desc: 'Create and edit departments' },
    MANAGE_USERS: { label: 'Manage users', desc: 'Create, edit, and deactivate user accounts' },
    MANAGE_ROLES: { label: 'Manage roles', desc: 'Create and configure roles and permissions' },
    VIEW_ANALYTICS: { label: 'View platform analytics', desc: 'Access the analytics dashboard' },
    VIEW_AUDIT_LOG: { label: 'View audit log', desc: 'View system audit trail' },
  },
};

export { PERMISSION_LABELS };

export function getPermLabel(moduleCode, actionCode) {
  const mod = PERMISSION_LABELS[moduleCode];
  if (mod && mod[actionCode]) return mod[actionCode];
  // Fallback: humanize the action code
  const label = actionCode.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
  return { label, desc: '' };
}

function getModuleName(moduleCode, moduleName) {
  return PERMISSION_LABELS[moduleCode]?._name || moduleName;
}

function ModuleCard({ mod, selectedPermissions, onChange, disabled }) {
  const [expanded, setExpanded] = useState(true);

  const selectedCount = mod.actions.filter(a => selectedPermissions.has(a.module_action_id)).length;
  const allSelected = mod.actions.length > 0 && selectedCount === mod.actions.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const handleToggleAll = () => {
    if (disabled) return;
    const next = new Set(selectedPermissions);
    if (allSelected) {
      mod.actions.forEach(a => next.delete(a.module_action_id));
    } else {
      mod.actions.forEach(a => next.add(a.module_action_id));
    }
    onChange(next);
  };

  const handleToggle = (moduleActionId) => {
    if (disabled) return;
    const next = new Set(selectedPermissions);
    if (next.has(moduleActionId)) next.delete(moduleActionId);
    else next.add(moduleActionId);
    onChange(next);
  };

  const displayName = getModuleName(mod.code, mod.name);

  return (
    <div className={`border rounded-lg ${selectedCount > 0 ? 'border-primary-200 bg-primary-50/30' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-800"
        >
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {displayName}
          {selectedCount > 0 && (
            <span className="text-xs font-normal text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full">
              {selectedCount}/{mod.actions.length}
            </span>
          )}
        </button>
        {!disabled && (
          <button
            type="button"
            onClick={handleToggleAll}
            className="text-xs text-primary-600 hover:text-primary-800 font-medium"
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>

      {/* Actions list */}
      {expanded && (
        <div className="px-4 pb-3 space-y-1">
          {mod.actions.map((action) => {
            const { label, desc } = getPermLabel(mod.code, action.action_code);
            const checked = selectedPermissions.has(action.module_action_id);
            return (
              <label
                key={action.module_action_id}
                className={`flex items-start gap-3 py-2 px-3 rounded-md cursor-pointer transition-colors ${
                  disabled ? 'cursor-default' : 'hover:bg-white'
                } ${checked && !disabled ? 'bg-white' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleToggle(action.module_action_id)}
                  disabled={disabled}
                  className="mt-0.5 h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 disabled:opacity-60"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">{label}</div>
                  {desc && <div className="text-xs text-gray-500">{desc}</div>}
                </div>
                {disabled && checked && (
                  <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PermissionMatrix({ modules = [], selectedPermissions = new Set(), onChange, disabled = false }) {
  // Summary counts
  const summary = useMemo(() => {
    const moduleSet = new Set();
    let total = 0;
    modules.forEach((mod) => {
      const count = mod.actions.filter(a => selectedPermissions.has(a.module_action_id)).length;
      if (count > 0) {
        moduleSet.add(mod.code);
        total += count;
      }
    });
    return { total, moduleCount: moduleSet.size };
  }, [modules, selectedPermissions]);

  if (modules.length === 0) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {modules.map((mod) => (
        <ModuleCard
          key={mod.module_id}
          mod={mod}
          selectedPermissions={selectedPermissions}
          onChange={onChange}
          disabled={disabled}
        />
      ))}

      {/* Summary bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg text-sm">
        <span className="text-gray-600">
          {summary.total === 0 ? (
            'No permissions selected'
          ) : (
            <>
              <span className="font-semibold text-gray-900">{summary.total}</span>
              {' permission'}{summary.total !== 1 ? 's' : ''}{' selected across '}
              <span className="font-semibold text-gray-900">{summary.moduleCount}</span>
              {' module'}{summary.moduleCount !== 1 ? 's' : ''}
            </>
          )}
        </span>
      </div>
    </div>
  );
}
