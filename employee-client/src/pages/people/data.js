// Dummy conversations + message threads for the People (messaging) page.
// Will be replaced by API data once messaging endpoints exist.

const SARAH_AVATAR =
  'https://lh3.googleusercontent.com/aida/ADBb0ujDg_fH21pPzcu5ravT_cnMw1YkFs4sr2uGc0TJtEfaFmYVc-6zDoiO7r3bkd0dGkqTecqpGg0yvyIFnNpGpGdOoBvvAoJhGw4mafv0XDp0x0eF4sH4lA5Z9ICbE9GSRCY9QdLDKIRv6XeIImpRV3Li9tdEYmICQ7wwBZG6EvIWu_vYOlXxjozA6croCmp_nQ_E85KibuSZAxcGprwpd6J7XHQMGFT-Yn17GJCFHKKqbgA5Fx7UA-b_4HhJYqB9RoH7_cjNLzP3qA';
const DAVID_AVATAR =
  'https://lh3.googleusercontent.com/aida/ADBb0uj8fEOkL4VMxGs3DPmUzs86NmvEM7NgibbYgNOwgrEfWFxbaUtbIuwpuRdZmbnYg64iz8FapihiUkPvgsCeHmdIphNr8hUR-1aCkRT_c1EZKLfEysKGUbfK0LTETXl1YjdVQmxWTAlXEFe2MDi_ntceThe1ohTvrOcl6N9pqcsgXVhsucbtnJizfcy5U0IrUiQYnZUkZkpAiptZUdAl2W3OT2Q-Wi0mXUrhzOvvgxcWvNcOJralep_J-fulRnyW42Kza_hNXaUDrQ';
const ELENA_AVATAR =
  'https://lh3.googleusercontent.com/aida/ADBb0uj52QXmpGEP4GUw_4_H3TVTbsxwNgu-kuNxXLN7W1LHGdOmNr0E2R7bVm0kC3qZjUdkH0B9M9BKPK3heMxRzj2g6Zm6jpM4JtHHIAZjuAisCuPlrGo1SsecvlUkotc8MXmvZxaAOgdaAht4pXhtn6yachCgFpMBMSt7ppNahDrp1Qt3UdLw8WTxBkQ0oJBycU0ya5c4z6o_qR9kyruaAMdpeZdH8Vc7EFdhmduTVd0tnYjV0YRijW4pUtH7iXgiSRKouOx-JBvGwQ';
const MARCUS_AVATAR =
  'https://lh3.googleusercontent.com/aida/ADBb0uj7bI6oh_3gMY5UoMWy3hRINJWKDChK6VzqgGlWCN8PqZtnemhzX0pK4oJVZ0OfHYFbfRy3i5ULukqGAaqpAVCRHaPwVP1nojKDLa-Vxmb90IkmU8AJ0muDxz8o9uJRQ2DRZcIImuL_aZIukOL9jb_jnTmJoUeUu7iH9aOw3Y-7Vs99xQ9HAXHfg8wZkRnQWvRELLIiT-65FhjeohDBu6jDwOglHDdfAs_EpHhNcbL36DmCl0eCVyGXpQR8cNY2Q8aU7_r1dK30';

export const CONVERSATIONS = [
  {
    id: 'sarah-jenkins',
    name: 'Sarah Jenkins',
    role: 'Operations Lead',
    avatarUrl: SARAH_AVATAR,
    online: true,
    lastMessageAt: '10:42 AM',
    preview: 'Can you review the Q4 project specs?',
    messages: [
      {
        id: 1,
        from: 'them',
        text: 'Hi there! Have you had a chance to look at the Q4 project specifications I sent over this morning?',
        at: '10:30 AM',
      },
      {
        id: 2,
        from: 'me',
        text: 'I just started going through it. The timeline for Phase 2 looks a bit tight. Should we discuss it?',
        at: '10:35 AM',
      },
      {
        id: 3,
        from: 'them',
        text: "Good catch. I agree, Phase 2 is aggressive. I've attached the resource allocation draft if that helps clarify the reasoning.",
        at: '10:41 AM',
      },
      {
        id: 4,
        from: 'them',
        attachment: {
          name: 'Q4_Resource_Allocation.pdf',
          size: '2.4 MB',
          kind: 'PDF',
        },
      },
      {
        id: 5,
        from: 'them',
        text: 'Can you review the Q4 project specs?',
        at: '10:42 AM',
      },
    ],
  },
  {
    id: 'david-chen',
    name: 'David Chen',
    role: 'Product Manager',
    avatarUrl: DAVID_AVATAR,
    online: false,
    lastMessageAt: 'Yesterday',
    preview: 'The meeting was moved to 2 PM.',
    messages: [
      {
        id: 1,
        from: 'them',
        text: "Hey, quick heads up — I had to push our sync. New time works for everyone else.",
        at: '4:11 PM',
      },
      {
        id: 2,
        from: 'me',
        text: 'No problem, see you then.',
        at: '4:14 PM',
      },
      {
        id: 3,
        from: 'them',
        text: 'The meeting was moved to 2 PM.',
        at: '4:15 PM',
      },
    ],
  },
  {
    id: 'elena-rodriguez',
    name: 'Elena Rodriguez',
    role: 'Director of Strategy',
    avatarUrl: ELENA_AVATAR,
    online: true,
    lastMessageAt: 'Oct 12',
    preview: 'Great job on the presentation!',
    messages: [
      {
        id: 1,
        from: 'them',
        text: 'Great job on the presentation!',
        at: '9:02 AM',
      },
      {
        id: 2,
        from: 'me',
        text: 'Thank you! Really appreciate the support.',
        at: '9:10 AM',
      },
    ],
  },
  {
    id: 'marcus-thorne',
    name: 'Marcus Thorne',
    role: 'Lead Project Manager',
    avatarUrl: MARCUS_AVATAR,
    online: false,
    lastMessageAt: 'Oct 11',
    preview: 'Sent you the policy documents.',
    messages: [
      {
        id: 1,
        from: 'them',
        text: 'Sent you the policy documents.',
        at: '3:48 PM',
      },
      {
        id: 2,
        from: 'them',
        attachment: {
          name: 'Updated_Remote_Policy_v3.pdf',
          size: '1.1 MB',
          kind: 'PDF',
        },
      },
    ],
  },
];
