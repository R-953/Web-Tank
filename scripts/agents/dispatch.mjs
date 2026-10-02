#!/usr/bin/env node
/**
 * 多智能体调度:主程(Claude Code)把任务卡派给 Antigravity / Copilot 的命令行版,
 * 每个任务一个独立的 git worktree,agent 跑完后统一评分,出一份报告给主程审查。
 *
 * 用法(在仓库根目录):
 *   node scripts/agents/dispatch.mjs run   <作业文件.json> [--only id1,id2] [--dry-run]
 *   node scripts/agents/dispatch.mjs grade <作业文件.json> [--only id1,id2]   只评分,不启动 agent
 *   node scripts/agents/dispatch.mjs quota [作业文件.json] [--note "App 里看到的额度"]   查各模型现在还能不能用,记进额度日志
 *
 * run 开工前会先「预检」用到的每个 agent / 模型(发一句极短的提示,看是不是已经 429 额度用尽),结束后再查一次,
 * 两次结果和本次用量都追加到 Archive/agent-runs/quota-log.jsonl(本机,不进 git),并生成 Archive/agent-runs/quota.md 方便下次开工前复核。
 * 命令行拿不到「剩余百分比」,只能知道可用 / 已用尽(和多久后重置)和我们自己跑掉的 token;百分比要看 Antigravity / Copilot 应用,
 * 看到后用 quota --note 记一笔。--no-preflight 跳过预检;--skip-unavailable 预检不过的作业直接略过(默认整批不开工)。
 *
 * 作业文件格式、权限档位、评分项见 scripts/agents/README.md。只用 Node 自带模块,不加依赖。
 */
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const LOCAL = process.env.LOCALAPPDATA ?? '';
const APPDATA = process.env.APPDATA ?? '';
const IS_WIN = process.platform === 'win32';

// ---------------------------------------------------------------------------
// 两个 agent 的命令行
// ---------------------------------------------------------------------------

/** Copilot CLI:npm 全局安装的 .cmd 只是个外壳,直接用 node 跑它的入口,参数不经过 shell 转义 */
const COPILOT_LOADER = join(APPDATA, 'npm', 'node_modules', '@github', 'copilot', 'npm-loader.js');
const AGY = join(LOCAL, 'agy', 'bin', IS_WIN ? 'agy.exe' : 'agy');

/**
 * 权限档位:
 *   scoped —— 只许改工作区里的文件、跑下面这几条检查命令和只读的 git 命令;提交由本脚本统一做;
 *             禁止 push、改历史、装依赖、联网。agy 的规则写在 ~/.gemini/antigravity-cli/settings.json(见 README)
 *   full   —— 全部放开(负责人明确同意时才用)
 */
const ALLOWED_COMMANDS = 'npm run lint、npm test、npm run build、npx tsc --noEmit、npx vitest run(整套测试)、git status / diff / log / show';
const COPILOT_SCOPED = [
  '--allow-tool', 'write',
  // Copilot 按「命令 + 第一级子命令」匹配:shell(npm run lint) 匹配不到,要写成 shell(npm run:*)
  '--allow-tool', 'shell(npm run:*)', 'shell(npm test)', 'shell(npx tsc)', 'shell(npx vitest)',
  '--allow-tool', 'shell(git status)', 'shell(git diff)', 'shell(git log)', 'shell(git show)',
  '--deny-tool', 'shell(git push)', 'shell(git add)', 'shell(git commit)', 'shell(git reset)', 'shell(git rebase)', 'shell(git checkout)', 'shell(git switch)', 'shell(git worktree)', 'shell(git branch)', 'shell(git remote)',
  '--deny-tool', 'shell(npm install)', 'shell(npm i)', 'shell(npm ci)', 'shell(npm uninstall)', 'shell(npm publish)', 'shell(gh:*)', 'shell(curl)', 'shell(wget)',
];

