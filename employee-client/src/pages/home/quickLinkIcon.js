// Auto-derive a Material Symbols icon for a Quick Link from its label.
// Admins only enter label + URL; this keeps the icon column out of the admin UI
// while still giving each shortcut a recognisable glyph.

const RULES = [
  [/director|people|employee|team|staff/i, 'badge'],
  [/calendar|schedule|event|meeting/i, 'calendar_month'],
  [/support|help|ticket|\bit\b/i, 'help_center'],
  [/payroll|benefit|salary|\bpay\b/i, 'request_quote'],
  [/policy|policies|handbook/i, 'policy'],
  [/news|announce/i, 'campaign'],
  [/doc|file|library/i, 'description'],
  [/chat|message|slack|teams/i, 'forum'],
  [/learn|train|course|onboard/i, 'school'],
  [/feedback|survey|form/i, 'feedback'],
  [/wiki|knowledge|faq/i, 'menu_book'],
  [/dashboard|report|analytic/i, 'insights'],
  [/security|access|vpn/i, 'lock'],
  [/email|mail|inbox/i, 'mail'],
];

export function iconForQuickLink(label = '') {
  const s = String(label);
  for (const [re, icon] of RULES) {
    if (re.test(s)) return icon;
  }
  return 'link';
}
