// Run npm run test:browser with the built server running on port 3000.
// Uses locally installed Edge.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  const a = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const b = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const alice = await a.newPage(); const bob = await b.newPage();
  for (const [page, name] of [[alice, 'Амина'], [bob, 'Лукас']]) {
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Как тебя зовут?').fill(name);
    await page.getByRole('button', { name: 'Присоединиться' }).click();
    await page.getByRole('status').filter({ hasText: 'в сети' }).waitFor();
  }
  const text = `Привет из Warmly! ${Date.now()}`;
  await alice.getByRole('textbox', { name: 'Сообщение', exact: true }).fill(text);
  await alice.getByRole('button', { name: 'Отправить сообщение' }).click();
  await bob.getByText(text, { exact: true }).waitFor();
  await new Promise(resolve => setTimeout(resolve, 600));
  const html = '<img src=x onerror=alert(1)> Это текст';
  await bob.getByRole('textbox', { name: 'Сообщение', exact: true }).fill(html);
  await bob.getByRole('textbox', { name: 'Сообщение', exact: true }).press('Enter');
  await alice.getByText(html, { exact: true }).waitFor();
  assert.equal(await alice.locator('.bubble img').count(), 0);
  for (const page of [alice, bob]) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await a.setOffline(true);
  await alice.getByRole('status').filter({ hasText: 'потеряно' }).waitFor({ timeout: 45000 });
  await a.setOffline(false);
  await alice.getByRole('status').filter({ hasText: 'в сети' }).waitFor({ timeout: 20000 });
  await alice.getByText(text, { exact: true }).waitFor();
  const desktopPath = process.env.DESKTOP_SCREENSHOT || 'test-results/desktop.png';
  const mobilePath = process.env.MOBILE_SCREENSHOT || 'test-results/mobile.png';
  await mkdir(dirname(desktopPath), { recursive: true });
  await mkdir(dirname(mobilePath), { recursive: true });
  await alice.screenshot({ path: desktopPath, fullPage: true });
  await bob.screenshot({ path: mobilePath, fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: two browsers, mobile layout, literal HTML, disconnect and reconnect.');
} finally { await browser.close(); }
