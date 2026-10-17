const test = require('node:test');
const assert = require('node:assert/strict');

test('placements accept numeric strings and keep incomplete entries after ranked entries', async () => {
    const {sortLevels, rankLabel} = await import('../list-model.js');
    const entries = [{id:'missing',name:'Missing'},{id:'ten',position:'10',name:'Ten'},{id:'two',position:2,name:'Two'},{id:'bad',position:0,name:'Bad'}];
    assert.deepEqual(sortLevels(entries).map(item=>item.id),['two','ten','bad','missing']);
    assert.equal(rankLabel(entries[0]),'Unranked');
    assert.equal(rankLabel(entries[1]),'#10');
    assert.equal(entries[0].id,'missing');
});
test('name and point sorting keep original placements and put missing points last', async () => {
    const {sortLevels} = await import('../list-model.js');
    const entries=[{name:'Z',points:'25',position:1},{name:'A',points:50,position:2},{name:'M'}];
    assert.deepEqual(sortLevels(entries,'name').map(item=>item.name),['A','M','Z']);
    assert.deepEqual(sortLevels(entries,'points').map(item=>item.name),['A','Z','M']);
    assert.equal(entries[0].position,1);
});
test('search includes verified victors and excludes unapproved or partial records', async () => {
    const {filterLevels}=await import('../list-model.js');
    const levels=[{id:'a',name:'Level A',creator:'Creator',verifier:'Verifier',difficulty:'Extreme Demon'}];
    const records=[{levelId:'a',player:'Victor',progress:'100',approved:true},{levelId:'a',player:'Pending',progress:100,approved:false},{levelId:'a',player:'Partial',progress:99,approved:true}];
    for(const term of ['level a','creator','verifier','extreme','victor']) assert.equal(filterLevels(levels,records,term).length,1);
    for(const term of ['pending','partial']) assert.equal(filterLevels(levels,records,term).length,0);
});
test('duplicate completions award points once and victors use stable player IDs', async () => {
    const {buildStats}=await import('../stats-model.js');
    const {victorNames}=await import('../victors.js');
    const records=[{approved:true,progress:100,levelId:'a',playerId:'1',player:'Player'},{approved:true,progress:'100',levelId:'a',playerId:'1',player:'Player'},{approved:false,progress:100,levelId:'a',playerId:'2',player:'Pending'}];
    const stats=buildStats([{id:'a',name:'A',points:'50',position:1}],records);
    assert.equal(stats.length,1); assert.equal(stats[0].points,50); assert.equal(stats[0].completed.length,1);
    assert.deepEqual(victorNames(records,'a'),['Player']);
});
test('post-login redirects are restricted to known routes in the same deployed directory', async () => {
    global.location={href:'https://neppyza.github.io/GD-1.1-demonlist-early-versionA/community.html'};
    const {returnDestination}=await import('../auth.js');
    assert.equal(returnDestination('submit.html'),'https://neppyza.github.io/GD-1.1-demonlist-early-versionA/submit.html');
    for(const value of ['https://attacker.example/','//attacker.example/','javascript:alert(1)','../other-site/admin.html','community.html','missing.html','/admin.html']) assert.equal(returnDestination(value),null);
});
test('configuration, domain, credential and permission failures are explicit', async () => {
    const {authMessage,dataMessage}=await import('../messages.js');
    assert.match(authMessage({code:'auth/configuration-not-found'}),/initialize Authentication/);
    assert.match(authMessage({code:'auth/unauthorized-domain'}),/authorized domains/);
    assert.match(authMessage({code:'auth/invalid-credential'}),/could not verify/);
    assert.match(dataMessage({code:'permission-denied'},'profiles'),/Access to profiles was denied/);
});
test('registered players start at zero; UID joins preserve legacy players and deduplicate approved scores', async () => {
    const {buildStats}=await import('../stats-model.js');
    const profiles=[{id:'one',displayName:'Current Name',bio:'Public bio',tags:['Player','Creator']},{id:'new',displayName:'New Player',bio:'',tags:['Player']},{id:'invalid',displayName:'Invalid',bio:'',tags:['Admin']}];
    const records=[{approved:true,progress:100,levelId:'a',playerId:'one',player:'Old Name'},{approved:true,progress:100,levelId:'a',playerId:'one',player:'Old Name'},{approved:true,progress:100,levelId:'a',playerId:'legacy',player:'Legacy Player'},{approved:false,progress:100,levelId:'a',playerId:'new',player:'New Player'}];
    const stats=buildStats([{id:'a',name:'A',points:'50',position:1}],records,profiles);
    assert.equal(stats.length,3);
    assert.equal(stats.find(p=>p.id==='one').name,'Current Name');
    assert.equal(stats.find(p=>p.id==='one').points,50);
    assert.equal(stats.find(p=>p.id==='one').completed.length,1);
    assert.deepEqual(stats.find(p=>p.id==='one').tags,['Player','Creator']);
    assert.equal(stats.find(p=>p.id==='new').points,0);
    assert.equal(stats.find(p=>p.id==='legacy').points,50);
    assert.equal(profiles[0].displayName,'Current Name');
});
test('profiles reject missing, duplicate and privileged tags', async () => {
    const {validPlayerProfile}=await import('../player-profile.js');
    const profile={displayName:'Player',bio:'',tags:['Player']};
    assert.equal(validPlayerProfile(profile),true);
    for(const tags of [[],['Owner'],['Player','Player'],['Player','Admin'],null]) assert.equal(validPlayerProfile({...profile,tags}),false);
    assert.equal(validPlayerProfile({...profile,displayName:'   '}),false);
});

