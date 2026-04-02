import React, { useState, useEffect, useMemo } from 'react';
import Select from './Select';
import { orgService, transformOrgTree } from '../../services/orgService';

const SCOPE_TYPE_OPTIONS = [
  { value: 'ORGANISATION', label: 'Organisation' },
  { value: 'OFFICE_LOCATION', label: 'Office Location' },
  { value: 'VERTICAL', label: 'Vertical' },
  { value: 'DEPARTMENT', label: 'Department' },
];

function flattenByType(tree) {
  const result = {
    ORGANISATION: [],
    OFFICE_LOCATION: [],
    VERTICAL: [],
    DEPARTMENT: [],
  };

  function walk(nodes, breadcrumb = []) {
    nodes.forEach((node) => {
      const path = [...breadcrumb, node.name].join(' > ');
      if (result[node.type]) {
        result[node.type].push({ id: node.id, name: node.name, path });
      }
      if (node.children) walk(node.children, [...breadcrumb, node.name]);
    });
  }

  walk(tree);
  return result;
}

export default function ScopePicker({
  scopeType, scopeId, onScopeTypeChange, onScopeIdChange,
  className = '', disabled = false,
}) {
  const [tree, setTree] = useState([]);

  useEffect(() => {
    orgService.getOrgTree()
      .then((res) => setTree(transformOrgTree(res.data?.data)))
      .catch(() => {});
  }, []);

  const flatMap = useMemo(() => flattenByType(tree), [tree]);

  const scopeOptions = useMemo(() => {
    const items = flatMap[scopeType] || [];
    return items.map((item) => ({
      value: String(item.id),
      label: item.path,
    }));
  }, [flatMap, scopeType]);

  const handleScopeTypeChange = (e) => {
    const newType = e.target.value;
    onScopeTypeChange(newType);
    const items = flatMap[newType] || [];
    onScopeIdChange(items.length > 0 ? items[0].id : '');
  };

  const handleScopeIdChange = (e) => {
    onScopeIdChange(Number(e.target.value) || '');
  };

  return (
    <div className={`flex items-end gap-3 ${className}`}>
      <Select
        label="Scope"
        name="scope_type"
        value={scopeType}
        onChange={handleScopeTypeChange}
        options={SCOPE_TYPE_OPTIONS}
        disabled={disabled}
        className="w-44"
      />
      <Select
        label="Scope Target"
        name="scope_id"
        value={String(scopeId)}
        onChange={handleScopeIdChange}
        options={scopeOptions}
        placeholder={scopeOptions.length === 0 ? 'Loading...' : 'Select...'}
        disabled={disabled || scopeOptions.length === 0}
        className="flex-1 min-w-[180px]"
      />
    </div>
  );
}
