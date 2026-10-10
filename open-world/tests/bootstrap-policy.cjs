// Read-only guard assertions for review of the optional one-time bootstrap.
const fs=require('node:fs'),assert=require('node:assert/strict');
const file=process.argv[2];if(!file)throw Error('Pass the local backup workflow file.');const s=fs.readFileSync(file,'utf8');
for(const token of ["branches: [open-world]","github.event_name == 'push'","github.ref == 'refs/heads/open-world'","00e391ffe0bb2ed663a7e3136cf382b0030857b4","refs/tags/pre-openworld-backup","main.data.object.sha !== expected","existing.data.object.sha !== expected","github.rest.git.createRef"])assert(s.includes(token),token);
for(const token of ['pull_request','workflow_dispatch','updateRef','deleteRef','secrets.','actions/checkout','pages: write','id-token: write'])assert(!s.includes(token),token);
assert.equal((s.match(/contents: write/g)||[]).length,1);console.log('Bootstrap policy passed. contents:write is broader GitHub token capability; code restricts intended action to the exact new tag.');
