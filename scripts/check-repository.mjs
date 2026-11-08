import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));let failed=false;
for(const name of ['deutsch-live','italian-live']){
 const dir=root+'apps/'+name+'/';
 const html=readFileSync(dir+'public/learn.html','utf8');
 if(Buffer.byteLength(html)>10000||html.includes('data:font')||html.includes('id="dl-content"')){console.error(name+': learning HTML contains duplicated assets');failed=true;}
 for(const m of html.matchAll(/(?:src|href)="(\/[^"#?]+)(?:[?#][^"]*)?"/g))if(!existsSync(dir+'public'+m[1])){console.error(name+': missing '+m[1]);failed=true;}
 for(const file of readdirSync(dir+'public').filter(f=>f.endsWith('.js'))){const r=spawnSync(process.execPath,['--check',dir+'public/'+file],{encoding:'utf8'});if(r.status!==0){console.error(r.stderr);failed=true;}}
 const json=JSON.parse(readFileSync(dir+'public/content.json','utf8')),cards=json.packs.flatMap(p=>p.items),ids=new Set(cards.map(c=>c.id));
 if(ids.size!==cards.length){console.error(name+': duplicate card IDs');failed=true;}
 console.log(`${name}: ${cards.length} distinct cards; linked assets and browser script syntax checked`);
}
process.exitCode=failed?1:0;
