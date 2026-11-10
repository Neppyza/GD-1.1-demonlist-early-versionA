const test = require('node:test');
const assert = require('node:assert/strict');
test('saved levels parse safely and deduplicate', async () => {
    const {parseSavedLevels} = await import('../saved-levels.js');
    assert.deepEqual([...parseSavedLevels('bad json')], []);
    assert.deepEqual([...parseSavedLevels('{"a":1}')], []);
    assert.deepEqual([...parseSavedLevels(JSON.stringify(['a','a',5,'',null,'b']))], ['a','b']);
});
test('saved levels persist and handle unavailable storage', async () => {
    const {loadSavedLevels,storeSavedLevels} = await import('../saved-levels.js');
    const original = global.localStorage;
    let value;
    try {
        global.localStorage = {getItem: () => value, setItem: (_key,next) => {value=next;}};
        assert.equal(storeSavedLevels(new Set(['one','two'])),true);
        assert.deepEqual([...loadSavedLevels()],['one','two']);
        global.localStorage = {getItem: () => {throw Error('blocked');},setItem: () => {throw Error('blocked');}};
        assert.deepEqual([...loadSavedLevels()],[]);
        assert.equal(storeSavedLevels(new Set(['one'])),false);
    } finally {
        if(original === undefined) delete global.localStorage;
        else global.localStorage=original;
    }
});
