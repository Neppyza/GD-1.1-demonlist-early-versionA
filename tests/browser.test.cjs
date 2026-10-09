// Browser-only SDK fixtures. Production always uses the configured Firebase SDK.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.DEMONLIST_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname,'..');
const output = process.env.DEMONLIST_TEST_OUTPUT || path.join(root,'test-output');
fs.mkdirSync(output,{recursive:true});
const levels = [
    {id:'alpha',name:'Fixture Alpha',position:'1',points:'50',creator:'Creator A',verifier:'Verifier A',difficulty:'Extreme Demon',thumbnail:'/thumbnail-2.jpg',levelUrl:'https://example.org/alpha',proofUrl:'https://example.org/proof'},
    {id:'beta',name:'Fixture Beta',position:2,points:25,creator:'Creator B',verifier:'Verifier B',difficulty:'Demon',thumbnail:'/image.jpg'},
    {id:'incomplete',name:'Incomplete entry'}
];
const appModule = `let app; export const getApps=()=>app?[app]:[]; export const getApp=()=>app; export const initializeApp=config=>{window.__test.initializations++;return app={config}};`;
const authModule = `
const test=window.__test; const listeners=new Set();
const auth={currentUser:JSON.parse(localStorage.getItem('demonlist-test-user')||'null')};
test.setUser=user=>{auth.currentUser=user; user?localStorage.setItem('demonlist-test-user',JSON.stringify(user)):localStorage.removeItem('demonlist-test-user'); for(const listener of listeners)queueMicrotask(()=>listener(user));};
export const getAuth=()=>auth;
export const browserLocalPersistence={type:'LOCAL'};
export const setPersistence=async()=>{test.persistence++;if(test.persistenceError)throw{code:test.persistenceError}};
export class GoogleAuthProvider{setCustomParameters(){}}
export const onIdTokenChanged=(auth,callback)=>{listeners.add(callback);test.authListeners++;queueMicrotask(()=>callback(auth.currentUser));return()=>listeners.delete(callback)};
export const getIdTokenResult=async(user,force)=>{if(force)test.roleChecks++;return{claims:user.claims||{}}};
export const signInWithPopup=async()=>{test.logins++;await new Promise(r=>setTimeout(r,test.authDelay||20));if(test.authError)throw{code:test.authError};test.setUser(test.loginUser);return{user:auth.currentUser}};
export const signOut=async()=>{test.logouts++;if(test.logoutError)throw{code:test.logoutError};test.setUser(null)};
`;
const storeModule = `
const test=window.__test;const watchers=[];let sequence=0;
export const getFirestore=()=>({});
export const collection=(db,name)=>({name,filters:[]});
export const where=(field,op,value)=>({field,op,value});
export const query=(ref,...filters)=>({...ref,filters});
export const doc=(parent,name,id)=>parent.name?{name:parent.name,id:name||'generated-'+(++sequence)}:{name,id};
const entries=ref=>Object.entries(test.data[ref.name]||{}).filter(([id,item])=>(ref.filters||[]).every(f=>item[f.field]===f.value)).map(([id,item])=>({id,data:()=>item}));
const snapshot=ref=>{const docs=entries(ref);return{docs,empty:docs.length===0}};
test.emit=name=>{for(const w of watchers.filter(w=>w.active&&w.ref.name===name))w.ok(snapshot(w.ref))};
test.fail=(name,code)=>{for(const w of watchers.filter(w=>w.active&&w.ref.name===name))w.error({code})};
test.watcherCount=name=>watchers.filter(w=>w.active&&w.ref.name===name).length;
export const onSnapshot=(ref,ok,error)=>{const w={ref,ok,error,active:true};watchers.push(w);test.reads.push(ref);setTimeout(()=>w.active&&ok(snapshot(ref)),0);return()=>{w.active=false}};
export const getDocs=async ref=>{test.reads.push(ref);await new Promise(r=>setTimeout(r,test.readDelay||0));if(test.readError)throw{code:test.readError};return snapshot(ref)};
export const getDoc=async ref=>{await new Promise(r=>setTimeout(r,test.readDelay||0));if(test.readError)throw{code:test.readError};const item=test.data[ref.name]?.[ref.id];return{exists:()=>!!item,data:()=>item}};
export const serverTimestamp=()=>({serverTimestamp:true});
const save=(ref,data,merge=false)=>{if(test.writeError)throw{code:test.writeError};test.writes.push({ref,data});test.data[ref.name]||={};test.data[ref.name][ref.id]=merge?{...test.data[ref.name][ref.id],...data}:data;test.emit(ref.name)};
export const setDoc=async(ref,data)=>save(ref,data);
export const writeBatch=()=>{const pending=[];return{set:(ref,data)=>pending.push([ref,data]),commit:async()=>{if(test.writeError)throw{code:test.writeError};for(const [ref,data]of pending)save(ref,data);if(test.persistData)sessionStorage.setItem('demonlist-onboarding-data',JSON.stringify(test.data))}}};
export const addDoc=async(ref,data)=>{const item=doc(ref);save(item,data);return item};
export const runTransaction=async(db,callback)=>{const pending=[];await callback({get:getDoc,set:(ref,data)=>pending.push([ref,data,false]),update:(ref,data)=>pending.push([ref,data,true])});for(const [ref,data,merge]of pending)save(ref,data,merge)};
`;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const file=path.join(root,pathname==='/'?'index.html':pathname);
    if(!file.startsWith(root)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end()}
    res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');res.end(fs.readFileSync(file));
});

