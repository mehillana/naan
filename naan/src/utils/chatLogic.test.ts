import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addContactToState,
  decodeSyncPacket,
  deleteConversationFromState,
  encodeSyncPacket,
  filterContacts,
  filterConversations,
  generateStandaloneArchiveHtml,
  mergeSyncPacket,
  normalizeHandle,
  parseInlineTokens,
  parseMarkdownBlocks,
  removeContactFromState,
  renameConversationInState,
  stripMarkdownForPreview,
  toggleChecklistItem,
  toggleMessageReaction,
  toggleStarContact,
  toggleStarMessage,
  updateCurrentUserProfile,
  upsertLiveMessageInState,
  voteInPoll,
  normalizeRoomCode,
  generateRoomCode,
  applyRemoteRoomState,
} from './chatLogic';
import {createSeedWorkspace} from '../data/seedData';
import type {ChatWorkspaceState, Message, SyncPacket} from '../types/chat';

const baseState: ChatWorkspaceState = {
  version: 1,
  currentUserId: 'u_marta',
  activeConversationId: 'c_general',
  theme: 'light',
  users: [
    {id: 'u_marta', name: 'Marta Puig', handle: '@marta', role: 'Disseny', color: '#2563eb'},
    {id: 'u_alex', name: 'Àlex Rovira', handle: '@alex', role: 'Enginyeria', color: '#0d9488'},
  ],
  conversations: [
    {
      id: 'c_general',
      type: 'channel',
      name: '#general',
      description: 'Canal principal',
      color: '#2563eb',
      participantIds: ['u_marta', 'u_alex'],
      pinned: true,
      unreadCount: 0,
      updatedAt: 1000,
    },
    {
      id: 'c_dm_alex',
      type: 'dm',
      name: 'Àlex Rovira',
      description: 'Missatge directe',
      color: '#0d9488',
      participantIds: ['u_marta', 'u_alex'],
      unreadCount: 2,
      updatedAt: 900,
    },
  ],
  messages: [
    {
      id: 'm1',
      conversationId: 'c_general',
      senderId: 'u_alex',
      content: 'Bon dia equip!',
      createdAt: 1000,
      reactions: {},
    },
  ],
};

test('parseMarkdownBlocks parses code blocks, quotes, and paragraphs cleanly', () => {
  const input = `> Nota important\n\nHola **món**!\n\`\`\`ts\nconst x = 1;\n\`\`\``;
  const blocks = parseMarkdownBlocks(input);
  assert.equal(blocks.length, 3);
  assert.deepEqual(blocks[0], {type: 'quote', lines: ['Nota important']});
  assert.equal(blocks[1].type, 'paragraph');
  assert.deepEqual(blocks[2], {type: 'codeblock', lang: 'ts', code: 'const x = 1;'});
});

test('parseInlineTokens parses formatting and blocks unsafe javascript links', () => {
  const tokens = parseInlineTokens('Visita https://github.com i **codi** `npm run build` javascript:alert(1)');
  const link = tokens.find((t) => t.type === 'link');
  assert.ok(link);
  assert.equal(link.href, 'https://github.com');
  assert.equal(tokens.some((t) => t.type === 'link' && t.href.startsWith('javascript:')), false);
  assert.ok(tokens.some((t) => t.type === 'bold' && t.value === 'codi'));
  assert.ok(tokens.some((t) => t.type === 'code' && t.value === 'npm run build'));
});

test('toggleMessageReaction toggles user emoji cleanly', () => {
  const msg = baseState.messages[0];
  const added = toggleMessageReaction(msg, '👍', 'u_marta');
  assert.deepEqual(added.reactions['👍'], ['u_marta']);

  const removed = toggleMessageReaction(added, '👍', 'u_marta');
  assert.equal(removed.reactions['👍'], undefined);
});

test('voteInPoll enforces single-choice exclusivity and multi-choice toggling', () => {
  const pollMessage: Message = {
    id: 'm_poll',
    conversationId: 'c_general',
    senderId: 'u_marta',
    content: 'Enquesta',
    createdAt: 2000,
    reactions: {},
    poll: {
      id: 'p1',
      question: 'Dia de reunió?',
      allowMultiple: false,
      options: [
        {id: 'o1', text: 'Dilluns', voterIds: []},
        {id: 'o2', text: 'Dimarts', voterIds: []},
      ],
    },
  };

  const v1 = voteInPoll(pollMessage, 'o1', 'u_marta');
  assert.deepEqual(v1.poll?.options[0].voterIds, ['u_marta']);

  const v2 = voteInPoll(v1, 'o2', 'u_marta');
  assert.deepEqual(v2.poll?.options[0].voterIds, []);
  assert.deepEqual(v2.poll?.options[1].voterIds, ['u_marta']);
});

