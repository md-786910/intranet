import React, { useMemo, useEffect, useCallback } from 'react';
import Select from './Select';
import { useOrgTree } from '../../hooks/useOrgTree';

const DEFAULT_ORGANISATION_ID = 1;

/**
 * Cascading hierarchy dropdowns for scope selection.
 *
 * Organisation → Office Location → Vertical → Department
 *
 * Props:
 *   value      – { scope_type, scope_id, scope_label } or null
 *   onChange   – (value) => void
 *   selections – { orgId, officeId, verticalId, departmentId } internal state lifted to parent
 *   onSelectionsChange – updates lifted selections
 *   disabled   – disables all dropdowns
 *   className  – wrapper className
 */
export default function HierarchyScopeSelector({
  value,
  onChange,
  disabled = false,
  className = '',
}) {
  const { tree, loading, error, refetch } = useOrgTree();

  // ── Internal selection state ──
  const [selectedOrgId, setSelectedOrgId] = React.useState(DEFAULT_ORGANISATION_ID);
  const [selectedOfficeId, setSelectedOfficeId] = React.useState('');
  const [selectedVerticalId, setSelectedVerticalId] = React.useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = React.useState('');

  // ── Derive the org node ──
  const orgNode = useMemo(() => tree.find((n) => n.id === selectedOrgId), [tree, selectedOrgId]);

  // ── Dropdown options ──
  const orgOptions = useMemo(
    () => tree.map((n) => ({ value: String(n.id), label: n.name })),
    [tree],
  );

  const officeOptions = useMemo(
    () => (orgNode?.children || []).map((n) => ({ value: String(n.id), label: n.name })),
    [orgNode],
  );

  const selectedOffice = useMemo(
    () => orgNode?.children?.find((n) => n.id === Number(selectedOfficeId)),
    [orgNode, selectedOfficeId],
  );

  const verticalOptions = useMemo(
    () => (selectedOffice?.children || []).map((n) => ({ value: String(n.id), label: n.name })),
    [selectedOffice],
  );

  const selectedVertical = useMemo(
    () => selectedOffice?.children?.find((n) => n.id === Number(selectedVerticalId)),
    [selectedOffice, selectedVerticalId],
  );

  const departmentOptions = useMemo(
    () => (selectedVertical?.children || []).map((n) => ({ value: String(n.id), label: n.name })),
    [selectedVertical],
  );

  // ── Fire onChange whenever selection changes ──
  const fireChange = useCallback(
    (orgId, officeId, verticalId, departmentId) => {
      if (!onChange) return;
      let scope_type, scope_id, scope_label;

      if (departmentId) {
        scope_type = 'DEPARTMENT';
        scope_id = Number(departmentId);
      } else if (verticalId) {
        scope_type = 'VERTICAL';
        scope_id = Number(verticalId);
      } else if (officeId) {
        scope_type = 'OFFICE_LOCATION';
        scope_id = Number(officeId);
      } else {
        scope_type = 'ORGANISATION';
        scope_id = Number(orgId) || DEFAULT_ORGANISATION_ID;
      }

      // Resolve the human-readable label
      const org = tree.find((n) => n.id === Number(orgId));
      if (scope_type === 'ORGANISATION') {
        scope_label = org?.name || 'Organisation';
      } else if (scope_type === 'OFFICE_LOCATION') {
        const office = org?.children?.find((n) => n.id === Number(officeId));
        scope_label = office?.name || '';
      } else if (scope_type === 'VERTICAL') {
        const office = org?.children?.find((n) => n.id === Number(officeId));
        const vertical = office?.children?.find((n) => n.id === Number(verticalId));
        scope_label = vertical?.name || '';
      } else {
        const office = org?.children?.find((n) => n.id === Number(officeId));
        const vertical = office?.children?.find((n) => n.id === Number(verticalId));
        const dept = vertical?.children?.find((n) => n.id === Number(departmentId));
        scope_label = dept?.name || '';
      }

      onChange({ scope_type, scope_id, scope_label });
    },
    [onChange, tree],
  );

  // ── Auto-select org when tree loads ──
  useEffect(() => {
    if (tree.length > 0 && !value) {
      fireChange(selectedOrgId, '', '', '');
    }
  }, [tree]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──
  const handleOrgChange = (e) => {
    const id = e.target.value;
    setSelectedOrgId(Number(id));
    setSelectedOfficeId('');
    setSelectedVerticalId('');
    setSelectedDepartmentId('');
    fireChange(id, '', '', '');
  };

  const handleOfficeChange = (e) => {
    const id = e.target.value;
    setSelectedOfficeId(id);
    setSelectedVerticalId('');
    setSelectedDepartmentId('');
    fireChange(selectedOrgId, id, '', '');
  };

  const handleVerticalChange = (e) => {
    const id = e.target.value;
    setSelectedVerticalId(id);
    setSelectedDepartmentId('');
    fireChange(selectedOrgId, selectedOfficeId, id, '');
  };

  const handleDepartmentChange = (e) => {
    const id = e.target.value;
    setSelectedDepartmentId(id);
    fireChange(selectedOrgId, selectedOfficeId, selectedVerticalId, id);
  };

  if (error) {
    return (
      <div className={className}>
        <p className="text-sm text-red-600">
          {error}{' '}
          <button onClick={refetch} className="underline text-primary-600 hover:text-primary-700">
            Retry
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      <Select
        label="Organisation"
        name="scope_org"
        value={String(selectedOrgId)}
        onChange={handleOrgChange}
        options={orgOptions}
        placeholder={loading ? 'Loading...' : 'Select organisation...'}
        disabled={disabled || loading || orgOptions.length <= 1}
      />

      {officeOptions.length > 0 && (
        <Select
          label="Office Location"
          name="scope_office"
          value={selectedOfficeId}
          onChange={handleOfficeChange}
          options={officeOptions}
          placeholder="All offices (org level)"
          disabled={disabled || loading}
        />
      )}

      {selectedOfficeId && verticalOptions.length > 0 && (
        <Select
          label="Vertical"
          name="scope_vertical"
          value={selectedVerticalId}
          onChange={handleVerticalChange}
          options={verticalOptions}
          placeholder="All verticals (office level)"
          disabled={disabled || loading}
        />
      )}

      {selectedVerticalId && departmentOptions.length > 0 && (
        <Select
          label="Department"
          name="scope_department"
          value={selectedDepartmentId}
          onChange={handleDepartmentChange}
          options={departmentOptions}
          placeholder="All departments (vertical level)"
          disabled={disabled || loading}
        />
      )}
    </div>
  );
}
