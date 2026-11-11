import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicConfig,authFeedback,oauthCallback,NATIVE_CALLBACK} from '../Client/src/auth-utils.ts';
test('only public Supabase credentials can be bundled',()=>{
 assert.deepEqual(publicConfig('https://warmly.supabase.co','sb_publishable_test'),{url:'https://warmly.supabase.co',key:'sb_publishable_test'});
 const jwt=role=>'eyJ.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
 assert.equal(publicConfig('https://warmly.supabase.co',jwt('anon')).key,jwt('anon'));
 for(const key of ['sb_secret_test',jwt('service_role'),jwt('authenticated'),'garbage'])assert.throws(()=>publicConfig('https://warmly.supabase.co',key));
 for(const url of ['http://warmly.supabase.co','https://warmly.supabase.co.attacker.org','https://user:password@warmly.supabase.co','https://warmly.supabase.co/?token=secret'])assert.throws(()=>publicConfig(url,'sb_publishable_test'));
});
test('rate-limit feedback preserves wait without weakening server protection',()=>{
 const r=authFeedback({message:'For security purposes, you can only request this after 46 seconds.',status:429});
 assert.equal(r.retrySeconds,46);assert.match(r.message,/Check your inbox/);assert.doesNotMatch(r.message,/security purposes/);
 assert.equal(authFeedback({code:'over_email_send_rate_limit'}).retrySeconds,0);
 assert.match(authFeedback({code:'email_not_confirmed'}).message,/Confirm your email/);
 assert.match(authFeedback({code:'provider_disabled'}).message,/Google sign-in is not available/);
});
test('OAuth return URLs are exact and only authorization codes are accepted',()=>{
 assert.deepEqual(oauthCallback('http://localhost:3000/?code=abc','http://localhost:3000/'),{error:null,code:'abc'});
 assert.deepEqual(oauthCallback(NATIVE_CALLBACK+'?code=abc',NATIVE_CALLBACK),{error:null,code:'abc'});
 for(const url of ['https://evil.test/?code=abc','http://localhost:3001/?code=abc','http://localhost:3000/other?code=abc','http://localhost:3000/#access_token=secret'])assert.equal(oauthCallback(url,'http://localhost:3000/'),null);
 assert.equal(oauthCallback('app.warmly.messenger://evil/callback?code=abc',NATIVE_CALLBACK),null);
 assert.equal(oauthCallback(NATIVE_CALLBACK+'?error=access_denied',NATIVE_CALLBACK).error,'access_denied');
});