test('mergeSyncPacket deduplicates messages and updates newer edits', () => {
  const packet: SyncPacket = {
    version: 1,
    exportedAt: 5000,
    users: baseState.users,
    conversations: baseState.conversations,
    messages: [
      {
        id: 'm1',
        conversationId: 'c_general',
        senderId: 'u_alex',
        content: 'Bon dia equip! (actualitzat)',
        createdAt: 1000,
        updatedAt: 3000,
        edited: true,
        reactions: {'🎉': ['u_marta']},
      },
      {
        id: 'm2',
        conversationId: 'c_dm_alex',
        senderId: 'u_alex',
        content: 'Tens un moment?',
        createdAt: 4000,
        reactions: {},
      },
    ],
  };

  const merged = mergeSyncPacket(baseState, packet, {incrementUnreadForOtherUsers: true});
  assert.equal(merged.messages.length, 2);
  assert.equal(merged.messages[0].content, 'Bon dia equip! (actualitzat)');
  assert.equal(merged.conversations.find((c) => c.id === 'c_dm_alex')?.unreadCount, 3);
});

test('encodeSyncPacket and decodeSyncPacket round-trip Catalan UTF-8 text cleanly', () => {
  const packet: SyncPacket = {
    version: 1,
    exportedAt: 12345,
    users: baseState.users,
    conversations: baseState.conversations,
    messages: baseState.messages,
  };
  const encoded = encodeSyncPacket(packet);
  const decoded = decodeSyncPacket(`#sync=${encoded}`);
  assert.equal(decoded.messages[0].content, 'Bon dia equip!');
  assert.equal(decoded.users[1].name, 'Àlex Rovira');
});

test('filterConversations supports tabs and message-level search', () => {
  const unread = filterConversations(baseState.conversations, baseState.messages, '', 'unread');
  assert.equal(unread.length, 1);
  assert.equal(unread[0].id, 'c_dm_alex');

  const byMsg = filterConversations(baseState.conversations, baseState.messages, 'equip', 'all');
  assert.equal(byMsg.length, 1);
  assert.equal(byMsg[0].id, 'c_general');
});

test('generateStandaloneArchiveHtml escapes HTML and renders transcript', () => {
  const html = generateStandaloneArchiveHtml(
    baseState.conversations[0],
    [
      ...baseState.messages,
      {
        id: 'm_xss',
        conversationId: 'c_general',
        senderId: 'u_marta',
        content: '<script>alert(1)</script>',
        createdAt: 1500,
        reactions: {},
      },
    ],
    baseState.users,
  );
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('<!doctype html>'));
});

test('normalizeHandle formats usernames cleanly', () => {
  assert.equal(normalizeHandle('  Nuria_Soler  '), '@nuria_soler');
  assert.equal(normalizeHandle('@@oriol.dev'), '@oriol.dev');
  assert.equal(normalizeHandle('   '), '');
});

test('addContactToState adds contact with unique ID and rejects duplicates', () => {
  const {state: updated, contact} = addContactToState(baseState, {
    name: 'Núria Pons',
    handle: 'nuria',
    customId: 'u_nuria_99',
    role: 'Producte',
  });
  assert.equal(contact.id, 'u_nuria_99');
  assert.equal(contact.handle, '@nuria');
  assert.equal(updated.users.length, 3);

  assert.throws(
    () =>
      addContactToState(updated, {
        name: 'Duplicat',
        handle: '@nuria',
      }),
    /Ja existeix/,
  );

  assert.throws(
    () =>
      addContactToState(updated, {
        name: 'Duplicat ID',
        handle: '@altre',
        customId: 'u_nuria_99',
      }),
    /Ja existeix/,
  );
});

test('filterContacts excludes current user and matches name, handle, and unique ID', () => {
  const byId = filterContacts(baseState.users, 'u_marta', 'u_alex');
  assert.equal(byId.length, 1);
  assert.equal(byId[0].name, 'Àlex Rovira');

  const emptySelf = filterContacts(baseState.users, 'u_marta', 'marta');
  assert.equal(emptySelf.length, 0);
});

test('removeContactFromState removes user and cleans up their DM conversation', () => {
  const cleaned = removeContactFromState(baseState, 'u_alex');
  assert.equal(cleaned.users.some((u) => u.id === 'u_alex'), false);
  assert.equal(cleaned.conversations.some((c) => c.id === 'c_dm_alex'), false);
  assert.throws(() => removeContactFromState(baseState, 'u_marta'), /No pots eliminar/);
});

test('stripMarkdownForPreview cleans inline syntax and code fences for 1-line previews', () => {
  assert.equal(
    stripMarkdownForPreview('Benvinguts a **Brisa** amb `IndexedDB` i\n```bash\nnpm run build\n```'),
    'Benvinguts a Brisa amb IndexedDB i [codi]',
  );
  assert.equal(stripMarkdownForPreview('> Nota important'), 'Nota important');
});

