import test from 'node:test';
import assert from 'node:assert';
import {
  isEditableTarget,
  matchKeyboardShortcut,
  formatShortcutBadge,
  SHORTCUT_REGISTRY,
  ShortcutDefinition,
} from './keyboardShortcuts.ts';

test('isEditableTarget accurately identifies input and textarea elements', () => {
  assert.strictEqual(isEditableTarget({ tagName: 'INPUT' }), true);
  assert.strictEqual(isEditableTarget({ tagName: 'input' }), true);
  assert.strictEqual(isEditableTarget({ tagName: 'TEXTAREA' }), true);
  assert.strictEqual(isEditableTarget({ tagName: 'SELECT' }), true);
  assert.strictEqual(isEditableTarget({ isContentEditable: true }), true);

  assert.strictEqual(isEditableTarget({ tagName: 'DIV' }), false);
  assert.strictEqual(isEditableTarget({ tagName: 'BUTTON' }), false);
  assert.strictEqual(isEditableTarget({ tagName: 'BODY' }), false);
  assert.strictEqual(isEditableTarget(null), false);
});

test('matchKeyboardShortcut triggers Space play/pause only outside editable inputs', () => {
  const spaceEventBody = { key: ' ', target: { tagName: 'BODY' } };
  const matchedBody = matchKeyboardShortcut(spaceEventBody);
  assert.ok(matchedBody);
  assert.strictEqual(matchedBody.action, 'toggle-play');

  const spaceEventInput = { key: ' ', target: { tagName: 'INPUT' } };
  const matchedInput = matchKeyboardShortcut(spaceEventInput);
  assert.strictEqual(matchedInput, null, 'Space inside input should type space, not toggle playback');
});

test('matchKeyboardShortcut allows Ctrl+Enter to trigger play even while inside input', () => {
  const ctrlEnterInTextarea = {
    key: 'Enter',
    ctrlKey: true,
    target: { tagName: 'TEXTAREA' },
  };
  const matched = matchKeyboardShortcut(ctrlEnterInTextarea);
  assert.ok(matched);
  assert.strictEqual(matched.action, 'toggle-play');
  assert.strictEqual(matched.id, 'toggle-play-ctrl-enter');
});

test('matchKeyboardShortcut handles record shortcut R and Alt+R', () => {
  // Plain 'R' outside input triggers record
  const rEvent = { key: 'r', target: { tagName: 'BODY' } };
  const matchedR = matchKeyboardShortcut(rEvent);
  assert.ok(matchedR);
  assert.strictEqual(matchedR.action, 'toggle-record');

  // Plain 'R' inside textarea should NOT trigger record (user typing word like 'record')
  const rInTextarea = { key: 'r', target: { tagName: 'TEXTAREA' } };
  assert.strictEqual(matchKeyboardShortcut(rInTextarea), null);

  // Alt+R inside textarea DOES trigger record from anywhere
  const altRInTextarea = { key: 'r', altKey: true, target: { tagName: 'TEXTAREA' } };
  const matchedAltR = matchKeyboardShortcut(altRInTextarea);
  assert.ok(matchedAltR);
  assert.strictEqual(matchedAltR.action, 'toggle-record');
});

test('matchKeyboardShortcut handles Export shortcuts E and Ctrl+S', () => {
  const eEvent = { key: 'e', target: { tagName: 'BODY' } };
  const matchedE = matchKeyboardShortcut(eEvent);
  assert.ok(matchedE);
  assert.strictEqual(matchedE.action, 'export');

  const ctrlSEvent = { key: 's', ctrlKey: true, target: { tagName: 'TEXTAREA' } };
  const matchedCtrlS = matchKeyboardShortcut(ctrlSEvent);
  assert.ok(matchedCtrlS);
  assert.strictEqual(matchedCtrlS.action, 'export');
});

test('matchKeyboardShortcut switches tabs 1-6 outside inputs', () => {
  const tab1 = matchKeyboardShortcut({ key: '1', target: { tagName: 'DIV' } });
  assert.ok(tab1);
  assert.strictEqual(tab1.targetTab, 'tts');

  const tab4 = matchKeyboardShortcut({ key: '4', target: { tagName: 'DIV' } });
  assert.ok(tab4);
  assert.strictEqual(tab4.targetTab, 'recorder');

  const tab5 = matchKeyboardShortcut({ key: '5', target: { tagName: 'DIV' } });
  assert.ok(tab5);
  assert.strictEqual(tab5.targetTab, 'tools');

  // Inside input, typing number '1' should not switch tab
  const tab1Input = matchKeyboardShortcut({ key: '1', target: { tagName: 'INPUT' } });
  assert.strictEqual(tab1Input, null);
});

test('matchKeyboardShortcut handles question mark for cheat sheet and Esc for close', () => {
  const questionEvent = { key: '?', shiftKey: true, target: { tagName: 'BODY' } };
  const matchedQuestion = matchKeyboardShortcut(questionEvent);
  assert.ok(matchedQuestion);
  assert.strictEqual(matchedQuestion.action, 'open-shortcuts');

  const escEvent = { key: 'Escape', target: { tagName: 'INPUT' } };
  const matchedEsc = matchKeyboardShortcut(escEvent);
  assert.ok(matchedEsc);
  assert.strictEqual(matchedEsc.action, 'close-modal');
});

test('formatShortcutBadge correctly formats platform-specific modifier symbols', () => {
  const ctrlEnterSc: ShortcutDefinition = {
    id: 'test-ctrl-enter',
    action: 'toggle-play',
    key: 'Enter',
    modifiers: { ctrlOrCmd: true },
    descriptionEn: 'Play',
    descriptionKm: 'ចាក់',
    category: 'playback',
    badgeText: 'Ctrl + Enter',
  };

  assert.strictEqual(formatShortcutBadge(ctrlEnterSc, false), 'Ctrl + Enter');
  assert.strictEqual(formatShortcutBadge(ctrlEnterSc, true), '⌘ + Enter');
});
