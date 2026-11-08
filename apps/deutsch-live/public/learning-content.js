/* Shared catalogue loading. A failed request never replaces saved progress. */
(function(root){
 async function load({fetcher=root.fetch,timeoutMs=10000}={}){
  const response=await fetcher('/content.json',{signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok)throw Error('Learning content could not be loaded.');
  const content=await response.json();
  if(!content||!Array.isArray(content.packs)||!content.packs.length||content.packs.some(p=>typeof p.id!=='string'||!Array.isArray(p.items)))throw Error('Invalid learning catalogue.');
  return content;
 }
 function showError(doc,retry){const parent=doc.getElementById('app');if(!parent)return;const panel=doc.createElement('section');panel.className='panel stack';const title=doc.createElement('h1');title.textContent='Could not start learning';const note=doc.createElement('p');note.textContent='Please check your connection and retry. Your saved progress has not been replaced.';const button=doc.createElement('button');button.type='button';button.className='btn primary';button.textContent='Retry';button.addEventListener('click',retry);panel.append(title,note,button);parent.replaceChildren(panel);}
 root.DLContent={load,showError};
})(globalThis);
