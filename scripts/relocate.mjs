#!/usr/bin/env node
/**
 * 仓库搬迁与目录整理脚本:
 * 把仓库从旧根目录(如 D:\Main)迁移到新目录(默认 D:\Web Tank),
 * 清理往期已合并的 worktree 和本地分支,整理归档文件。
 *
 * 用法:
 *   node scripts/relocate.mjs [--to "D:\Web Tank"] [--apply]
 *
 * 规则:
 *   不加 --apply 时只打印执行计划,不修改、不删除任何东西;
 *   加 --apply 才实际执行清理、复制、归档和验证。
 *   无 --force、-D、rm -rf 等强制操作。
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readlinkSync, renameSync, rmdirSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const IS_WIN = process.platform === 'win32';

// ---------------------------------------------------------------------------
// 小工具与命令行调用
// ---------------------------------------------------------------------------

function sh(cmd, args, cwd, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    shell: opts.shell ?? false,
    timeout: opts.timeout ?? 15 * 60_000,
    maxBuffer: 64 << 20,
  });
  return { code: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

const git = (cwd, ...args) => sh('git', args, cwd);
const npm = (cwd, ...args) => sh(IS_WIN ? 'npm.cmd' : 'npm', args, cwd, { shell: IS_WIN });

function isDriveRoot(dir) {
  const resolved = resolve(dir);
  return dirname(resolved) === resolved;
}

// ---------------------------------------------------------------------------
// 导出的纯函数(判断逻辑与参数解析,供测试和直接调用)
// ---------------------------------------------------------------------------

/**
 * 解析命令行参数:
 * --to <path> 指定目标目录,默认 "D:\Web Tank"
 * --apply 实际执行模式
 */
export function parseArgs(argv) {
  let toPath = 'D:\\Web Tank';
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') {
      apply = true;
    } else if (arg === '--to' && i + 1 < argv.length) {
      toPath = argv[++i];
    } else if (arg.startsWith('--to=')) {
      toPath = arg.slice('--to='.length);
    }
  }
  return { toPath, apply };
}

/**
 * 解析 git worktree list --porcelain 输出
 */
export function parsePorcelainWorktrees(output) {
  const lines = output.split('\n');
  const list = [];
  let current = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('worktree ')) {
      if (current) list.push(current);
      current = {
        path: trimmed.slice('worktree '.length).trim(),
        head: null,
        branch: null,
        bare: false,
        detached: false,
      };
    } else if (trimmed.startsWith('HEAD ')) {
      if (current) current.head = trimmed.slice('HEAD '.length).trim();
    } else if (trimmed.startsWith('branch ')) {
      if (current) current.branch = trimmed.slice('branch '.length).trim().replace(/^refs\/heads\//, '');
    } else if (trimmed === 'bare') {
      if (current) current.bare = true;
    } else if (trimmed === 'detached') {
      if (current) current.detached = true;
    }
  }
  if (current) list.push(current);
  return list;
}

/**
 * 判定单个 worktree 是否可以安全清理。
 * 规则:
 * 1. 工作区必须干净(git status --porcelain 为空);
 * 2. 分支已合并进 origin/main,或者分支属于保留分支(bench/*、local/*)。
 */
