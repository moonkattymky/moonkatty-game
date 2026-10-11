/* Exact current-base SQL inputs for isolated admission regressions.
 * Deliberately excludes unmerged trusted-route/finale/reward-policy migrations.
 * No directory scanning, database URLs, connections or production data. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const prerequisiteFiles=Object.freeze([
 'server/schema.sql',
 'server/migrations/20261007_social_verify.sql',
 'supabase/migrations/20261007200800_reward_integrity_sessions.sql',
 'supabase/migrations/20261008201825_launch_campaign_integrity.sql',
 'supabase/migrations/20261009120925_prelaunch_referral_caps.sql'
]);
const admissionMigration='supabase/migrations/20261009153246_atomic_submission_admission.sql';
const admissionFiles=Object.freeze([...prerequisiteFiles,admissionMigration]);
function readSql(file){
 if(!admissionFiles.includes(file))throw Error('Unexpected admission fixture SQL: '+file);
 return fs.readFileSync(path.join(root,file),'utf8');
}
module.exports={prerequisiteFiles,admissionMigration,admissionFiles,readSql};
