const paths={
  "personal-growth":'<path d="M12 21V11M12 14C5 14 3 9 3 4c6 0 9 3 9 8M12 10c0-5 4-7 9-7 0 5-3 8-9 8"/>',
  finance:'<circle cx="12" cy="12" r="9"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9M12 6v12"/>',
  productivity:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 9 2 2 5-5M8 15h8M8 18h5"/>',
  society:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3"/>',
  software:'<path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 3l-4 18"/>',
  mindfulness:'<path d="M12 20C6 17 7 9 12 3c5 6 6 14 0 17ZM12 20C5 20 2 16 2 10c5 0 9 4 10 10ZM12 20c7 0 10-4 10-10-5 0-9 4-10 10Z"/>',
  metaphysics:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/>'
};
const fallback='<path d="M3 3h8l10 10-8 8L3 11V3Z"/><circle cx="7" cy="7" r="1"/>';

export function interestIcon(id) {
  const shape=Object.hasOwn(paths,id)?paths[id]:fallback;
  return `<svg class="interest-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shape}</svg>`;
}
