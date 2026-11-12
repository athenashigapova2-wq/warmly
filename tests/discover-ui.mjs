// Run after: npx ng build --configuration=qa --output-path=dist/qa
// Uses local fixture data only; no production accounts or writes.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import express from 'express';
import {chromium} from 'playwright';
const app=express();app.use(express.static('dist/qa/browser'));
const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const url=`http://127.0.0.1:${server.address().port}/`;
 await page.goto(url);await page.getByRole('button',{name:/Discover/}).click();
 const discover=page.locator('warmly-discover');
 await discover.getByRole('button',{name:'♧ Lund University',exact:true}).click();
 await discover.getByText('Noah',{exact:true}).waitFor();
 assert.equal(await discover.getByText('Emma',{exact:true}).count(),0);
 assert.equal(await discover.getByText('Amina',{exact:true}).count(),0);
 await discover.locator('.person-row').filter({hasText:'Noah'}).getByRole('button',{name:'Add friend'}).click();
 await discover.locator('.person-row').filter({hasText:'Noah'}).getByText('Request sent').waitFor();
 await discover.getByRole('button',{name:'♧ Uppsala University',exact:true}).click();
 await discover.getByText('Emma',{exact:true}).waitFor();
 assert.equal(await discover.getByText('Lucas',{exact:true}).count(),0);
 await discover.getByRole('button',{name:'Accept request'}).click();
 await discover.getByRole('button',{name:'Message',exact:true}).waitFor();
 await page.getByLabel('Search by username',{exact:true}).fill('nobody');await discover.getByRole('button',{name:'Search',exact:true}).click();
 await discover.getByText('No people found. Try another university or username.').waitFor();
 await discover.getByRole('button',{name:'♧ Lund University',exact:true}).click();await discover.getByText('Noah',{exact:true}).waitFor();
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/discover-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile layout overflows horizontally');
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/discover-desktop.png',fullPage:true});
 await page.goto(url+'?missingUniversity=1');await page.getByLabel('Your university',{exact:true}).waitFor();
 await page.getByLabel('Your university',{exact:true}).fill('  Stockholm   University  ');await page.getByRole('button',{name:'Start connecting →'}).click();
 await page.getByRole('button',{name:/Discover/}).click();await discover.getByRole('button',{name:'♧ Stockholm University',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: university filter, friend request/accept, empty search, mobile layout, missing-university onboarding.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