(async()=>{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin=`http://127.0.0.1:${server.address().port}`;
    const browser=await chromium.launch({headless:true,...(process.env.DEMONLIST_CHROMIUM?{executablePath:process.env.DEMONLIST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}: {})});
    const context=await browser.newContext({viewport:{width:1440,height:950},colorScheme:'light',reducedMotion:'reduce'});
    const errors=[];
    context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
    await context.addInitScript(items=>{
        window.__test={initializations:0,persistence:0,authListeners:0,roleChecks:0,logins:0,logouts:0,reads:[],writes:[],loginUser:{uid:'fixture-user',displayName:'Fixture User',claims:{}},data:{levels:Object.fromEntries(items.map(item=>[item.id,item])),records:{},agreements:{'fixture-user':{version:'2026-10-05'}},profiles:{'fixture-user':{displayName:'Saved Player',bio:'Private fixture bio'}},players:{'fixture-user':{displayName:'Saved Player',bio:'Public fixture bio',tags:['Player']},'staff-user':{displayName:'Staff Player',bio:'',tags:['Player']}},submissions:{}}};
        if(location.protocol==='http:'){const saved=sessionStorage.getItem('demonlist-onboarding-data');if(saved){window.__test.data=JSON.parse(saved);window.__test.persistData=true;}}
    },levels);
    for(const [name,body]of [['firebase-app.js',appModule],['firebase-auth.js',authModule],['firebase-firestore.js',storeModule]])await context.route('https://www.gstatic.com/firebasejs/**/'+name,route=>route.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body}));
    const page=await context.newPage();
    const ready=()=>page.waitForFunction(()=>window.__test?.authListeners===1);
    await page.goto(origin);await page.locator('.demon-row').first().waitFor();await ready();
    assert.equal(await page.locator('.demon-row').count(),3);
    assert.match(await page.locator('.demon-row').first().innerText(),/Fixture Alpha/);
    assert.equal(await page.evaluate(()=>window.__test.initializations),1);
    assert.equal(await page.evaluate(()=>window.__test.watcherCount('levels')),1);
    assert.equal(await page.evaluate(()=>window.__test.watcherCount('records')),1);
    for(const [term,expected]of [['creator a','Fixture Alpha'],['verifier b','Fixture Beta'],['extreme','Fixture Alpha']]){await page.locator('#search').fill(term);assert.match(await page.locator('#levels').innerText(),new RegExp(expected))}
    await page.locator('#search').fill('missing-value');assert.equal(await page.locator('.demon-row').count(),0);await page.getByRole('button',{name:'Clear search'}).click();
    await page.locator('#sort').selectOption('name');assert.match(await page.locator('.demon-row').first().innerText(),/Fixture Alpha/);
    await page.locator('#sort').selectOption('points');assert.match(await page.locator('.demon-row').last().innerText(),/Incomplete entry/);
    await page.locator('#sort').selectOption('position');
    assert.equal(await page.locator('[data-section]').count(),0);assert.equal(await page.locator('#ranking-index li').count(),3);
    await page.locator('.level-name a').first().click();assert.equal(await page.locator('dialog').evaluate(el=>el.open),true);assert.equal(await page.locator('#detail-title').innerText(),'Fixture Alpha');assert.equal(await page.getByRole('link',{name:'Open level ↗'}).getAttribute('href'),'https://example.org/alpha');await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').evaluate(el=>el.open),false);
    await page.goto(origin+'/?level=beta');await page.locator('dialog[open]').waitFor();assert.equal(await page.locator('#detail-title').innerText(),'Fixture Beta');await page.getByRole('button',{name:'Close level details'}).click();
    await page.evaluate(()=>{window.__test.data.records={one:{approved:true,progress:100,levelId:'alpha',playerId:'p',player:'Fixture Victor'},two:{approved:true,progress:100,levelId:'alpha',playerId:'p',player:'Fixture Victor'}};window.__test.emit('records')});
    await page.locator('#search').fill('fixture victor');assert.equal(await page.locator('.demon-row').count(),1);assert.equal(await page.locator('.demon-row .victor-count').last().innerText(),'1');await page.locator('#search').fill('');
    await page.evaluate(()=>window.__test.fail('levels','unavailable'));await page.getByRole('button',{name:'Try again'}).click();await page.locator('.demon-row').first().waitFor();assert.equal(await page.evaluate(()=>window.__test.watcherCount('levels')),1);
    await page.goto(origin);await page.locator('.demon-row').first().waitFor();await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
    await page.getByRole('button',{name:'Switch to dark theme'}).click();await page.reload();await page.locator('.demon-row').first().waitFor();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await page.screenshot({path:path.join(output,'dark.png'),fullPage:true});await page.getByRole('button',{name:'Switch to light theme'}).click();
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
    console.log('PASS list: database snapshots, sorting, all search fields, deduplicated victors, details, deep links, retry and single listeners.');

    await page.goto(origin+'/community.html');await ready();
    for(const code of ['auth/configuration-not-found','auth/operation-not-allowed','auth/unauthorized-domain','auth/invalid-credential','auth/popup-closed-by-user']){
        await page.evaluate(code=>{window.__test.authError=code},code);await page.getByRole('button',{name:'Continue with Google'}).click();await page.waitForFunction(code=>document.querySelector('[data-auth-status]').textContent.includes(code),code);assert.equal(await page.locator('[data-account-link]').innerText(),'Sign in');assert.equal(await page.locator('#member-content').isHidden(),true);
    }
    await page.evaluate(()=>{window.__test.authError=null;window.__test.authDelay=150;const button=document.querySelector('[data-auth-login]');button.click();button.click()});
    await page.locator('#member-content').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>window.__test.logins),6);assert.equal(await page.locator('[data-account-link]').innerText(),'Account');assert.equal(await page.locator('#display-name').inputValue(),'Saved Player');
    await page.reload();await page.locator('#member-content').waitFor({state:'visible'});assert.equal(await page.locator('[data-account-link]').innerText(),'Account');assert.equal(await page.evaluate(()=>window.__test.persistence),1);
    await page.locator('#display-name').fill('Updated Player');await page.locator('#profile-bio').fill('Private updated bio');await page.getByRole('button',{name:'Save profile'}).click();await page.waitForFunction(()=>document.getElementById('profile-status').textContent.includes('Profile saved'));assert.equal(await page.evaluate(()=>window.__test.writes[0].ref.name),'profiles');
    await page.evaluate(()=>window.__test.logoutError='auth/network-request-failed');await page.locator('.auth-panel [data-auth-logout]').click();await page.waitForFunction(()=>document.querySelector('[data-auth-status]').textContent.includes('network-request-failed'));assert.equal(await page.locator('[data-account-link]').innerText(),'Account');
    await page.evaluate(()=>window.__test.logoutError=null);await page.locator('.auth-panel [data-auth-logout]').click();await page.locator('#member-content').waitFor({state:'hidden'});assert.equal(await page.locator('#display-name').inputValue(),'');assert.equal(await page.locator('#profile-bio').inputValue(),'');assert.equal(await page.locator('[data-account-link]').innerText(),'Sign in');
    await page.evaluate(()=>document.getElementById('profile-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(await page.evaluate(()=>window.__test.writes.length),2);
    await page.evaluate(()=>{window.__test.readDelay=100;window.__test.setUser(window.__test.loginUser);setTimeout(()=>window.__test.setUser({uid:'other-user',displayName:'Other User',claims:{}}),20)});
    await page.locator('#community-rules').waitFor({state:'visible'});assert.equal(await page.locator('#member-content').isHidden(),true);assert.equal(await page.locator('#display-name').inputValue(),'');
    await page.evaluate(()=>window.__test.readDelay=0);
    console.log('PASS authentication UI: explicit setup/provider/domain/credential/cancellation errors, one login per action, navbar state, refresh restoration, honest logout failure and private-field cleanup. These checks use browser-only SDK fixtures.');

    await page.evaluate(()=>window.__test.setUser(window.__test.loginUser));await page.locator('#member-content').waitFor({state:'visible'});
    await page.goto(origin+'/submit.html');await page.locator('#member-content').waitFor({state:'visible'});assert.equal(await page.locator('#submission-form fieldset').isDisabled(),false);
    await page.locator('#level-name').fill('Submitted fixture');await page.locator('#creator-name').fill('Creator');await page.locator('#verifier-name').fill('Verifier');await page.locator('#level-url').fill('https://example.org/level');await page.locator('#proof-url').fill('https://example.org/proof');await page.locator('#rules-accepted').check();
    await page.evaluate(()=>{const form=document.getElementById('submission-form');form.requestSubmit();form.requestSubmit()});await page.waitForFunction(()=>document.getElementById('submission-status').textContent.includes('Submission received'));assert.equal(await page.evaluate(()=>window.__test.writes.length),1);assert.deepEqual(await page.evaluate(()=>Object.keys(window.__test.writes[0].data).sort()),['creator','levelName','levelUrl','notes','ownerUid','proofUrl','status','submittedAt','submittedBy','verifier'].sort());
    await page.goto(origin+'/admin.html');await ready();await page.waitForFunction(()=>document.getElementById('staff-status').textContent.includes('does not have'));assert.equal(await page.locator('#staff-tools').isHidden(),true);assert.equal(await page.locator('[data-staff-link]').isHidden(),true);
    await page.evaluate(()=>{const form=document.getElementById('victor-form');form.elements.player.value='Forged';form.elements.playerId.value='forged';form.elements.checkedProof.checked=true;const option=document.createElement('option');option.value='alpha';form.elements.levelId.append(option);form.elements.levelId.value='alpha';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});await page.waitForFunction(()=>document.getElementById('victor-status').textContent.includes('administrator access'));assert.equal(await page.evaluate(()=>window.__test.writes.length),0);
    await page.evaluate(()=>{window.__test.data.submissions.pending={ownerUid:'fixture-user',submittedBy:'Player',levelName:'Staff fixture',levelUrl:'https://example.org/level',creator:'Creator',verifier:'Verifier',proofUrl:'https://example.org/proof',notes:'',status:'pending'};window.__test.setUser({uid:'staff-user',displayName:'Staff User',claims:{admin:true}})});await page.locator('#staff-tools').waitFor({state:'visible'});assert.equal(await page.locator('.review-item').count(),1);await page.locator('.review-form input[name=position]').fill('3');await page.locator('.review-form input[name=points]').fill('10');await page.getByRole('button',{name:'Approve and publish'}).click();await page.waitForFunction(()=>window.__test.data.submissions.pending.status==='approved');assert.equal(await page.evaluate(()=>window.__test.writes.filter(write=>write.ref.name==='levels').length),1);
    await page.locator('#victor-level').selectOption('alpha');await page.locator('#victor-player').fill('Approved Player');await page.locator('#victor-id').fill('stable-player');await page.locator('input[name=checkedProof]').check();await page.getByRole('button',{name:'Approve completion'}).click();await page.waitForFunction(()=>document.getElementById('victor-status').textContent.includes('Completion approved'));assert.equal(await page.evaluate(()=>Object.keys(window.__test.data.records).length),1);assert.ok(await page.evaluate(()=>window.__test.roleChecks)>=3);
    await page.locator('.auth-panel [data-auth-logout]').click();await page.locator('#staff-tools').waitFor({state:'hidden'});assert.equal(await page.locator('#review-queue').innerText(),'');
    console.log('PASS protected flows: saved-name submission schema, duplicate-submit prevention, denied member staff writes, verified staff claims, approval transaction, stable victor key and logout cleanup. Firestore rule enforcement is tested separately in the emulator.');

    await page.goto(origin+'/stats.html');await ready();await page.evaluate(()=>{window.__test.data.records={one:{approved:true,progress:100,levelId:'alpha',playerId:'p',player:'Fixture Victor'},two:{approved:true,progress:100,levelId:'alpha',playerId:'p',player:'Fixture Victor'}};window.__test.emit('records')});await page.getByRole('link',{name:'Player profile for Fixture Victor',exact:true}).waitFor();assert.equal(await page.locator('#players tr').count(),3);await page.getByRole('link',{name:'Player profile for Fixture Victor',exact:true}).click();assert.match(await page.locator('#player-details').innerText(),/Fixture Alpha/);await page.locator('#player-search').fill('missing');assert.match(await page.locator('#players').innerText(),/No matching players/);
    await page.goto(origin+'/records.html');await ready();await page.evaluate(()=>{window.__test.data.records={one:{approved:true,progress:100,levelId:'alpha',playerId:'p',player:'Fixture Victor',proofUrl:'https://example.org/proof'}};window.__test.emit('records')});await page.waitForFunction(()=>document.getElementById('records-status').textContent==='1 of 1 approved records');await page.locator('#record-level').selectOption('beta');assert.match(await page.locator('#records').innerText(),/No matching records/);await page.locator('#record-level').selectOption('alpha');assert.equal(await page.getByRole('link',{name:'Watch proof ↗'}).getAttribute('href'),'https://example.org/proof');
    for(const route of ['index.html','stats.html','records.html','submit.html','rules.html','community.html','admin.html']){
        await page.goto(origin+'/'+route);await ready();assert.match(await page.title(),/GD 1\.1 Demonlist/);assert.doesNotMatch(await page.locator('body').innerText(),/Crux|crux|Player Hub|Stats Viewer/);
        if(['community.html','submit.html'].includes(route)){await page.evaluate(()=>window.__test.setUser(window.__test.loginUser));await page.locator('#member-content').waitFor({state:'visible'})}
        if(route==='admin.html'){await page.evaluate(()=>{window.__test.data.submissions.pending={ownerUid:'fixture-user',submittedBy:'Player',levelName:'Review fixture',creator:'Creator',verifier:'Verifier',levelUrl:'https://example.org/level',proofUrl:'https://example.org/proof',status:'pending'};window.__test.setUser({uid:'staff-user',displayName:'Staff',claims:{admin:true}})});await page.locator('#staff-tools').waitFor({state:'visible'})}
        for(const width of [320,390,540,768,1024,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Page overflow: ${route} at ${width}px`)}
        if(['community.html','submit.html','admin.html'].includes(route)){await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,route.replace('.html','-mobile.png')),fullPage:true})}
        for(const link of await page.locator('.header-inner nav a').all())assert.equal((await page.request.get(origin+'/'+await link.getAttribute('href'))).status(),200);
    }
    await page.goto(origin+'/profile.html');await page.waitForURL('**/community.html');assert.match(await page.title(),/GD 1\.1 Demonlist/);
    // New Google accounts must finish profile setup before returning to their route.
    await page.evaluate(()=>window.__test.setUser(null));
    await page.goto(origin+'/community.html?next=stats.html');await ready();
    await page.evaluate(()=>{window.__test.loginUser={uid:'new-player',displayName:'New Google User',claims:{}};window.__test.persistData=true;window.__test.setUser(null)});
    await page.getByRole('button',{name:'Continue with Google'}).click();await page.locator('#community-rules').waitFor({state:'visible'});
    assert.match(page.url(),/community.html/);assert.equal(await page.locator('#member-content').isHidden(),true);
    await page.locator('#community-agreement').check();await page.getByRole('button',{name:'Accept and continue'}).click();await page.locator('#member-content').waitFor({state:'visible'});
    assert.match(page.url(),/community.html/);
    await page.locator('#display-name').fill('New Player');await page.locator('#profile-bio').fill('<script>window.injected=true</script>');
    await page.locator('input[name=tags][value=Creator]').check();await page.locator('input[name=tags][value=Player]').uncheck();
    await page.evaluate(()=>window.__test.writeError='permission-denied');await page.getByRole('button',{name:'Save profile'}).click();await page.waitForFunction(()=>document.getElementById('profile-status').textContent.includes('denied'));
    assert.match(page.url(),/community.html/);assert.equal(await page.evaluate(()=>window.__test.data.players['new-player']),undefined);
    await page.evaluate(()=>window.__test.writeError=null);await page.getByRole('button',{name:'Save profile'}).click();await page.waitForURL('**/stats.html');
    await page.getByRole('link',{name:'Player profile for New Player',exact:true}).waitFor();
    const newRow=page.locator('#players tr').filter({hasText:'New Player'});assert.match(await newRow.innerText(),/Creator/);assert.deepEqual(await newRow.locator('td.numeric').allTextContents(),['0','0']);
    await page.getByRole('link',{name:'Player profile for New Player',exact:true}).click();assert.match(page.url(),/player=new-player/);assert.match(await page.locator('#player-details').innerText(),/No approved completions yet/);assert.match(await page.locator('#player-details').innerText(),/<script>/);assert.equal(await page.evaluate(()=>window.injected),undefined);
    await page.reload();await page.locator('#player-details').waitFor({state:'visible'});assert.match(await page.locator('#player-details').innerText(),/New Player/);
    await page.locator('#player-search').fill('creator');assert.equal(await page.locator('#players tr').count(),1);await page.locator('#player-search').fill('');
    await page.evaluate(()=>{window.__test.data.records={new:{approved:true,progress:100,levelId:'alpha',playerId:'new-player',player:'Old display name'},duplicate:{approved:true,progress:100,levelId:'alpha',playerId:'new-player',player:'Old display name'}};window.__test.emit('records')});
    assert.deepEqual(await newRow.locator('td.numeric').allTextContents(),['50','1']);assert.equal(await page.getByRole('link',{name:'Player profile for New Player',exact:true}).count(),1);
    await page.evaluate(()=>window.__test.fail('players','permission-denied'));await page.getByRole('button',{name:'Retry player profiles'}).waitFor();assert.match(await page.locator('#players').innerText(),/Old display name/);await page.getByRole('button',{name:'Retry player profiles'}).click();await page.getByRole('link',{name:'Player profile for New Player',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__test.watcherCount('players')),1);
    await page.goto(origin+'/community.html');await page.locator('#member-content').waitFor({state:'visible'});await page.locator('input[name=tags][value=Creator]').uncheck();await page.getByRole('button',{name:'Save profile'}).click();await page.waitForFunction(()=>document.getElementById('profile-status').textContent.includes('at least one'));
    await page.locator('.auth-panel [data-auth-logout]').click();await page.locator('#member-content').waitFor({state:'hidden'});assert.equal(await page.locator('input[name=tags]:checked').count(),0);assert.equal(await page.locator('#player-uid').innerText(),'');assert.equal(await page.locator('#view-profile').isHidden(),true);
    await page.evaluate(()=>window.__test.setUser({uid:'no-profile',displayName:'No Profile',claims:{}}));await page.goto(origin+'/index.html');await page.waitForURL('**/community.html?next=index.html');
    await page.evaluate(()=>window.__test.setUser(null));await page.goto(origin+'/index.html');await page.locator('.demon-row').first().waitFor();
    assert.equal(await page.locator('[data-section]').count(),0);
    await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.demon-row').first().hover();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.demon-row')).transform!=='none');
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.demon-row').first().evaluate(el=>getComputedStyle(el).transform),'none');
    console.log('PASS required profile onboarding, failed-save recovery, zero-point registration, safe public bio/tags, deep links, UID score joins, no duplicate players, profile retry, logout cleanup, removed ranking tabs, hover motion and reduced-motion support.');
    assert.deepEqual(errors,[]);
    const offline=await browser.newContext();await offline.route('https://www.gstatic.com/firebasejs/**',route=>route.abort());const offlinePage=await offline.newPage();const offlineErrors=[];offlinePage.on('pageerror',error=>offlineErrors.push(error.message));await offlinePage.goto(origin+'/community.html');await offlinePage.waitForFunction(()=>document.querySelector('[data-auth-status]').textContent.includes('Sign-in is unavailable'));assert.equal(await offlinePage.locator('[data-account-link]').innerText(),'Sign in');assert.equal(await offlinePage.locator('#member-content').isHidden(),true);assert.deepEqual(offlineErrors,[]);await offline.close();
    console.log('PASS Players, Records, consistent rebrand, every local nav route, legacy profile redirect, seven pages including authenticated forms at six viewport widths, SDK-load failure handling, and no uncaught JavaScript errors.');
    await browser.close();server.close();
})().catch(error=>{console.error(error);server.close();process.exit(1)});
