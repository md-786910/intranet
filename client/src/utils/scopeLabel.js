// Resolves a `{ scope_type, scope_id }` pair to a human-readable breadcrumb
// (e.g. "Department: Product · V1 · Noida") given the org tree returned
// from `useOrgTree`. Returns null if the scope can't be resolved (e.g.
// tree still loading, or the entity was deleted).

export function findScopeLabel(tree, scopeType, scopeId) {
  const orgNode = tree?.[0];
  if (!orgNode || !scopeType || !scopeId) return null;

  if (scopeType === 'ORGANISATION' && orgNode.id === Number(scopeId)) {
    return `Organisation: ${orgNode.name}`;
  }

  for (const office of orgNode.children || []) {
    if (scopeType === 'OFFICE_LOCATION' && office.id === Number(scopeId)) {
      return `Office Location: ${office.name} · ${orgNode.name}`;
    }

    for (const vertical of office.children || []) {
      if (scopeType === 'VERTICAL' && vertical.id === Number(scopeId)) {
        return `Vertical: ${vertical.name} · ${office.name} · ${orgNode.name}`;
      }

      for (const department of vertical.children || []) {
        if (scopeType === 'DEPARTMENT' && department.id === Number(scopeId)) {
          return `Department: ${department.name} · ${vertical.name} · ${office.name}`;
        }
      }
    }
  }

  return null;
}

// Returns an ordered array of path segments (top → bottom) for breadcrumb rendering.
// e.g. [{ type:'Org', name:'BrightNow' }, { type:'Office', name:'Delhi' }, ...]
export function findScopePath(tree, scopeType, scopeId) {
  const orgNode = tree?.[0];
  if (!orgNode || !scopeType || !scopeId) return null;

  if (scopeType === 'ORGANISATION' && orgNode.id === Number(scopeId)) {
    return [{ type: 'Org', name: orgNode.name }];
  }

  for (const office of orgNode.children || []) {
    if (scopeType === 'OFFICE_LOCATION' && office.id === Number(scopeId)) {
      return [
        { type: 'Org',    name: orgNode.name },
        { type: 'Office', name: office.name  },
      ];
    }
    for (const vertical of office.children || []) {
      if (scopeType === 'VERTICAL' && vertical.id === Number(scopeId)) {
        return [
          { type: 'Org',      name: orgNode.name  },
          { type: 'Office',   name: office.name   },
          { type: 'Vertical', name: vertical.name },
        ];
      }
      for (const department of vertical.children || []) {
        if (scopeType === 'DEPARTMENT' && department.id === Number(scopeId)) {
          return [
            { type: 'Org',        name: orgNode.name     },
            { type: 'Office',     name: office.name      },
            { type: 'Vertical',   name: vertical.name    },
            { type: 'Department', name: department.name  },
          ];
        }
      }
    }
  }

  return null;
}
