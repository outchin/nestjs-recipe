import { labTrace } from './lab-trace';

describe('labTrace', () => {
  it('is a no-op outside a trace context', async () => {
    await expect(labTrace.span('x', async () => 42)).resolves.toBe(42);
    labTrace.note('y');
    expect(labTrace.spans()).toBeUndefined();
  });

  it('records spans in start order with nesting depth and details', async () => {
    const trace = await labTrace.run(async () => {
      await labTrace.span('outer', async () => {
        await labTrace.span('inner', async () => ({ stock: 1 }), (r) => ({ stock: r.stock }));
        labTrace.note('check', { ok: true });
      });
      return labTrace.spans()!;
    });

    expect(trace.spans.map((s) => [s.name, s.depth])).toEqual([
      ['outer', 0],
      ['inner', 1],
      ['check', 1],
    ]);
    expect(trace.spans[1].detail).toEqual({ stock: 1 });
    expect(trace.spans[2]).toMatchObject({ ms: 0, detail: { ok: true } });
  });

  it('marks a failing span with the error class and rethrows', async () => {
    const trace = await labTrace.run(async () => {
      await expect(labTrace.span('boom', async () => { throw new RangeError('no'); })).rejects.toThrow('no');
      return labTrace.spans()!;
    });
    expect(trace.spans[0].error).toBe('RangeError');
  });

  it('keeps concurrent requests apart', async () => {
    const one = (name: string) =>
      labTrace.run(async () => {
        await labTrace.span(name, () => new Promise((r) => setTimeout(r, 5)));
        return labTrace.spans()!.spans.map((s) => s.name);
      });
    await expect(Promise.all([one('a'), one('b')])).resolves.toEqual([['a'], ['b']]);
  });
});