export function canRemoveWorktree({ branch, statusOutput, isMergedIntoOriginMain }) {
  if (statusOutput && statusOutput.trim() !== '') {
    return { canRemove: false, reason: '工作区不干净(有未提交或未跟踪的改动)' };
  }
  const cleanBranch = branch ? branch.replace(/^refs\/heads\//, '') : '';
  const isPreserved = cleanBranch.startsWith('bench/') || cleanBranch.startsWith('local/');
  if (isPreserved || isMergedIntoOriginMain) {
    return { canRemove: true };
  }
  return { canRemove: false, reason: `分支 ${cleanBranch || '(分离头指针)'} 尚未合并进 origin/main` };
}

/**
 * 判定单个本地分支是否可以删除。
 * 规则:
 * 1. 只有 task/* 和 docs/* 分支允许清理;
 * 2. 必须已合并进 origin/main;
 * 3. main、bench/*、local/* 及其他分支不动。
 */
export function canDeleteBranch(branchName, isMergedIntoOriginMain) {
  const clean = branchName.replace(/^refs\/heads\//, '');
  if (clean === 'main') {
    return { canDelete: false, reason: '主分支保留' };
  }
  if (clean.startsWith('bench/') || clean.startsWith('local/')) {
    return { canDelete: false, reason: '本地/测试分支保留' };
  }
  if (!clean.startsWith('task/') && !clean.startsWith('docs/')) {
    return { canDelete: false, reason: '非 task/* 或 docs/* 分支保留' };
  }
  if (!isMergedIntoOriginMain) {
    return { canDelete: false, reason: '尚未合并进 origin/main' };
  }
  return { canDelete: true };
}

/**
 * 判定文件或目录在复制到新仓库时是否应该跳过。
 * 跳过:node_modules、dist、.vite、Claude outputs、.worktrees、Archive 等生成物和归档目录。
 * .git、.claude 照常复制。
 */
export function shouldSkipCopy(name, relPath = '') {
  const norm = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const topDir = norm.split('/')[0] || name;
  const SKIP_NAMES = new Set(['node_modules', 'dist', '.vite', 'Claude outputs', '.worktrees', 'Archive']);
  if (SKIP_NAMES.has(topDir) || SKIP_NAMES.has(name)) {
    return true;
  }
  return false;
}

/**
 * 递归复制目录,自动跳过 shouldSkipCopy 命中的项目
 */
export function copyDirectory(srcDir, destDir, rel = '') {
  mkdirSync(destDir, { recursive: true });
  const entries = readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (shouldSkipCopy(entry.name, entryRel)) {
      continue;
    }
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath, entryRel);
    } else if (entry.isSymbolicLink()) {
      try {
        const linkTarget = readlinkSync(srcPath);
        symlinkSync(linkTarget, destPath);
      } catch {
        // Windows 上普通用户权限无法创建符号链接时回退到复制文件
        copyFileSync(srcPath, destPath);
      }
    } else if (entry.isFile()) {
      copyFileSync(srcPath, destPath);
    }
  }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

