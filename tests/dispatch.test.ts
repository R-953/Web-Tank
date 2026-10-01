import { describe, expect, it } from 'vitest';

interface DispatchExports {
  allowedFiles: (cardText: string, cardPath?: string) => string[];
  sumNumstat: (text: string) => { files: number; added: number; deleted: number };
}

const dispatchModulePath: string = '../scripts/agents/dispatch.mjs';
const { allowedFiles, sumNumstat } = (await import(dispatchModulePath)) as DispatchExports;

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
