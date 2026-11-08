import {build} from 'esbuild';
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
const out=new URL('./dist/',import.meta.url);await mkdir(out,{recursive:true});
const config={url:process.env.SUPABASE_URL||'',key:process.env.SUPABASE_PUBLISHABLE_KEY||'',providers:(process.env.AUTH_PROVIDERS||'').split(',').filter(Boolean)};
if(config.key.startsWith('eyJ')) {const role=JSON.parse(Buffer.from(config.key.split('.')[1],'base64url')).role;if(role!=='anon')throw new Error('Only a public anon/publishable key is allowed');}
if(config.key.startsWith('sb_secret_'))throw new Error('Secret keys must never enter a browser bundle');
await build({entryPoints:[new URL('./src/auth.js',import.meta.url).pathname],outfile:new URL('auth.js',out).pathname,bundle:true,format:'iife',minify:true,define:{__AUTH_CONFIG__:JSON.stringify(config)}});
await cp(new URL('./index.html',import.meta.url),new URL('index.html',out));
await cp(new URL('./src/auth.css',import.meta.url),new URL('auth.css',out));
await cp(new URL('../public/fonts/',import.meta.url),new URL('fonts/',out),{recursive:true});
await cp(new URL('../public/content.json',import.meta.url),new URL('content.json',out));
let html=await readFile(new URL('../public/learn.html',import.meta.url),'utf8');
await writeFile(new URL('learn.html',out),html);
let privacy=await readFile(new URL('../public/privacy.html',import.meta.url),'utf8');
privacy=privacy.replace('This preview uses ChatGPT sign-in.','This independent edition uses Supabase authentication for configured providers.').replace('A browser copy is also stored for recovery. Guest progress stays in the current browser.','A browser copy of signed-in progress is stored for recovery. Guest progress is kept only in memory and is discarded on reload or navigation.').replace('This is an owner-only preview.','This edition is awaiting deployment and provider configuration.');
await writeFile(new URL('privacy.html',out),privacy);
console.log('Built independent edition; enabled sign-in providers:',config.providers.join(', ')||'none (guest only)');
