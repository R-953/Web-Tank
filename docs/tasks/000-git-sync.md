# 000-git-sync:理顺 git,把第五轮和协作机制推上 GitHub

- 负责:Claude Code(主程),在 D:\Main、Windows 本机运行
- 状态:已合并
- 分支:直接在 `main` 上操作(仓库整理;**push 之前先让负责人确认**)
- 规模:S
- 权限模式:建议用「逐条确认」,不要用自动模式(自动模式的安全检查服务 2026-09-29 出现过故障,命令全部没跑成)

## 目标

GitHub 上的 `main` 包含第五轮的全部代码和协作机制文件,CI 和 Pages 都是绿的;本地和远程一致;没有大小写重复的工作流文件。

## 现状(2026-09-29 只读检查)

- **本地提交记录:** HEAD 是 `c80e6d8`。远程后来在网页上又提交过几次(`c9451ba` 删除 CI.yml、`97717de` 上传文件、`79f43ca` 删除 ci.yml,可能还有更多)。本地的 origin/main 没更新,所以才显示 up to date。
- **大小写重复:** HEAD 里同时有 `.github/workflows/CI.yml` 和 `ci.yml`,内容相同。Windows 不区分大小写,磁盘上只有 `CI.yml`,所以两个都显示为 modified。
- **工作区:** 第五轮改动 + 协作机制文件(AGENTS.md、docs/tasks/、changelog.d/)+ 根目录整理(index.html 标题、package.json 包名、.gitignore)都还没提交。
- **git 配置:**
  - user.name = `R-953`,user.email = `r-953@outlook.com`(和 claude.ai 登录邮箱不同,请负责人确认这个邮箱已经加到 GitHub 账号里,否则提交不会算到账号上)。
  - `credential.helper = store`,GitHub 令牌以明文存在 `~/.git-credentials` 里 → 见第 1 步。
- **vim 残留:** `.git/` 里有 `.COMMIT_EDITMSG.swp/.swo/.swn` 三个残留文件,之前提交时卡在了 vim 里,可以删掉。

## 步骤

1. **环境与凭据**(涉及凭据的操作由负责人自己做,agent 只给命令、不经手令牌):
   - `git --version`、`node -v`(需要 ≥ 22.12)、`npm -v`。
   - 建议 `git config --global core.editor notepad`,免得再卡进 vim。
   - 建议改用 Git for Windows 自带的凭据管理器:`git config --global credential.helper manager`,然后由负责人删掉 `~/.git-credentials`。如果里面是个人访问令牌,到 GitHub 上把它撤销,重新生成。下次 push 时会弹出浏览器登录。
2. `git fetch origin`。用 `git log --oneline HEAD..origin/main` 和 `git diff --stat HEAD origin/main` 弄清远程多了什么,把结果告诉负责人。
3. 处理大小写重复:`git rm --cached .github/workflows/ci.yml`,只保留 `CI.yml`。
4. `npm ci`,然后跑 `npm run lint`、`npm test`、`npm run build`,全部通过后才提交。任何一步失败就停下来,回报错误。
5. 提交,两种方式任选:
   - **分两次(推荐):**
     - 第一次:除下面这些文件以外的全部改动,信息 `feat: 第五轮——主界面与设置、植被、机枪、起火、HUD 重排`。
     - 第二次:`AGENTS.md docs/tasks changelog.d index.html package.json package-lock.json .gitignore`,信息 `docs: 多智能体协作机制与根目录整理`。
   - **一次提交:** 信息写两行,分别概括上面两部分。
   - 提交前确认 `Claude outputs/`、`dist/`、`node_modules/` 没有被加进去。
6. `git merge origin/main`。冲突时以本地为准(本地是最新的),但要逐个看一眼远程改了什么;工作流以本地的 `CI.yml` 和 `deploy.yml` 为准。
7. 合并后再跑一遍第 4 步的三条命令。都通过后,**请负责人确认**,再 `git push origin main`。**不要 force push。**
8. 到 GitHub Actions 看 CI 和 Deploy 的结果,把链接和结论写进「结果」;把看板(docs/tasks/README.md)里 000 的状态改成已完成(这一改动可以留到下一次提交)。

## 不做

- 不改任何源代码。
- 不改写历史:不用 rebase,不用 reset --hard,不 force push。

## 结果(完成后填写)

- 提交:
  - `5a1c370 feat: 第五轮——主界面与设置、植被、机枪、起火、HUD 重排`(含删除 `.github/workflows/ci.yml`)
  - `1b0689d docs: 多智能体协作机制与根目录整理`
  - 没有提交 `dist/`、`node_modules/`、`Claude outputs/`;`package.json` 只改包名,依赖没动
- 合并:
  - `df2f26b` 合并 origin/main。远程多出的 `c9451ba`、`97717de`、`79f43ca` 只改了 `CI.yml` 和 `deploy.yml`,内容和本地完全相同,无冲突;合并提交的文件树和合并前一致
  - 合并前后各跑一遍:`npm ci`(81 个包,0 漏洞)、`npm run lint` 通过、`npm test` 20 个文件 210 个测试全部通过、`npm run build` 通过(有「打包文件超过 500 kB」警告)
  - 负责人确认后 `git push origin main`:`79f43ca..df2f26b`,快进,没有 force push;本地和远程一致
- CI / Deploy:
  - CI:[通过](https://github.com/R-953/Web-Tank/actions/runs/36534817870)(npm ci / lint / test / build 全绿)
  - Deploy:[通过(第 2 次运行)](https://github.com/R-953/Web-Tank/actions/runs/36534817892)。第 1 次在 `actions/configure-pages@v5` 报 `Get Pages site failed ... Not Found`,仓库信息里 `has_pages: false`,也就是 GitHub Pages 被关掉了(同一份 deploy.yml 在 09-26 的 `79f43ca` 上部署成功过)。负责人在 Settings → Pages 把 Source 设为 GitHub Actions 后重跑,通过
  - 线上验证:<https://r-953.github.io/Web-Tank/> 能打开,标题是 Web Tank,显示机库主界面,控制台没有报错
- 遇到的问题:
  - 全局 `credential.helper = store` 还在(`~/.git-credentials` 已经不在),push 前由负责人 `git config --global --unset credential.helper`,现在只用系统级的 manager;push 后确认没有重新生成 `~/.git-credentials`
  - 已设 `git config --global core.editor notepad`;提交和合并都用 `-F` 传提交信息,没有打开编辑器
  - 提交邮箱 `r-953@outlook.com`:负责人确认是 GitHub 账号上绑定的邮箱
  - `.git/` 里的 vim 残留(`.COMMIT_EDITMSG.swp/.swo/.swn`)已移到回收站
  - 本卡第 8 步写的是「已完成」,看板统一用「已合并」,按负责人意见状态记为「已合并」