test('toggleChecklistItem flips done state immutably', () => {
  const chkMsg: Message = {
    id: 'm_chk',
    conversationId: 'c_general',
    senderId: 'u_marta',
    content: 'Checklist',
    createdAt: 1000,
    reactions: {},
    checklist: {
      id: 'c1',
      title: 'Tasques',
      items: [
        {id: 'i1', text: 'Pas 1', done: false},
        {id: 'i2', text: 'Pas 2', done: true},
      ],
    },
  };
  const next = toggleChecklistItem(chkMsg, 'i1');
  assert.equal(next.checklist?.items[0].done, true);
  assert.equal(chkMsg.checklist?.items[0].done, false);
});

test('toggleStarContact toggles favorite status on contact', () => {
  const s1 = toggleStarContact(baseState, 'u_alex');
  assert.equal(s1.users.find((u) => u.id === 'u_alex')?.starred, true);
  const s2 = toggleStarContact(s1, 'u_alex');
  assert.equal(s2.users.find((u) => u.id === 'u_alex')?.starred, false);
});

test('createSeedWorkspace starts clean with zero predefined contacts and zero groups', () => {
  const seed = createSeedWorkspace();
  assert.equal(seed.users.length, 1);
  assert.equal(seed.users[0].id, seed.currentUserId);
  assert.equal(seed.conversations.length, 0);
  assert.equal(seed.messages.length, 0);
  assert.equal(seed.activeConversationId, '');
});

test('updateCurrentUserProfile updates profile fields and rejects duplicate handles', () => {
  const updated = updateCurrentUserProfile(baseState, {
    name: 'Marta Nova',
    handle: 'marta.nova',
    role: 'Directora',
    color: '#7C3AED',
  });
  const me = updated.users.find((u) => u.id === 'u_marta');
  assert.equal(me?.name, 'Marta Nova');
  assert.equal(me?.handle, '@marta.nova');
  assert.equal(me?.role, 'Directora');
  assert.equal(me?.color, '#7C3AED');

  assert.throws(
    () =>
      updateCurrentUserProfile(baseState, {
        name: 'Marta',
        handle: '@alex',
        role: 'Disseny',
        color: '#2563eb',
      }),
    /Ja existeix/,
  );
});

test('toggleStarMessage toggles bookmark state immutably', () => {
  const m1 = toggleStarMessage(baseState.messages[0]);
  assert.equal(m1.starred, true);
  assert.equal(baseState.messages[0].starred, undefined);
  const m2 = toggleStarMessage(m1);
  assert.equal(m2.starred, false);
});

test('deleteConversationFromState and renameConversationInState update conversations cleanly', () => {
  const renamed = renameConversationInState(baseState, 'c_general', 'anuncis', 'Canal oficial');
  assert.equal(renamed.conversations.find((c) => c.id === 'c_general')?.name, '#anuncis');
  assert.equal(
    renamed.conversations.find((c) => c.id === 'c_general')?.description,
    'Canal oficial',
  );

  const deleted = deleteConversationFromState(renamed, 'c_general');
  assert.equal(deleted.conversations.length, 1);
  assert.equal(deleted.messages.length, 0);
  assert.equal(deleted.activeConversationId, 'c_dm_alex');
});

test('normalizeRoomCode and generateRoomCode produce clean alphanumeric room codes', () => {
  assert.equal(normalizeRoomCode('https://naan.app/?room=xat-77a '), 'XAT-77A');
  assert.equal(normalizeRoomCode('  abc 123! '), 'ABC123');
  const code = generateRoomCode();
  assert.equal(code.length, 6);
  assert.match(code, /^[A-Z0-9]{6}$/);
});

test('applyRemoteRoomState and upsertLiveMessageInState sync room idempotently', () => {
  const seed = createSeedWorkspace();
  const synced = applyRemoteRoomState(
    seed,
    {
      code: 'ROOM99',
      name: 'equip',
      description: 'LIVE · ROOM99',
      color: '#2563EB',
      createdAt: 1000,
      updatedAt: 2000,
      users: {
        u_remote: {
          id: 'u_remote',
          name: 'Marc',
          handle: '@marc',
          role: 'Live',
          color: '#7C3AED',
        },
      },
      messages: [
        {
          id: 'm_live_1',
          conversationId: 'live_ROOM99',
          senderId: 'u_remote',
          content: 'Hola en directe!',
          createdAt: 2000,
          reactions: {},
        },
      ],
    },
    true,
  );

  assert.equal(synced.activeConversationId, 'live_ROOM99');
  assert.equal(synced.conversations.length, 1);
  assert.equal(synced.conversations[0].isLiveRoom, true);
  assert.equal(synced.conversations[0].roomCode, 'ROOM99');
  assert.equal(synced.messages.length, 1);
  assert.equal(synced.users.some((u) => u.id === 'u_remote'), true);

  // Upsert same message again -> no duplicate
  const deduped = upsertLiveMessageInState(synced, 'ROOM99', {
    id: 'm_live_1',
    conversationId: 'live_ROOM99',
    senderId: 'u_remote',
    content: 'Hola en directe! (editat)',
    edited: true,
    createdAt: 2000,
    reactions: {},
  });
  assert.equal(deduped.messages.length, 1);
  assert.equal(deduped.messages[0].content, 'Hola en directe! (editat)');
});


