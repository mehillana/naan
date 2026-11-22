import type {ChatWorkspaceState} from '../types/chat';

function makeUniqueUserId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `u_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
  }
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createSeedWorkspace(): ChatWorkspaceState {
  const userId = makeUniqueUserId();
  const shortTag = userId.slice(2, 6);
  return {
    version: 3,
    currentUserId: userId,
    activeConversationId: '',
    theme: 'light',
    themePreset: 'aurora',
    language: 'ca',
    users: [
      {
        id: userId,
        name: 'El teu perfil',
        handle: `@tu_${shortTag}`,
        role: 'Naan Live',
        color: '#2563EB',
      },
    ],
    conversations: [],
    messages: [],
  };
}
