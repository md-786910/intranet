const { Op } = require('sequelize');

/**
 * Batch-load compact audience targets for a page of content rows.
 * Returns Map<entityId, Array<{ scope_type, scope_id }>>.
 * Empty array for an id means organisation-wide (no rules).
 */
async function loadAudienceSummaryMap(entityType, entityIds) {
  const ids = [...new Set((entityIds || []).map(Number).filter(Boolean))];
  const map = new Map(ids.map((id) => [id, []]));
  if (ids.length === 0) return map;

  const { ContentAudienceRule } = require('../database/models');
  const rules = await ContentAudienceRule.findAll({
    where: {
      entity_type: entityType,
      entity_id: { [Op.in]: ids },
    },
    attributes: ['entity_id', 'target_scope_type', 'target_scope_id'],
    raw: true,
  });

  rules.forEach((rule) => {
    const id = Number(rule.entity_id);
    const list = map.get(id) || [];
    list.push({
      scope_type: rule.target_scope_type,
      scope_id: Number(rule.target_scope_id),
    });
    map.set(id, list);
  });

  return map;
}

/**
 * Attach `audience_summary` onto each Sequelize row / plain object.
 * Mutates and returns the same array for convenience.
 */
async function attachAudienceSummaries(rows, entityType, idField) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const ids = rows.map((row) => {
    const plain = typeof row.toJSON === 'function' ? row.toJSON() : row;
    return plain[idField];
  });
  const map = await loadAudienceSummaryMap(entityType, ids);

  rows.forEach((row) => {
    const id = Number(typeof row.get === 'function' ? row.get(idField) : row[idField]);
    const summary = map.get(id) || [];
    if (typeof row.setDataValue === 'function') {
      row.setDataValue('audience_summary', summary);
    } else {
      row.audience_summary = summary;
    }
  });

  return rows;
}

/**
 * For analytics recent items shaped as { entity_type, id, ... }.
 */
async function attachAudienceSummariesToRecent(items) {
  if (!Array.isArray(items) || items.length === 0) return items;

  const byType = { NEWS: [], DOCUMENT: [], ANNOUNCEMENT: [] };
  items.forEach((item) => {
    if (byType[item.entity_type]) byType[item.entity_type].push(item.id);
  });

  const [newsMap, docMap, annMap] = await Promise.all([
    loadAudienceSummaryMap('NEWS', byType.NEWS),
    loadAudienceSummaryMap('DOCUMENT', byType.DOCUMENT),
    loadAudienceSummaryMap('ANNOUNCEMENT', byType.ANNOUNCEMENT),
  ]);

  const maps = { NEWS: newsMap, DOCUMENT: docMap, ANNOUNCEMENT: annMap };

  return items.map((item) => ({
    ...item,
    audience_summary: (maps[item.entity_type] && maps[item.entity_type].get(Number(item.id))) || [],
  }));
}

module.exports = {
  loadAudienceSummaryMap,
  attachAudienceSummaries,
  attachAudienceSummariesToRecent,
};