const AGENTS = {
  copilot: {
    command: (job, prompt, perm, wt) => [
      process.execPath,
      [COPILOT_LOADER, '-p', prompt, '-C', wt, '--model', job.model ?? 'auto', '--output-format', 'json',
        ...(job.effort ? ['--reasoning-effort', job.effort] : []),
        ...(perm === 'full' ? ['--allow-all-tools'] : COPILOT_SCOPED)],
    ],
    check: () => existsSync(COPILOT_LOADER),
  },
  antigravity: {
    command: (job, prompt, perm) => [
      AGY,
      ['-p', prompt, '--model', job.model ?? 'gemini-3.8-flash-high', '--output-format', 'json',
        ...(job.effort ? ['--effort', job.effort] : []),
        // scoped:自动接受工作区内的编辑,命令按 ~/.gemini/antigravity-cli/settings.json 的放行规则(见 README),其余在无人值守时自动拒绝
        ...(perm === 'full' ? ['--dangerously-skip-permissions'] : ['--mode', 'accept-edits'])],
    ],
    check: () => existsSync(AGY),
  },
};

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

function sh(cmd, args, cwd, opts = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: opts.shell ?? false, timeout: opts.timeout ?? 15 * 60_000, maxBuffer: 64 << 20 });
  return { code: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}
const git = (cwd, ...args) => sh('git', args, cwd);
const npm = (cwd, ...args) => {
  if (!IS_WIN) return sh('npm', args, cwd);
  const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  if (existsSync(npmCli)) return sh(process.execPath, [npmCli, ...args], cwd);
  const command = ['npm.cmd', ...args.map((arg) => `"${arg.replaceAll('"', '""')}"`)].join(' ');
  return sh(command, [], cwd, { shell: true });
};

/** 简单通配:`*` 匹配一段路径里的任意字符,`**` 跨目录 */
function globToRegExp(glob) {
  const s = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\0').replace(/\*/g, '[^/]*').replace(/\0/g, '.*');
  return new RegExp(`^${s}$`);
}

/** 汇总 git diff --numstat 输出,二进制文件计入文件数但不计行数 */
export function sumNumstat(text) {
  const stats = { files: 0, added: 0, deleted: 0 };
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const match = line.match(/^(\d+|-)\t(\d+|-)\t/);
    if (!match) continue;
    stats.files++;
    if (match[1] !== '-') stats.added += Number(match[1]);
    if (match[2] !== '-') stats.deleted += Number(match[2]);
  }
  return stats;
}

/**
 * 从任务卡「允许修改的文件」一节取路径:只看以「新增 / 修改 / 删除」开头的条目里的反引号路径,
 * 「<日期>」这类占位换成通配符。任务卡本身(如果在仓库里)总是允许改,要填「结果」。
 */