export async function main() {
  const { toPath, apply } = parseArgs(process.argv.slice(2));
  const targetResolved = resolve(toPath);

  console.log('='.repeat(70));
  console.log(`Web Tank 仓库搬家脚本 ${apply ? '【执行模式 --apply】' : '【空跑模式 (只打印计划)】'}`);
  console.log(`目标路径: ${targetResolved}`);
  console.log('='.repeat(70));

  // 1. 前置检查
  console.log('\n[1/7] 进行前置检查...');
  const repoRoot = git(process.cwd(), 'rev-parse', '--show-toplevel').out.trim();
  if (!repoRoot || resolve(process.cwd()) !== resolve(repoRoot)) {
    throw new Error(`请在旧仓库根目录运行本脚本 (当前工作目录: ${process.cwd()})`);
  }

  const currentBranch = git(repoRoot, 'branch', '--show-current').out.trim();
  if (currentBranch !== 'main') {
    throw new Error(`当前分支为 ${currentBranch || '(分离头指针)'},必须在 main 分支运行`);
  }

  console.log('  - 检查与远程 origin/main 的同步状态...');
  const fetchRes = git(repoRoot, 'fetch', 'origin');
  if (fetchRes.code !== 0) {
    throw new Error(`git fetch origin 失败: ${fetchRes.out.trim()}`);
  }
  const mainSha = git(repoRoot, 'rev-parse', 'main').out.trim();
  const originMainSha = git(repoRoot, 'rev-parse', 'origin/main').out.trim();
  if (mainSha !== originMainSha) {
    throw new Error(`本地 main 分支 (${mainSha}) 与 origin/main (${originMainSha}) 不一致,请先同步`);
  }

  console.log('  - 检查工作区干净度...');
  const statusRes = git(repoRoot, 'status', '--porcelain').out;
  const statusLines = statusRes.split('\n').map((l) => l.trimEnd()).filter(Boolean);
  const dirtyLines = statusLines.filter((line) => {
    const rest = line.slice(3).trim();
    return !(line.startsWith('?? ') && (rest === '.claude/' || rest.startsWith('.claude/') || rest.startsWith('.claude\\')));
  });
  if (dirtyLines.length > 0) {
    throw new Error(`工作区不干净,只允许未跟踪的 .claude/:\n${dirtyLines.map((l) => `    ${l}`).join('\n')}`);
  }

  console.log('  - 检查目标目录...');
  if (targetResolved === resolve(repoRoot)) {
    throw new Error(`目标目录不能是当前仓库自身: ${targetResolved}`);
  }
  if (existsSync(targetResolved)) {
    const existing = readdirSync(targetResolved);
    if (existing.length > 0) {
      throw new Error(`目标目录 ${targetResolved} 已存在且不为空 (包含 ${existing.length} 个项目)`);
    }
  }
  console.log('  前置检查全部通过。');

  // 2. 清理 worktree
  console.log('\n[2/7] 检查关联 worktree...');
  const wtListOut = git(repoRoot, 'worktree', 'list', '--porcelain').out;
  const allWorktrees = parsePorcelainWorktrees(wtListOut);
  const linkedWorktrees = allWorktrees.slice(1);

  const blockedWorktrees = [];
  for (const wt of linkedWorktrees) {
    let wtStatus = '';
    if (existsSync(wt.path)) {
      wtStatus = git(wt.path, 'status', '--porcelain').out;
    }
    let isMerged = false;
    if (wt.branch) {
      isMerged = git(repoRoot, 'merge-base', '--is-ancestor', wt.branch, 'origin/main').code === 0;
    } else if (wt.head) {
      isMerged = git(repoRoot, 'merge-base', '--is-ancestor', wt.head, 'origin/main').code === 0;
    }
    const check = canRemoveWorktree({
      branch: wt.branch,
      statusOutput: wtStatus,
      isMergedIntoOriginMain: isMerged,
    });
    if (!check.canRemove) {
      blockedWorktrees.push({ ...wt, reason: check.reason });
    }
  }

  if (blockedWorktrees.length > 0) {
    console.error(`\n发现 ${blockedWorktrees.length} 个 worktree 无法清理,搬迁终止:`);
    for (const b of blockedWorktrees) {
      console.error(`  - 路径: ${b.path}`);
      console.error(`    分支: ${b.branch ?? '(分离头指针)'}`);
      console.error(`    原因: ${b.reason}`);
    }
    throw new Error('存在被拦截的 worktree,请先确认并处理');
  }

  if (linkedWorktrees.length === 0) {
    console.log('  无多余的关联 worktree 需要清理。');
  } else if (!apply) {
    console.log(`  [计划] 将清理以下 ${linkedWorktrees.length} 个 worktree (使用 git worktree remove,不加 --force):`);
    for (const wt of linkedWorktrees) {
      console.log(`    - ${wt.path} (分支: ${wt.branch ?? 'detached'})`);
    }
    console.log('    - 将执行 git worktree prune');
    console.log('    - 将检查并清理因删除 worktree 变空的父目录(如 D:\\Main-bench)');
  } else {
    console.log(`  开始清理 ${linkedWorktrees.length} 个 worktree...`);
    for (const wt of linkedWorktrees) {
      console.log(`    - 删除 worktree: ${wt.path}`);
      const rmRes = git(repoRoot, 'worktree', 'remove', wt.path);
      if (rmRes.code !== 0) {
        throw new Error(`删除 worktree ${wt.path} 失败: ${rmRes.out}`);
      }
    }
    console.log('    - 执行 git worktree prune');
    git(repoRoot, 'worktree', 'prune');

    const candidateParents = new Set(linkedWorktrees.map((w) => resolve(dirname(w.path))));
    for (const parent of candidateParents) {
      if (parent === resolve(repoRoot) || parent === resolve(repoRoot, '..') || isDriveRoot(parent)) {
        continue;
      }
      if (existsSync(parent)) {
        const items = readdirSync(parent);
        if (items.length === 0) {
          console.log(`    - 清理空父目录: ${parent}`);
          rmdirSync(parent);
        }
      }
    }
  }

  // 3. 清理已合并的本地分支
  console.log('\n[3/7] 检查已合并的本地分支...');
  const branchListOut = git(repoRoot, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/').out;
  const localBranches = branchListOut.split('\n').map((b) => b.trim()).filter(Boolean);
  const branchesToDelete = [];
  for (const b of localBranches) {
    const isMerged = git(repoRoot, 'merge-base', '--is-ancestor', b, 'origin/main').code === 0;
    const canDel = canDeleteBranch(b, isMerged);
    if (canDel.canDelete) {
      branchesToDelete.push(b);
    }
  }

  if (branchesToDelete.length === 0) {
    console.log('  无可清理的本地 task/* 或 docs/* 分支。');
  } else if (!apply) {
    console.log(`  [计划] 将使用 git branch -d 删除以下 ${branchesToDelete.length} 个已合并分支:`);
    for (const b of branchesToDelete) {
      console.log(`    - ${b}`);
    }
    console.log('    (main、bench/*、local/* 分支均保留)');
  } else {
    console.log(`  开始删除 ${branchesToDelete.length} 个已合并本地分支 (使用 git branch -d)...`);
    for (const b of branchesToDelete) {
      console.log(`    - 删除分支: ${b}`);
      const delRes = git(repoRoot, 'branch', '-d', b);
      if (delRes.code !== 0) {
        console.warn(`    警告: 删除分支 ${b} 失败: ${delRes.out.trim()}`);
      }
    }
  }

  // 4. 复制仓库
  console.log('\n[4/7] 仓库文件复制计划...');
  if (!apply) {
    console.log(`  [计划] 将从 ${repoRoot} 复制到 ${targetResolved}`);
    console.log('    - 跳过: node_modules、dist、.vite、Claude outputs、.worktrees、Archive');
    console.log('    - 照常复制: .git、.claude 以及所有项目源码和配置');
  } else {
    console.log(`  正在复制仓库到 ${targetResolved}...`);
    copyDirectory(repoRoot, targetResolved);
    console.log('  仓库主体复制完成。');
  }

  // 5. 归档
  console.log('\n[5/7] 检查归档内容...');
  const srcClaudeOutputs = join(repoRoot, 'Claude outputs');
  const destClaudeOutputs = join(targetResolved, 'Archive', 'claude-outputs');
  const srcAgentRuns = resolve(repoRoot, '..', 'agent-runs');
  const destAgentRuns = join(targetResolved, 'Archive', 'agent-runs');

  const hasClaudeOutputs = existsSync(srcClaudeOutputs);
  const hasAgentRuns = existsSync(srcAgentRuns);

  if (!apply) {
    console.log('  [计划] 归档安排:');
    if (hasClaudeOutputs) {
      console.log(`    - 复制 Claude outputs\\ -> ${destClaudeOutputs}`);
    } else {
      console.log('    - 未发现 Claude outputs\\, 跳过');
    }
    if (hasAgentRuns) {
      console.log(`    - 移动 ${srcAgentRuns}\\ -> ${destAgentRuns}`);
    } else {
      console.log('    - 未发现 agent-runs\\, 跳过');
    }
  } else {
    mkdirSync(join(targetResolved, 'Archive'), { recursive: true });
    if (hasClaudeOutputs) {
      console.log(`  复制 Claude outputs\\ 到 ${destClaudeOutputs}...`);
      copyDirectory(srcClaudeOutputs, destClaudeOutputs);
    } else {
      console.log('  未发现 Claude outputs\\, 跳过');
    }
    if (hasAgentRuns) {
      console.log(`  移动 ${srcAgentRuns}\\ 到 ${destAgentRuns}...`);
      try {
        renameSync(srcAgentRuns, destAgentRuns);
      } catch (e) {
        // 不做「复制后递归删除」的后备方案(卡片要求不出现强制删除);同盘移动失败多半是有程序占用,停下让负责人处理
        throw new Error(`移动 ${srcAgentRuns} 失败(${e instanceof Error ? e.message : e}),请关闭占用它的程序后手动移动到 ${destAgentRuns}`);
      }
    } else {
      console.log('  未发现 agent-runs\\, 跳过');
    }
    console.log('  归档完成。');
  }

  // 6. 验证新目录
  console.log('\n[6/7] 新目录验证计划...');
  if (!apply) {
    console.log(`  [计划] 将在 ${targetResolved} 中依次执行:`);
    console.log('    - npm ci');
    console.log('    - npm run lint');
    console.log('    - npm test');
    console.log('    - 确认 git status 只有未跟踪的 .claude/');
    console.log('    - 确认 git worktree list 只有主仓库 1 行');
  } else {
    console.log(`  开始在新目录 ${targetResolved} 中验证...`);
    console.log('    - 运行 npm ci (--no-audit --no-fund)...');
    const ciRes = npm(targetResolved, 'ci', '--no-audit', '--no-fund');
    if (ciRes.code !== 0) throw new Error(`新目录 npm ci 失败:\n${ciRes.out}`);

    console.log('    - 运行 npm run lint...');
    const lintRes = npm(targetResolved, 'run', 'lint');
    if (lintRes.code !== 0) throw new Error(`新目录 npm run lint 失败:\n${lintRes.out}`);

    console.log('    - 运行 npm test...');
    const testRes = npm(targetResolved, 'test');
    if (testRes.code !== 0) throw new Error(`新目录 npm test 失败:\n${testRes.out}`);

    console.log('    - 检查 git status...');
    const newStatus = git(targetResolved, 'status', '--porcelain').out;
    const newStatusLines = newStatus.split('\n').map((l) => l.trimEnd()).filter(Boolean);
    const abnormalStatus = newStatusLines.filter((l) => {
      const rest = l.slice(3).trim();
      return !(lineStartsWithClaude(l, rest));
    });
    if (abnormalStatus.length > 0) {
      throw new Error(`新目录 git status 存在异常项:\n${abnormalStatus.join('\n')}`);
    }

    console.log('    - 检查 git worktree list...');
    const newWtList = git(targetResolved, 'worktree', 'list', '--porcelain').out;
    const newWts = parsePorcelainWorktrees(newWtList);
    if (newWts.length !== 1) {
      throw new Error(`新目录 git worktree list 异常,应只有 1 行主仓库,实际有 ${newWts.length} 行`);
    }
    console.log('  新目录验证全部通过！');
  }

  // 7. 打印后续事项
  console.log('\n[7/7] 后续事项提示:');
  console.log('='.repeat(70));
  console.log('后续事项 (需人工处理, 脚本不做修改):');
  console.log('1. Antigravity 设置:');
  console.log(`   在 %USERPROFILE%\\.gemini\\antigravity-cli\\settings.json 的 "trustedWorkspaces" 中添加新路径:`);
  console.log(`   "${targetResolved}"`);
  console.log('2. Claude Code:');
  console.log('   在新目录开启新的 Claude Code 会话。');
  console.log('3. 本机启动配置:');
  console.log('   检查并更新 .claude\\launch.json 里的旧路径。');
  console.log('4. 清理旧目录:');
  console.log(`   确认关闭所有占用旧仓库的程序(终端、编辑器、Claude 会话、dev server 等)后,`);
  console.log(`   手动把旧仓库 "${repoRoot}" 移到回收站。`);
  console.log('='.repeat(70));
  console.log(apply ? '\n搬迁流程顺利完成！' : '\n空跑检查完成。若计划无误,可加上 --apply 参数实际执行。');
}

function lineStartsWithClaude(line, rest) {
  return line.startsWith('?? ') && (rest === '.claude/' || rest.startsWith('.claude/') || rest.startsWith('.claude\\'));
}

// ---------------------------------------------------------------------------
// 仅在直接执行时运行 main()
// ---------------------------------------------------------------------------

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    console.error(`\n[搬迁终止] ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
}
