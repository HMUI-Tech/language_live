export function makeProgressClient(client) {
  let boundUserId=null;
  async function userId() {
    if (!client) throw new Error('Sign in to save progress.');
    const {data,error}=await client.auth.getUser();
    if (error || !data.user) throw new Error('Please sign in again.');
    if(boundUserId && boundUserId!==data.user.id) throw new Error('Account changed. Reload before saving progress.');
    boundUserId=data.user.id;
    return data.user.id;
  }
  return {
    async load() {
      await userId();
      const {data,error}=await client.rpc('get_german_progress');
      if(error) throw new Error('Could not load your progress.');
      return data || {docs:null,revision:0};
    },
    async save(docs,revision) {
      await userId();
      const {data,error}=await client.rpc('save_german_progress',{new_docs:docs,expected_revision:revision});
      if(error) {
        const conflict=error.message?.includes('progress_conflict');
        const failure=new Error(conflict ? 'Progress changed on another device. Export this copy and reload.' : 'Could not save progress. Please retry.');
        failure.conflict=conflict;throw failure;
      }
      return {revision:data};
    },
  };
}
