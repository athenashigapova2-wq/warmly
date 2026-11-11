import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicConfig,authFeedback,oauthCallback,NATIVE_CALLBACK,rememberedEmail,rememberEmail,restoreAuth} from '../Client/src/auth-utils.ts';
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

test('email survives reload without storing a password; blocked storage is tolerated',()=>{
 const data=new Map();const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 rememberEmail(storage,' student@example.com ');assert.equal(rememberedEmail(storage),'student@example.com');assert.equal(data.size,1);
 rememberEmail(storage,'');assert.equal(rememberedEmail(storage),'student@example.com');
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(rememberedEmail(blocked),'');assert.doesNotThrow(()=>rememberEmail(blocked,'a@b.test'));
});
test('stale callback cannot block a stored session; absent session retains actionable errors',async()=>{
 const session={user:{id:'existing'}};const stale=async()=>{throw Error('expired link');};
 assert.equal(await restoreAuth({getSession:async()=>({data:{session}})},stale),session);
 await assert.rejects(()=>restoreAuth({getSession:async()=>({data:{session:null}})},stale),/expired link/);
 assert.equal(await restoreAuth({getSession:async()=>({data:{session:null}})},async()=>false),null);
 await assert.rejects(()=>restoreAuth({getSession:async()=>({data:{session:null},error:Error('network')})},async()=>false),/network/);
});
