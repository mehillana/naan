import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLanguageMeta,
  LANGUAGES,
  t,
  TRANSLATION_KEYS,
  TRANSLATIONS,
} from './translations';
import {NAAN_THEMES, THEME_LIST} from '../themes/themes';

test('all 7 languages are configured with complete non-empty translation strings', () => {
  assert.equal(LANGUAGES.length, 7);
  const expectedCodes = ['ca', 'es', 'en', 'pt', 'de', 'zh', 'ar'];
  for (const code of expectedCodes) {
    const dict = TRANSLATIONS[code as keyof typeof TRANSLATIONS];
    assert.ok(dict, `Missing language dictionary for ${code}`);
    for (const key of TRANSLATION_KEYS) {
      assert.ok(
        typeof dict[key] === 'string' && dict[key].trim().length > 0,
        `Missing translation for ${code}.${key}`,
      );
    }
  }
});

test('Arabic configures RTL direction while others configure LTR', () => {
  assert.equal(getLanguageMeta('ar').dir, 'rtl');
  assert.equal(getLanguageMeta('ca').dir, 'ltr');
  assert.equal(getLanguageMeta('zh').dir, 'ltr');
  assert.equal(t('en', 'landingEnterCta'), 'Open Naan');
});

test('all Naan glassmorphism themes have valid gradient and mode tokens', () => {
  assert.equal(THEME_LIST.length, 6);
  for (const theme of THEME_LIST) {
    assert.ok(NAAN_THEMES[theme.id]);
    assert.ok(theme.swatchGradient.includes('linear-gradient'));
    assert.ok(theme.ownBubbleGradient.includes('linear-gradient'));
    assert.ok(theme.mode === 'light' || theme.mode === 'dark');
  }
});
