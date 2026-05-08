// Dummy data for the Documents (Resource Library) page.
// Will swap to /api/v1/documents-driven content later.

export const CATEGORIES = [
  {
    id: 'policies',
    name: 'Company Policies',
    desc: 'Official rules, regulations, and operational standards for the workplace.',
    icon: 'policy',
    iconColor: 'text-primary',
    iconBg: 'bg-primary-fixed-dim/30',
    iconHoverBg: 'group-hover:bg-primary-fixed-dim/50',
    arrowHover: 'group-hover:text-primary',
    count: '124 Docs',
    countText: 'text-on-primary-fixed-variant',
    countBg: 'bg-primary-fixed',
  },
  {
    id: 'brand',
    name: 'Brand Guidelines',
    desc: 'Visual identity standards, logos, and communication voice kits.',
    icon: 'palette',
    iconColor: 'text-tertiary',
    iconBg: 'bg-tertiary-fixed/30',
    iconHoverBg: 'group-hover:bg-tertiary-fixed/50',
    arrowHover: 'group-hover:text-tertiary',
    count: '48 Files',
    countText: 'text-on-tertiary-container',
    countBg: 'bg-tertiary-fixed',
  },
  {
    id: 'hr',
    name: 'HR Forms',
    desc: 'Applications, reimbursement, and benefit enrollment documents.',
    icon: 'assignment',
    iconColor: 'text-secondary',
    iconBg: 'bg-secondary-fixed/30',
    iconHoverBg: 'group-hover:bg-secondary-fixed/50',
    arrowHover: 'group-hover:text-secondary',
    count: '82 Items',
    countText: 'text-on-secondary-container',
    countBg: 'bg-secondary-fixed',
  },
  {
    id: 'training',
    name: 'Training Manuals',
    desc: 'Educational resources and step-by-step guides for skill development.',
    icon: 'school',
    iconColor: 'text-primary',
    iconBg: 'bg-primary-container/30',
    iconHoverBg: 'group-hover:bg-primary-container/50',
    arrowHover: 'group-hover:text-primary',
    count: '215 Guides',
    countText: 'text-on-primary-container',
    countBg: 'bg-primary-fixed-dim',
  },
];

export const RECENTLY_VIEWED = [
  {
    name: 'Employee_Handbook_2024.pdf',
    icon: 'description',
    iconColor: 'text-primary',
    category: 'Company Policies',
    time: '2 hours ago',
    size: '4.2 MB',
  },
  {
    name: 'Brand_Assets_Q3_Final.zip',
    icon: 'image',
    iconColor: 'text-tertiary',
    category: 'Brand Guidelines',
    time: 'Yesterday',
    size: '128 MB',
  },
  {
    name: 'Expense_Report_Template.xlsx',
    icon: 'table_view',
    iconColor: 'text-secondary',
    category: 'HR Forms',
    time: 'Oct 12, 2024',
    size: '845 KB',
  },
  {
    name: 'Security_Training_Module_1.mp4',
    icon: 'video_library',
    iconColor: 'text-primary',
    category: 'Training Manuals',
    time: 'Oct 10, 2024',
    size: '24.5 MB',
  },
];

export const STORAGE = {
  used: 32.4,
  total: 50,
  unit: 'GB',
  percent: 72,
};

export const FEATURED_BANNER = {
  pill: 'Featured Event',
  title: '2024 Employee Experience Summit',
  description:
    'Access all keynote presentations, workshop recordings, and strategic roadmaps from our annual global gathering.',
  primaryCta: 'Access Collection',
  secondaryCta: 'Download Agenda',
  imageUrl:
    'https://lh3.googleusercontent.com/aida/ADBb0uj8fEOkL4VMxGs3DPmUzs86NmvEM7NgibbYgNOwgrEfWFxbaUtbIuwpuRdZmbnYg64iz8FapihiUkPvgsCeHmdIphNr8hUR-1aCkRT_c1EZKLfEysKGUbfK0LTETXl1YjdVQmxWTAlXEFe2MDi_ntceThe1ohTvrOcl6N9pqcsgXVhsucbtnJizfcy5U0IrUiQYnZUkZkpAiptZUdAl2W3OT2Q-Wi0mXUrhzOvvgxcWvNcOJralep_J-fulRnyW42Kza_hNXaUDrQ',
};