export function allowedFiles(cardText, cardPath) {
  const sec = cardText.split(/^## /m).find((s) => s.startsWith('允许修改的文件')) ?? '';
  const out = new Set(cardPath ? [cardPath] : []);
  for (const line of sec.split('\n')) {
    if (!/^- (新增|修改|删除)/.test(line.trim())) continue;
    for (const m of line.matchAll(/`([^`]+)`/g)) {
      const p = m[1].trim();
      if (/[\s(]/.test(p) || !/[/.]/.test(p)) continue; // 跳过函数签名、命令之类
      out.add(p.replace(/<[^>]+>/g, '*'));
    }
  }
  return [...out];
}

function vitestCounts(text) {
  const m = text.match(/Tests\s+(?:(\d+) failed \| )?(\d+) passed(?: \| \d+ \w+)* \((\d+)\)/);
  if (m) return { failed: Number(m[1] ?? 0), passed: Number(m[2]), total: Number(m[3]) };
  const f = text.match(/Tests\s+(\d+) failed \((\d+)\)/);
  return f ? { failed: Number(f[1]), passed: 0, total: Number(f[2]) } : null;
}

/** agent 输出(JSON 行或单个 JSON)里取最后一段回复和用量;两家格式不同,尽量宽松地找 */
function summarizeLog(text) {
  let last = '';
  let premium = null;
  let tokens = null;
  const visit = (o) => {
    if (!o || typeof o !== 'object') return;
    const content = o?.data?.content ?? o?.result ?? o?.response;
    if (typeof content === 'string' && content.trim()) last = content;
    if (o?.usage?.premiumRequests !== undefined) premium = (premium ?? 0) + o.usage.premiumRequests;
    const u = o?.usage ?? o?.stats;
    // 续跑时有多条结果,用量累加
    if (u && (u.inputTokens || u.input_tokens)) {
      tokens ??= { input: 0, output: 0 };
      tokens.input += u.inputTokens ?? u.input_tokens;
      tokens.output += (u.outputTokens ?? u.output_tokens ?? 0) + (u.thinking_tokens ?? 0);
    }
  };
  for (const line of text.split('\n')) {
    if (!line.trim().startsWith('{')) continue;
    try {
      visit(JSON.parse(line));
    } catch {
      /* 不是完整的一行 JSON */
    }
  }
  if (!last) {
    try {
      visit(JSON.parse(text.slice(text.indexOf('{'))));
    } catch {
      last = text.trim().slice(-1500);
    }
  }
  return { last: last.slice(-1500), premium, tokens };
}

// ---------------------------------------------------------------------------
// 额度:预检 / 事后复核 / 日志
// ---------------------------------------------------------------------------

/**
 * 从 agent 的输出里识别「额度用尽」:agy 的 RESOURCE_EXHAUSTED / 「quota reached ... Resets in 1h28m45s」,
 * 通用的 429 / rate limit。没有额度问题返回 null。
 */
export function parseQuotaError(text) {
  if (!/RESOURCE_EXHAUSTED|quota (?:reached|exceeded|exhausted)|rate.?limit|code 429|status 429/i.test(text)) return null;
  const m = /Resets? in ((?:\d+h)?(?:\d+m)?(?:\d+s)?)/i.exec(text);
  return { resetIn: m && m[1] ? m[1] : undefined };
}

/** Copilot:模型还没开通 */
export function parseModelUnavailable(text) {
  return /is not available|not available for your|unknown model/i.test(text);
}

const QUOTA_LOG = join(REPO, 'Archive', 'agent-runs', 'quota-log.jsonl');
const QUOTA_MD = join(REPO, 'Archive', 'agent-runs', 'quota.md');

/** 默认要查的 agent / 模型 */
const DEFAULT_PROBES = [
  { agent: 'antigravity', model: 'gemini-3.8-flash-high' },
  { agent: 'antigravity', model: 'claude-opus-4-6-thinking' },
  { agent: 'copilot', model: 'auto' },
];

function logQuota(entry) {
  mkdirSync(dirname(QUOTA_LOG), { recursive: true });
  const full = { time: new Date().toISOString(), ...entry };
  appendFileSync(QUOTA_LOG, JSON.stringify(full) + '\n');
  try {
    writeFileSync(QUOTA_MD, quotaSummary(readFileSync(QUOTA_LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))));
  } catch {
    /* 日志坏了不影响派活 */
  }
}

const STATE_TEXT = { ok: '可用', exhausted: '额度用尽', unavailable: '模型不可用', error: '出错' };
const PHASE_TEXT = { before: '开工前', after: '收工后', manual: '手动' };

/**
 * 额度日志 → Markdown:每个 agent / 模型最近一次状态,今天累计用掉的 token,以及最近的人工备注(App 里看到的百分比)。
 * entries 是 quota-log.jsonl 的各行,按时间顺序。
 */
export function quotaSummary(entries) {
  const latest = new Map();
  const today = new Map();
  let note = null;
  const day = (t) => new Date(t).toLocaleDateString('sv-SE');
  const local = (t) => new Date(t).toLocaleString('sv-SE').slice(0, 16);
  const nowDay = entries.length ? day(entries[entries.length - 1].time) : '';
  for (const e of entries) {
    if (e.phase === 'manual' && e.note) {
      note = e;
      continue;
    }
    const key = e.agent + ' / ' + (e.model ?? '默认');
    if (e.phase === 'run') {
      if (day(e.time) === nowDay) {
        const t = today.get(key) ?? { input: 0, output: 0, premium: 0, jobs: 0 };
        t.input += e.tokens?.input ?? 0;
        t.output += e.tokens?.output ?? 0;
        t.premium += e.premium ?? 0;
        t.jobs += 1;
        today.set(key, t);
      }
      continue;
    }
    latest.set(key, e);
  }
  const lines = ['# 额度日志(自动生成,本机,不进 git)', '', '命令行只能知道「可用 / 已用尽(及重置时间)」和我们自己跑掉的 token,剩余百分比要看应用。', ''];
  lines.push('## 各模型最近一次检查', '', '| 模型 | 时间 | 阶段 | 状态 | 重置 |', '|---|---|---|---|---|');
  for (const [key, e] of latest) {
    const state = (STATE_TEXT[e.status] ?? e.status) + (e.error ? '(' + e.error + ')' : '');
    lines.push('| ' + key + ' | ' + local(e.time) + ' | ' + (PHASE_TEXT[e.phase] ?? e.phase) + ' | ' + state + ' | ' + (e.resetIn ?? '—') + ' |');
  }
  lines.push('', '## 今天我们派活用掉的量', '', '| 模型 | 作业数 | 输入 token | 输出 token | 高级请求 |', '|---|---|---|---|---|');
  for (const [key, t] of today) lines.push('| ' + key + ' | ' + t.jobs + ' | ' + t.input + ' | ' + t.output + ' | ' + (t.premium || '—') + ' |');
  if (!today.size) lines.push('| (今天还没派活) | | | | |');
  if (note) lines.push('', '## 最近一次人工备注', '', local(note.time) + ':' + note.note);
  return lines.join('\n') + '\n';
}

/** 发一句极短的提示,看这个 agent / 模型现在能不能用;额度用尽时顺便拿到重置时间 */
async function probe(agent, model) {
  const job = { id: 'probe', agent, model };
  const [cmd, args] = AGENTS[agent].command(job, '只回复两个字:好的', 'scoped', REPO);
  const { code, log } = await runOnce(cmd, args, REPO, 150_000);
  const quota = parseQuotaError(log);
  if (quota) return { status: 'exhausted', resetIn: quota.resetIn };
  if (parseModelUnavailable(log)) return { status: 'unavailable' };
  if (code !== 0) return { status: 'error', error: '退出码 ' + code };
  return { status: 'ok' };
}

/** 逐个预检 / 复核,记进日志并打印;返回 { 'agent|model' → 结果 } */
async function checkPairs(pairs, phase) {
  const out = new Map();
  for (const { agent, model } of pairs) {
    const r = await probe(agent, model);
    logQuota({ phase, agent, model, ...r });
    out.set(agent + '|' + (model ?? ''), r);
    const tag = phase === 'before' ? '预检' : phase === 'after' ? '复核' : '额度';
    console.log('[' + tag + '] ' + agent + ' / ' + (model ?? '默认') + ':' + STATE_TEXT[r.status] + (r.resetIn ? '(约 ' + r.resetIn + ' 后重置)' : '') + (r.error ? '(' + r.error + ')' : ''));
  }
  return out;
}

// ---------------------------------------------------------------------------
// 派发
// ---------------------------------------------------------------------------

function promptFor(job, cardText, allowed) {
  return [
    `你是 Web Tank 仓库的执行者 agent(${job.agent} / ${job.model ?? '默认模型'})。当前目录是一个独立的 git worktree,分支 ${job.branch} 已经建好、依赖已经装好。`,
    '',
    '规则:',
    '1. 先读 AGENTS.md,再读下面的任务卡,只做卡上写的事。卡里「开工」一节(建 worktree、npm ci、开 dev server)已经由调度脚本做完,跳过;卡里要求推送或开 PR 的步骤**不要做**,由主程审查后统一处理。',
    `2. 只改这些文件:${allowed.join('、')}。不加依赖、不改 package.json、不要重装依赖。`,
    '3. 写完运行 npm run lint、npm test、npm run build,确认全部通过。**不要 git add / commit / push**:你结束后调度脚本会把工作区的改动统一提交。',
    `   能用的命令只有:${ALLOWED_COMMANDS}(命令要原样输入,不要加文件名之类的参数)。其他命令会被自动拒绝,不要尝试;读文件、搜索代码、改文件用你自带的工具。`,
    '4. 如果任务卡在仓库里,在卡末尾的「结果」一节如实填写:改了哪些文件、跑了哪些命令和结果、没做完或拿不准的地方。做不完时也照实写清楚。',
    '5. 不要在工作区里留下临时文件(草稿脚本、日志等),它们会被一起提交、算作越界。',
    '6. 最后一条回复只写三行:状态(完成 / 部分完成 / 失败)、改了哪些文件、一句话说明。',
    '',
    `任务卡(${job.card})全文:`,
    '',
    cardText,
  ].join('\n');
}

function prepare(job, base, dry) {
  if (existsSync(join(job.wt, '.git'))) return `已存在 ${job.wt}`;
  if (dry) return `将新建 worktree ${job.wt}(${job.branch} ← ${base})并 npm ci`;
  // 父目录是盘符根目录(如 D:\)时 mkdirSync 会报 EPERM,已存在就不建
  if (!existsSync(dirname(job.wt))) mkdirSync(dirname(job.wt), { recursive: true });
  const r = git(REPO, 'worktree', 'add', job.wt, '-b', job.branch, base);
  if (r.code !== 0) throw new Error(`git worktree add 失败:${r.out}`);
  const ci = npm(job.wt, 'ci', '--no-audit', '--no-fund');
  if (ci.code !== 0) throw new Error(`npm ci 失败:${ci.out.slice(-800)}`);
  return `新建 ${job.wt}`;
}

function runOnce(cmd, args, cwd, timeoutMs) {
  return new Promise((done) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', (d) => (log += d));
    child.stderr.on('data', (d) => (log += d));
    const timer = setTimeout(() => {
      log += '\n[dispatch] 超时,强制结束\n';
      child.kill();
    }, Math.max(1000, timeoutMs));
    child.on('error', (e) => (log += `\n[dispatch] 启动失败:${e.message}\n`));
    child.on('close', (code) => {
      clearTimeout(timer);
      done({ code, log });
    });
  });
}

/** agy 的最终结果行:{"conversation_id":…,"denied_actions":[…]} */
function agyResult(log) {
  const line = log.split('\n').reverse().find((l) => l.trim().startsWith('{"conversation_id"'));
  try {
    return line ? JSON.parse(line) : null;
  } catch {
    return null;
  }
}

const RESUME_PROMPT = `上一步有命令被自动拒绝,这一轮因此中断了。能用的命令只有:${ALLOWED_COMMANDS}(原样输入,不加参数)。不要再用被拒绝的命令,换成上面这些或你自带的读写文件工具,接着把任务做完。不要 git add / commit。`;

/** agent 结束后把工作区的全部改动提交成一个提交(提交信息取作业里的 commit,否则用默认值) */
function commitAll(job) {
  if (!git(job.wt, 'status', '--porcelain').out.trim()) return '没有改动';
  git(job.wt, 'add', '-A');
  const r = git(job.wt, 'commit', '-q', '-m', job.commit ?? `feat: ${job.id}(${job.agent} / ${job.model ?? '默认模型'})`);
  return r.code === 0 ? '已提交' : `提交失败:${r.out.slice(-300)}`;
}

/**
 * 启动 agent。agy 在无人值守模式下只要有一条命令被拒,这一轮就结束;
 * 这时用同一个会话续跑(最多 maxResume 次),提醒它只用放行的命令。
 */
async function launch(job, prompt, perm, logFile, timeoutMin, maxResume = 3) {
  const t0 = Date.now();
  const deadline = t0 + timeoutMin * 60_000;
  const [cmd, args] = AGENTS[job.agent].command(job, prompt, perm, job.wt);
  let { code, log } = await runOnce(cmd, args, job.wt, deadline - Date.now());
  let resumes = 0;
  for (let r = agyResult(log); job.agent === 'antigravity' && r?.denied_actions?.length && resumes < maxResume && Date.now() < deadline && !parseQuotaError(log); r = agyResult(log)) {
    resumes++;
    log += `\n[dispatch] 有命令被拒(${r.denied_actions.map((d) => d.display_name ?? d.action).join('、')}),第 ${resumes} 次续跑\n`;
    const [c2, a2] = AGENTS.antigravity.command(job, RESUME_PROMPT, perm, job.wt);
    const next = await runOnce(c2, [...a2, '--conversation', r.conversation_id], job.wt, deadline - Date.now());
    code = next.code;
    log += next.log;
  }
  writeFileSync(logFile, log);
  return { code, minutes: (Date.now() - t0) / 60_000, log, resumes, quota: parseQuotaError(log) };
}

// ---------------------------------------------------------------------------
// 评分(只读检查 + 跑 lint / test / build;隐藏测试临时拷进去,跑完删掉)
// ---------------------------------------------------------------------------

function grade(job, base, allowed) {
  const wt = job.wt;
  const g = {};
  if (!existsSync(join(wt, '.git'))) return { error: 'worktree 不存在' };
  const baseSha = git(wt, 'merge-base', base, 'HEAD').out.trim();
  const committed = git(wt, 'diff', '--name-only', `${baseSha}..HEAD`).out.split('\n').filter(Boolean);
  const dirty = git(wt, 'status', '--porcelain', '-uall').out.split('\n').filter(Boolean).map((l) => l.slice(3));
  const res = allowed.map(globToRegExp);
  g.changed = [...new Set([...committed, ...dirty])];
  g.uncommitted = dirty;
  g.outOfScope = g.changed.filter((f) => !res.some((re) => re.test(f)));
  g.commits = git(wt, 'log', '--format=%s', `${baseSha}..HEAD`).out.split('\n').filter(Boolean);
  g.pushed = git(wt, 'ls-remote', '--heads', 'origin', job.branch).out.trim() !== '';
  const addedTsLines = git(wt, 'diff', '-U0', baseSha, '--', '*.ts').out.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
  g.anyCasts = addedTsLines.filter((l) => /(:\s*any\b|as any\b|<any>)/.test(l)).length;
  g.numstat = sumNumstat(git(wt, 'diff', '--numstat', baseSha).out);
  const card = join(wt, job.card);
  if (existsSync(card)) {
    const result = readFileSync(card, 'utf8').split(/^## 结果/m)[1] ?? '';
    // 内容可以写在同一行,也可以写在下一行的子条目里
    g.resultFilled = /改动文件[::]\s*\S/.test(result) && /命令与结果[::]\s*\S/.test(result);
  }
  g.changelog = g.changed.some((f) => f.startsWith('changelog.d/') && f.endsWith('.md'));
  g.lint = npm(wt, 'run', 'lint').code === 0;
  const test = npm(wt, 'test');
  g.tests = vitestCounts(test.out);
  g.testsPass = test.code === 0;
  g.build = npm(wt, 'run', 'build').code === 0;
  if (job.hidden?.length) {
    const dir = join(wt, 'tests', '__hidden__');
    mkdirSync(dir, { recursive: true });
    // 隐藏测试在仓库里存成 *.hidden.ts(Vitest 不会收集),拷进去时改回 *.test.ts
    for (const h of job.hidden) copyFileSync(join(REPO, h), join(dir, basename(h).replace(/\.hidden\.ts$/, '.test.ts')));
    const r = sh(process.execPath, [join(wt, 'node_modules', 'vitest', 'vitest.mjs'), 'run', 'tests/__hidden__'], wt);
    g.hidden = vitestCounts(r.out) ?? { failed: -1, passed: 0, total: 0 };
    g.hiddenLog = r.out.split('\n').filter((l) => /✓|×|FAIL|Error|expected/.test(l)).slice(0, 30).join('\n');
    rmSync(dir, { recursive: true, force: true });
  }
  return g;
}

/** 机器分(满分 90):隐藏测试 40、守规则 20、自测 20、交付 10;代码质量和外观由主程另评 */
function score(g) {
  if (g.error) return 0;
  let s = 0;
  if (g.hidden) s += g.hidden.total ? (40 * g.hidden.passed) / g.hidden.total : 0;
  else s += g.testsPass ? 40 : 0;
  s += g.outOfScope.length === 0 ? 10 : 0;
  s += !g.pushed ? 5 : 0;
  s += g.anyCasts === 0 ? 5 : 0;
  s += (g.lint ? 7 : 0) + (g.testsPass ? 7 : 0) + (g.build ? 6 : 0);
  // 任务卡不在仓库里(模型测试题)时没有「结果」和日志的要求,这一项不计,满分按 80
  if (g.resultFilled !== undefined) s += (g.resultFilled ? 6 : 0) + (g.changelog ? 4 : 0);
  return Math.round(s);
}

function report(rows, file) {
  const yes = (b) => (b === undefined ? '—' : b ? '✓' : '✗');
  const lines = [
    `# 调度报告(${new Date().toLocaleString('zh-CN')})`,
    '',
    '| 任务 | agent / 模型 | 用时 | 退出码 | 用量 | 越界文件 | 改动 | lint / test / build | 测试 | 隐藏测试 | 结果 / 日志 | 机器分 |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of rows) {
    const g = r.grade;
    if (g.error) {
      lines.push(`| ${r.id} | ${r.agent} / ${r.model} | — | — | — | — | — | — | — | — | — | ${g.error} |`);
      continue;
    }
    const t = g.tests ? `${g.tests.passed}/${g.tests.total}` : '—';
    const h = g.hidden ? `${g.hidden.passed}/${g.hidden.total}` : '—';
    const quota = r.premium != null ? `${r.premium} 次` : r.tokens ? `${r.tokens.input}/${r.tokens.output} tok` : '—';
    const commits = `${g.numstat.files} 个文件 +${g.numstat.added} −${g.numstat.deleted} 行${g.uncommitted.length ? `,${g.uncommitted.length} 个未提交` : ''}${g.pushed ? ',**已 push**' : ''}`;
    lines.push(
      `| ${r.id} | ${r.agent} / ${r.model} | ${r.minutes?.toFixed(1) ?? '—'} 分${r.resumes ? `(续跑 ${r.resumes} 次)` : ''} | ${r.code ?? '—'} | ${quota} | ${g.outOfScope.length ? g.outOfScope.join('<br>') : '无'} | ${commits} | ${yes(g.lint)} ${yes(g.testsPass)} ${yes(g.build)} | ${t} | ${h} | ${yes(g.resultFilled)} ${yes(g.changelog)} | ${score(g)} / ${g.resultFilled === undefined ? 80 : 90} |`,
    );
  }
  lines.push('', '机器分只看能自动检查的项(隐藏测试 40、守规则 20、自测 20、交付 10,满分 90),代码质量和外观由主程审查后另评。', '');
  for (const r of rows) {
    lines.push(`## ${r.id}(${r.agent} / ${r.model})`, '');
    if (r.grade.anyCasts) lines.push(`- 新增代码里有 ${r.grade.anyCasts} 处 \`any\``);
    if (r.grade.hiddenLog) lines.push('- 隐藏测试:', '', '```text', r.grade.hiddenLog, '```');
    if (r.last) lines.push('- agent 最后的回复:', '', '```text', r.last, '```');
    lines.push('');
  }
  writeFileSync(file, lines.join('\n'));
}

// ---------------------------------------------------------------------------

async function main() {
  const [cmd, jobFile, ...rest] = process.argv.slice(2);
  if (cmd === 'quota') {
    const args = jobFile?.startsWith('--') ? [jobFile, ...rest] : rest;
    const file = jobFile && !jobFile.startsWith('--') ? jobFile : null;
    const noteAt = args.indexOf('--note');
    if (noteAt >= 0 && args[noteAt + 1]) logQuota({ phase: 'manual', agent: '—', note: args[noteAt + 1] });
    const pairs = file
      ? [...new Map(JSON.parse(readFileSync(resolve(file), 'utf8')).jobs.map((j) => [j.agent + '|' + (j.model ?? ''), { agent: j.agent, model: j.model }])).values()]
      : DEFAULT_PROBES.filter((p) => AGENTS[p.agent].check());
    await checkPairs(pairs, 'manual');
    console.log('\n额度日志:' + QUOTA_MD);
    return;
  }
  if (!['run', 'grade'].includes(cmd ?? '') || !jobFile) {
    console.log('用法:node scripts/agents/dispatch.mjs run|grade <作业文件.json> [--only id1,id2] [--dry-run] [--no-preflight] [--skip-unavailable]\n      node scripts/agents/dispatch.mjs quota [作业文件.json] [--note "App 里看到的额度"]');
    process.exit(1);
  }
  const only = rest.includes('--only') ? rest[rest.indexOf('--only') + 1].split(',') : null;
  const dry = rest.includes('--dry-run');
  const spec = JSON.parse(readFileSync(resolve(jobFile), 'utf8'));
  const base = spec.base ?? 'origin/main';
  const perm = spec.permissions ?? 'scoped';
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const outDir = join(REPO, 'Archive', 'agent-runs', `${spec.name ?? 'run'}-${cmd}-${stamp}`);
  mkdirSync(outDir, { recursive: true });
  if (cmd === 'run' && !dry) git(REPO, 'fetch', '--quiet', 'origin');

  let jobs = spec.jobs
    .filter((j) => !only || only.includes(j.id))
    .map((j) => ({ ...j, branch: j.branch ?? `agent/${j.id}`, wt: resolve(REPO, '.worktrees', j.worktree ?? j.id) }));
  for (const j of jobs) {
    if (!AGENTS[j.agent]) throw new Error(`${j.id}:未知 agent「${j.agent}」(可选 ${Object.keys(AGENTS).join(' / ')})`);
    if (cmd === 'run' && !AGENTS[j.agent].check()) throw new Error(`${j.id}:找不到 ${j.agent} 的命令行`);
  }

  // 开工前预检:用到的每个 agent / 模型各发一句极短的提示,额度用尽或模型不可用就别开工(写到一半被停最亏)
  const pairs = [...new Map(jobs.map((j) => [j.agent + '|' + (j.model ?? ''), { agent: j.agent, model: j.model }])).values()];
  if (cmd === 'run' && !dry && !rest.includes('--no-preflight')) {
    const status = await checkPairs(pairs, 'before');
    const bad = jobs.filter((j) => status.get(j.agent + '|' + (j.model ?? ''))?.status !== 'ok');
    if (bad.length) {
      if (!rest.includes('--skip-unavailable')) {
        console.error('\n预检没过,这批作业不开工(' + bad.map((j) => j.id).join('、') + ')。额度恢复后重来,或改派别的模型,或加 --skip-unavailable 只跑能跑的、--no-preflight 强行开工。');
        process.exit(2);
      }
      console.log('[预检] 略过:' + bad.map((j) => j.id).join('、'));
      jobs = jobs.filter((j) => !bad.includes(j));
    }
  }

  // 同一种 agent 同时最多跑 maxPerAgent 个,不同 agent 之间并行;建 worktree 一个一个来
  const limit = spec.maxPerAgent ?? 2;
  const running = new Map();
  let gitLock = Promise.resolve();
  const rows = [];
  await Promise.all(
    jobs.map(async (job) => {
      const cardText = readFileSync(join(REPO, job.card), 'utf8');
      const allowed = job.allow ?? allowedFiles(cardText, existsSync(join(REPO, job.card)) && !job.card.startsWith('scripts/') ? job.card : null);
      const row = { id: job.id, agent: job.agent, model: job.model ?? '默认' };
      if (cmd === 'run') {
        while ((running.get(job.agent) ?? 0) >= limit) await new Promise((r) => setTimeout(r, 2000));
        running.set(job.agent, (running.get(job.agent) ?? 0) + 1);
        try {
          const ready = gitLock.then(() => prepare(job, job.base ?? base, dry));
          gitLock = ready.catch(() => undefined);
          console.log(`[${job.id}] ${await ready}`);
          const prompt = promptFor(job, cardText, allowed);
          writeFileSync(join(outDir, `${job.id}.prompt.txt`), prompt);
          if (dry) {
            const [c, a] = AGENTS[job.agent].command(job, '<提示词>', perm, job.wt);
            console.log(`[${job.id}] 允许改:${allowed.join('、')}\n[${job.id}] 将运行:${basename(c)} ${a.map((x) => (/\s/.test(x) ? JSON.stringify(x) : x)).join(' ')}`);
            return;
          }
          console.log(`[${job.id}] 启动 ${job.agent} / ${row.model}`);
          const r = await launch(job, prompt, perm, join(outDir, `${job.id}.log`), job.timeoutMin ?? spec.timeoutMin ?? 60);
          Object.assign(row, { code: r.code, minutes: r.minutes, resumes: r.resumes }, summarizeLog(r.log));
          logQuota({ phase: 'run', agent: job.agent, model: job.model, job: job.id, tokens: row.tokens ?? undefined, premium: row.premium ?? undefined, minutes: Math.round(r.minutes * 10) / 10, quotaHit: r.quota ? (r.quota.resetIn ?? true) : undefined });
          if (r.quota) {
            row.last = '⚠ 跑到一半额度用尽(约 ' + (r.quota.resetIn ?? '?') + ' 后重置)。\n' + (row.last ?? '');
            console.log('[' + job.id + '] ⚠ 额度用尽(约 ' + (r.quota.resetIn ?? '?') + ' 后重置),已完成的部分照常评分');
          }
          console.log(`[${job.id}] 结束(退出码 ${r.code},${r.minutes.toFixed(1)} 分钟),${commitAll(job)},开始评分`);
        } catch (e) {
          row.grade = { error: e instanceof Error ? e.message : String(e) };
          rows.push(row);
          return;
        } finally {
          running.set(job.agent, (running.get(job.agent) ?? 1) - 1);
        }
      }
      row.grade = grade(job, job.base ?? base, allowed);
      console.log(`[${job.id}] 评分完成`);
      rows.push(row);
    }),
  );
  if (dry) return console.log('\n提示词已写到 ' + outDir);
  // 收工后再查一次,方便下次开工前对照
  if (cmd === 'run' && !rest.includes('--no-preflight')) {
    console.log('');
    await checkPairs(pairs, 'after');
    console.log('额度日志:' + QUOTA_MD);
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  const file = join(outDir, 'report.md');
  report(rows, file);
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(rows, null, 2));
  console.log(`\n报告:${file}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
