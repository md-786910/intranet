// Audience visibility config — sets the narrowest scope level included when
// computing a user's audience scope keys for a given entity.
//
// Allowed values: 'ORGANISATION' | 'OFFICE_LOCATION' | 'VERTICAL' | 'DEPARTMENT'
//
// 'DEPARTMENT' (default) is the most permissive: all four levels of the user's
// ancestor chain are included, so the user sees content targeted at their
// department, vertical, office location, or the whole organisation.
//
// Raising the floor (e.g. to 'VERTICAL') prunes narrower levels from the
// user's effective scope keys, hiding content that was targeted only at those
// narrower levels — handy if leadership wants employees to stop seeing
// dept-private content broadly.
module.exports = {
  documents: { minLevel: "DEPARTMENT" },
  news: { minLevel: "DEPARTMENT" },
};
