import React, { useEffect, useMemo, useState } from 'react';
import Select from './Select';
import MultiSelect from './MultiSelect';
import { useOrgTree } from '../../hooks/useOrgTree';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';

const SCOPE_LABELS = {
  ORGANISATION: 'Organisation',
  OFFICE_LOCATION: 'Office Location',
  VERTICAL: 'Vertical',
  DEPARTMENT: 'Department',
};

function sortByLabel(items) {
  return [...items].sort((left, right) => left.label.localeCompare(right.label));
}

function haveSameValues(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function haveSameScopes(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const normalize = (scopes) => [...scopes].map((scope) => `${scope.scope_type}:${scope.scope_id}:${scope.scope_label}`).sort();
  const leftNormalized = normalize(left);
  const rightNormalized = normalize(right);
  return leftNormalized.every((value, index) => value === rightNormalized[index]);
}

function buildScope(type, node, label) {
  return {
    scope_type: type,
    scope_id: node.id,
    scope_label: `${SCOPE_LABELS[type]}: ${label}`,
  };
}

export default function HierarchyScopeSelector({
  value = [],
  onChange,
  disabled = false,
  className = '',
}) {
  const { tree, loading, error, refetch } = useOrgTree();
  const { currentOrganisationId } = useCurrentOrganisation();
  const [selectedOfficeIds, setSelectedOfficeIds] = useState([]);
  const [selectedVerticalIds, setSelectedVerticalIds] = useState([]);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState([]);
  const [hasHydratedFromValue, setHasHydratedFromValue] = useState(false);

  const orgNode = tree[0] || null;

  const officeOptions = useMemo(
    () => sortByLabel((orgNode?.children || []).map((office) => ({
      value: String(office.id),
      label: office.name,
      description: office.code || office.city || '',
    }))),
    [orgNode],
  );

  const selectedOffices = useMemo(
    () => (orgNode?.children || []).filter((office) => selectedOfficeIds.includes(String(office.id))),
    [orgNode, selectedOfficeIds],
  );

  const verticalOptions = useMemo(
    () => sortByLabel(
      selectedOffices.flatMap((office) =>
        (office.children || []).map((vertical) => ({
          value: String(vertical.id),
          label: vertical.name,
          description: office.name,
        })),
      ),
    ),
    [selectedOffices],
  );

  const selectedVerticals = useMemo(
    () => selectedOffices.flatMap((office) =>
      (office.children || []).filter((vertical) => selectedVerticalIds.includes(String(vertical.id))).map((vertical) => ({
        ...vertical,
        officeName: office.name,
      })),
    ),
    [selectedOffices, selectedVerticalIds],
  );

  const departmentOptions = useMemo(
    () => sortByLabel(
      selectedVerticals.flatMap((vertical) =>
        (vertical.children || []).map((department) => ({
          value: String(department.id),
          label: department.name,
          description: `${vertical.name} · ${vertical.officeName}`,
        })),
      ),
    ),
    [selectedVerticals],
  );

  useEffect(() => {
    const validVerticalIds = new Set(verticalOptions.map((option) => option.value));
    setSelectedVerticalIds((current) => {
      const next = current.filter((id) => validVerticalIds.has(id));
      return haveSameValues(current, next) ? current : next;
    });
  }, [verticalOptions]);

  useEffect(() => {
    const validDepartmentIds = new Set(departmentOptions.map((option) => option.value));
    setSelectedDepartmentIds((current) => {
      const next = current.filter((id) => validDepartmentIds.has(id));
      return haveSameValues(current, next) ? current : next;
    });
  }, [departmentOptions]);

  const resolvedScopes = useMemo(() => {
    if (!orgNode) return [];

    if (selectedDepartmentIds.length > 0) {
      return selectedVerticals.flatMap((vertical) =>
        (vertical.children || [])
          .filter((department) => selectedDepartmentIds.includes(String(department.id)))
          .map((department) => buildScope('DEPARTMENT', department, `${department.name} · ${vertical.name} · ${vertical.officeName}`)),
      );
    }

    if (selectedVerticalIds.length > 0) {
      return selectedVerticals.map((vertical) => buildScope('VERTICAL', vertical, `${vertical.name} · ${vertical.officeName}`));
    }

    if (selectedOfficeIds.length > 0) {
      return selectedOffices.map((office) => buildScope('OFFICE_LOCATION', office, office.name));
    }

    return [buildScope('ORGANISATION', orgNode, orgNode.name)];
  }, [orgNode, selectedDepartmentIds, selectedOfficeIds, selectedOffices, selectedVerticalIds, selectedVerticals]);

  useEffect(() => {
    if (!onChange || loading || !orgNode) return;
    if (haveSameScopes(value, resolvedScopes)) return;
    onChange(resolvedScopes);
  }, [loading, onChange, orgNode, resolvedScopes, value]);

  useEffect(() => {
    if (hasHydratedFromValue) return;
    if (!orgNode || !Array.isArray(value) || value.length === 0) return;

    const officeIds = new Set();
    const verticalIds = new Set();
    const departmentIds = new Set();

    value.forEach((scope) => {
      if (scope.scope_type === 'OFFICE_LOCATION') officeIds.add(String(scope.scope_id));

      (orgNode.children || []).forEach((office) => {
        (office.children || []).forEach((vertical) => {
          if (scope.scope_type === 'VERTICAL' && vertical.id === Number(scope.scope_id)) {
            officeIds.add(String(office.id));
            verticalIds.add(String(vertical.id));
          }

          if (scope.scope_type === 'DEPARTMENT') {
            (vertical.children || []).forEach((department) => {
              if (department.id === Number(scope.scope_id)) {
                officeIds.add(String(office.id));
                verticalIds.add(String(vertical.id));
                departmentIds.add(String(department.id));
              }
            });
          }
        });
      });
    });

    setSelectedOfficeIds([...officeIds].sort());
    setSelectedVerticalIds([...verticalIds].sort());
    setSelectedDepartmentIds([...departmentIds].sort());
    setHasHydratedFromValue(true);
  }, [hasHydratedFromValue, orgNode, value]);

  if (error) {
    return (
      <div className={className}>
        <p className="text-sm text-red-600">
          {error}{' '}
          <button type="button" onClick={refetch} className="underline text-primary-600 hover:text-primary-700">
            Retry
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <Select
        label="Organisation"
        name="scope_org"
        value={orgNode ? String(orgNode.id) : String(currentOrganisationId || '')}
        onChange={() => {}}
        options={orgNode ? [{ value: String(orgNode.id), label: orgNode.name }] : []}
        placeholder={loading ? 'Loading...' : 'Organisation'}
        disabled
      />

      <MultiSelect
        label="Office Locations"
        name="scope_offices"
        value={selectedOfficeIds}
        onChange={setSelectedOfficeIds}
        options={officeOptions}
        placeholder={loading ? 'Loading office locations...' : 'Select one or more office locations'}
        disabled={disabled || loading}
        helpText="Leave empty to assign at organisation level."
      />

      {selectedOfficeIds.length > 0 && (
        <MultiSelect
          label="Verticals"
          name="scope_verticals"
          value={selectedVerticalIds}
          onChange={setSelectedVerticalIds}
          options={verticalOptions}
          placeholder={loading ? 'Loading verticals...' : 'Optionally narrow down to one or more verticals'}
          disabled={disabled || loading}
          helpText="Leave empty to target all selected offices."
        />
      )}

      {selectedVerticalIds.length > 0 && (
        <MultiSelect
          label="Departments"
          name="scope_departments"
          value={selectedDepartmentIds}
          onChange={setSelectedDepartmentIds}
          options={departmentOptions}
          placeholder={loading ? 'Loading departments...' : 'Optionally narrow down to one or more departments'}
          disabled={disabled || loading}
          helpText="Leave empty to target all selected verticals."
        />
      )}

      {!loading && resolvedScopes.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resolved Scopes</span>
            <span className="text-xs font-medium text-gray-500">{resolvedScopes.length} selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {resolvedScopes.map((scope) => (
              <span
                key={`${scope.scope_type}-${scope.scope_id}`}
                className="inline-flex items-center rounded-md bg-white px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200"
              >
                {scope.scope_label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
