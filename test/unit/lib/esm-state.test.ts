import assert from 'assert';
import type * as State from '../../../src/lib/esm-state.ts';

if (Number(process.versions.node.split('.')[0]) >= 12) {
  describe('ESM registration state', () => {
    let state: typeof State;
    const caller = 'file:///mock-tests/caller.mjs';
    const target = 'file:///mock-tests/dep.mjs';
    before(async () => {
      state = await import('../../../src/lib/esm-state.ts');
    });
    afterEach(() => state.stopAll());

    it('keeps later registrations when an older alias resolves last', () => {
      const older = state.begin('./dep.mjs', caller);
      const newer = state.begin('dependency-alias', caller);
      state.add(target, { value: 'newer' }, {}, newer);
      state.finish(newer);
      state.add(target, { value: 'older' }, {}, older);
      state.finish(older);
      const metadata = state.snapshot().active[0][1];
      assert.strictEqual(state.get(metadata.id as number).value, 'newer');
    });

    it('does not revive a canceled registration after a new generation starts', () => {
      const old = state.begin('./dep.mjs', caller);
      state.stopAll();
      const fresh = state.begin('./dep.mjs', caller);
      state.add(target, { value: 'fresh' }, {}, fresh);
      state.finish(fresh);
      state.add(target, { value: 'old' }, {}, old);
      state.finish(old);
      assert.strictEqual(state.get(state.snapshot().active[0][1].id as number).value, 'fresh');
    });

    it('retries missing factory exports and rejects asynchronous factories', () => {
      let calls = 0;
      const ticket = state.begin('./dep.mjs', caller);
      state.add(target, () => (++calls === 1 ? {} : { value: undefined }), { lazy: true, exports: ['value'] }, ticket);
      state.finish(ticket);
      const id = state.snapshot().active[0][1].id as number;
      assert.throws(() => state.get(id), /did not provide export/);
      assert.strictEqual(state.get(id).value, undefined);
      assert.strictEqual(calls, 2);
      const asyncTicket = state.begin('./dep.mjs', caller);
      state.add(target, () => Promise.resolve({ value: 1 }), { lazy: true, exports: ['value'] }, asyncTicket);
      state.finish(asyncTicket);
      assert.throws(() => state.get(state.snapshot().active[0][1].id as number), /synchronous namespace/);
    });
  });
}