test('removed registered and legacy players stay out of rankings and can be restored without deleting records', async () => {
    const {buildStats}=await import('../stats-model.js');
    const levels=[{id:'a',points:50,position:1,name:'A'}];
    const records=[{approved:true,progress:100,levelId:'a',playerId:'registered',player:'Saved Player'},{approved:true,progress:100,levelId:'a',playerId:'legacy',player:'Legacy Player'}];
    const profiles=[{id:'registered',displayName:'Saved Player',bio:'',tags:['Player'],removed:true},{id:'legacy',removed:true}];
    assert.deepEqual(buildStats(levels,records,profiles),[]);
    const restored=buildStats(levels,records,profiles.map(profile=>({...profile,removed:false})));
    assert.equal(restored.length,2); assert.deepEqual(restored.map(player=>player.points),[50,50]);
    assert.equal(records.length,2);
});

test('completion proof validation and pair keys reject unsafe input and avoid ambiguous identities', async () => {
    const {validCompletion,completionKey}=await import('../completion-model.js');
    assert.equal(validCompletion({levelId:'a',proofUrl:'https://example.org/proof',notes:''}),true);
    for(const proofUrl of ['javascript:alert(1)','http://example.org/proof','not a link','https://']) assert.equal(validCompletion({levelId:'a',proofUrl}),false);
    assert.equal(validCompletion({levelId:'bad/path',proofUrl:'https://example.org'}),false);
    assert.equal(validCompletion({levelId:'a',proofUrl:'https://example.org',notes:'x'.repeat(501)}),false);
    assert.equal(await completionKey('player','level'),await completionKey('player','level'));
    assert.notEqual(await completionKey('a,b','c'),await completionKey('a','b,c'));
    assert.notEqual(await completionKey('player','level'),await completionKey('other','level'));
});

test('country choices cover the catalog and reject unsupported country identifiers', async () => {
    const {countries,getCountry,isCountryCode}=await import('../countries.js');
    assert.equal(countries.length,250);
    assert.equal(new Set(countries.map(country=>country.code)).size,250);
    for(const code of ['FR','CD','US','BR','IN','JP','ZA','PS','TW','XK','AX']) assert.ok(getCountry(code));
    for(const code of ['ZZ','fr','France','../us','GB-SCT','',null]) assert.equal(isCountryCode(code),false);
});
test('legacy profiles stay visible while completed onboarding requires a valid country', async () => {
    const {validPlayerProfile,completePlayerProfile}=await import('../player-profile.js');
    const profile={displayName:'Player',bio:'',tags:['Player']};
    assert.equal(validPlayerProfile(profile),true);
    assert.equal(completePlayerProfile(profile),false);
    assert.equal(completePlayerProfile({...profile,countryCode:'CD'}),true);
    assert.equal(validPlayerProfile({...profile,countryCode:'ZZ'}),false);
});
test('changing a country preserves the player identity, points and completion history', async () => {
    const {buildStats}=await import('../stats-model.js');
    const levels=[{id:'a',name:'Level',position:1,points:50}];
    const records=[{approved:true,progress:100,levelId:'a',playerId:'one',player:'Old Name'}];
    const profile={id:'one',displayName:'Player',bio:'',tags:['Player']};
    for(const countryCode of [undefined,'FR','CD']){
        const stats=buildStats(levels,records,[{...profile,...(countryCode?{countryCode}:{})}]);
        assert.equal(stats.length,1);assert.equal(stats[0].id,'one');assert.equal(stats[0].points,50);assert.equal(stats[0].completed.length,1);assert.equal(stats[0].countryCode,countryCode||null);
    }
});

test('point changes and revoked completions recalculate scores and public victors', async () => {
    const {buildStats}=await import('../stats-model.js');
    const {victorNames}=await import('../victors.js');
    const records=[{approved:true,progress:100,levelId:'a',playerId:'one',player:'Player'}, {approved:true,progress:100,levelId:'a',playerId:'one',player:'Player'}];
    const profiles=[{id:'one',displayName:'Player',bio:'',tags:['Player']}];
    assert.equal(buildStats([{id:'a',points:0}],records,profiles)[0].points,0);
    assert.equal(buildStats([{id:'a',points:20}],records,profiles)[0].points,20);
    const revoked=records.map(record=>({...record,approved:false}));
    assert.equal(buildStats([{id:'a',points:20}],revoked,profiles)[0].points,0);
    assert.equal(buildStats([{id:'a',points:20}],revoked,profiles)[0].completed.length,0);
    assert.deepEqual(victorNames(revoked,'a'),[]);
});

test('owner corrections preserve completions, support reset and future scores, and cannot resurrect removed players', async () => {
    const {buildStats}=await import('../stats-model.js');
    const levels=[{id:'a',points:50},{id:'b',points:20}];
    const records=[{playerId:'p',player:'Player',levelId:'a',approved:true,progress:100}];
    const score=delta=>buildStats(levels,records,[],[{id:'p',delta}])[0];
    assert.equal(score(-10).points,40);
    assert.equal(score(25).points,75);
    assert.equal(score(0).points,50);
    assert.equal(score(-80).points,0);
    assert.equal(score(25).completed.length,1);
    for(const bad of [NaN,Infinity,'90',1000001]) assert.equal(score(bad).points,50);
    records.push({playerId:'p',player:'Player',levelId:'b',approved:true,progress:100});
    assert.equal(score(-10).points,60);
    assert.equal(buildStats(levels,records,[{id:'p',removed:true}],[{id:'p',delta:99}]).length,0);
    assert.equal(buildStats([],[],[],[{id:'ghost',delta:99}]).length,0);
});
