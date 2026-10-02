import { describe, expect, it } from 'vitest';

interface DispatchExports {
  allowedFiles: (cardText: string, cardPath?: string) => string[];
  sumNumstat: (text: string) => { files: number; added: number; deleted: number };
  parseQuotaError: (text: string) => { resetIn?: string } | null;
  parseModelUnavailable: (text: string) => boolean;
  quotaSummary: (entries: Record<string, unknown>[]) => string;
}

const dispatchModulePath: string = '../scripts/agents/dispatch.mjs';
const { allowedFiles, sumNumstat, parseQuotaError, parseModelUnavailable, quotaSummary } = (await import(dispatchModulePath)) as DispatchExports;

describe('sumNumstat', () => {
  it('汇总普通文件的新增和删除行', () => {
    expect(sumNumstat('4\t2\tsrc/a.ts\n3\t1\tdocs/a.md')).toEqual({ files: 2, added: 7, deleted: 3 });
  });

  it('二进制文件计入文件数但不计行数', () => {
    expect(sumNumstat('-\t-\tassets/image.png')).toEqual({ files: 1, added: 0, deleted: 0 });
  });

  it('空输入返回零统计', () => {
    expect(sumNumstat('')).toEqual({ files: 0, added: 0, deleted: 0 });
  });

  it('末尾换行不额外计入文件', () => {
    expect(sumNumstat('2\t0\tfile.txt\n')).toEqual({ files: 1, added: 2, deleted: 0 });
  });
});

describe('allowedFiles', () => {
  it('读取允许修改文件一节中的新增和修改路径', () => {
    const card = [
      '## 允许修改的文件',
      '- 修改:`scripts/agents/dispatch.mjs`',
      '- 新增:`tests/dispatch.test.ts`',
      '## 要求',
      '- 不应读取这里的 `ignored.txt`',
    ].join('\n');
    expect(allowedFiles(card)).toEqual(['scripts/agents/dispatch.mjs', 'tests/dispatch.test.ts']);
  });

  it('保留任务卡路径并把占位符转换为通配符', () => {
    const card = '## 允许修改的文件\n- 新增:`changelog.d/<日期>-032-dispatch-fixes.md`';
    expect(allowedFiles(card, 'docs/tasks/032-dispatch-fixes.md')).toEqual([
      'docs/tasks/032-dispatch-fixes.md',
      'changelog.d/*-032-dispatch-fixes.md',
    ]);
  });

  it('没有允许修改文件章节时只返回任务卡路径', () => {
    expect(allowedFiles('## 要求\n- 其他内容', 'docs/tasks/card.md')).toEqual(['docs/tasks/card.md']);
  });
});

describe('parseQuotaError(额度用尽识别)', () => {
  it('识别 agy 的 429 并取出重置时间', () => {
    const text = [
      'error: Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 1h28m45s.',
      'AGY_ERROR: {"status":"RESOURCE_EXHAUSTED","error_code":429}',
    ].join('\n');
    expect(parseQuotaError(text)).toEqual({ resetIn: '1h28m45s' });
  });

  it('只有分钟 / 秒的重置时间也能取', () => {
    expect(parseQuotaError('Individual quota reached. Resets in 12m3s.')).toEqual({ resetIn: '12m3s' });
    expect(parseQuotaError('RESOURCE_EXHAUSTED (code 429): Resets in 45s')).toEqual({ resetIn: '45s' });
  });

  it('没有写重置时间时 resetIn 缺省', () => {
    expect(parseQuotaError('RESOURCE_EXHAUSTED')).toEqual({ resetIn: undefined });
  });

  it('正常输出、被拒命令这类别的错误都不算额度问题', () => {
    expect(parseQuotaError('{"status":"SUCCESS","response":"ok"}')).toBeNull();
    expect(parseQuotaError('jetski: no output produced — a tool required the "command" permission')).toBeNull();
    expect(parseQuotaError('')).toBeNull();
  });
});

describe('parseModelUnavailable(Copilot 模型未开通)', () => {
  it('识别 not available', () => {
    expect(parseModelUnavailable('Error: Model "gpt-5.4" from --model flag is not available.')).toBe(true);
  });
  it('正常输出不算', () => {
    expect(parseModelUnavailable('{"type":"result"}')).toBe(false);
  });
});

describe('quotaSummary(额度日志汇总)', () => {
  const entries = [
    { time: '2026-10-02T04:00:00.000Z', phase: 'before', agent: 'antigravity', model: 'gemini-3.8-flash-high', status: 'ok' },
    { time: '2026-10-02T04:10:00.000Z', phase: 'run', agent: 'antigravity', model: 'gemini-3.8-flash-high', job: '065', tokens: { input: 1000, output: 200 }, minutes: 5.2 },
    { time: '2026-10-02T04:20:00.000Z', phase: 'run', agent: 'antigravity', model: 'gemini-3.8-flash-high', job: '066', tokens: { input: 5000, output: 800 }, minutes: 8.1 },
    { time: '2026-10-02T04:30:00.000Z', phase: 'after', agent: 'antigravity', model: 'gemini-3.8-flash-high', status: 'exhausted', resetIn: '1h28m45s' },
    { time: '2026-10-02T04:31:00.000Z', phase: 'manual', agent: '—', note: 'App 显示:5h 9% / 周 53%' },
  ];

  it('每个模型取最近一次检查,带状态和重置时间', () => {
    const md = quotaSummary(entries);
    expect(md).toContain('antigravity / gemini-3.8-flash-high');
    expect(md).toContain('收工后');
    expect(md).toContain('额度用尽');
    expect(md).toContain('1h28m45s');
  });

  it('今天的用量按模型累加(作业数、输入、输出 token)', () => {
    const md = quotaSummary(entries);
    expect(md).toContain('| antigravity / gemini-3.8-flash-high | 2 | 6000 | 1000 |');
  });

  it('带上最近一次人工备注', () => {
    expect(quotaSummary(entries)).toContain('App 显示:5h 9% / 周 53%');
  });

  it('日志为空时不抛错', () => {
    expect(quotaSummary([])).toContain('今天还没派活');
  });
});
