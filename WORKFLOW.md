# 🚀 Git 工作流指南

## 📌 分支策略

```
master (生产环境)    ← 只放稳定版本
  ↑
  合并
  ↑
dev (开发环境)       ← 日常开发在这里
  ↑
  合并
  ↑
feature/* (功能分支) ← 开发新功能时创建
```

---

## 🎯 日常开发工作流

### 方式一：直接在 dev 分支开发（推荐）

```bash
# 1. 确保在 dev 分支
git checkout dev

# 2. 拉取最新代码
git pull origin dev

# 3. 开始开发...修改代码

# 4. 提交到 dev（可以随意提交测试）
git add .
git commit -m "测试：某个功能"
git push origin dev

# 5. 测试通过后，合并到 master
git checkout master
git pull origin master
git merge dev
git push origin master
```

### 方式二：使用功能分支（更规范）

```bash
# 1. 从 dev 创建功能分支
git checkout dev
git checkout -b feature/add-email-filter

# 2. 开发并提交
git add .
git commit -m "添加邮件过滤功能"
git push origin feature/add-email-filter

# 3. 功能完成后，合并回 dev
git checkout dev
git merge feature/add-email-filter
git push origin dev

# 4. 删除功能分支（可选）
git branch -d feature/add-email-filter
git push origin --delete feature/add-email-filter

# 5. dev 测试通过后，合并到 master
git checkout master
git merge dev
git push origin master
```

---

## 🌐 Vercel 部署配置

### 配置多环境部署

1. **进入 Vercel 项目设置**
2. **Settings** → **Git**
3. **Production Branch** 设置为 `master`
4. **启用 Preview Deployments** （自动启用）

结果：
- ✅ `master` 分支 → **生产环境** (your-app.vercel.app)
- ✅ `dev` 分支 → **预览环境** (your-app-git-dev.vercel.app)
- ✅ 其他分支 → **临时预览** (your-app-git-xxx.vercel.app)

### 查看部署状态

- 每次 push 后，Vercel 会自动部署
- GitHub PR 会显示预览链接
- Vercel Dashboard 可查看所有部署

---

## 📝 快捷命令备忘录

```bash
# 查看当前分支
git branch

# 切换分支
git checkout dev         # 切换到 dev
git checkout master      # 切换到 master

# 查看状态
git status

# 暂存未完成的修改（不想提交时）
git stash               # 暂存修改
git stash pop           # 恢复暂存的修改
git stash list          # 查看所有暂存

# 撤销修改
git restore <file>      # 撤销单个文件
git restore .           # 撤销所有修改

# 查看提交历史
git log --oneline -10   # 最近 10 条提交
```

---

## 💡 常见场景

### 场景1：修改不确定有没有用
```bash
# 在 dev 分支提交测试
git checkout dev
# ... 修改代码 ...
git add .
git commit -m "实验：尝试修复 XXX"
git push origin dev
# 在 Vercel Preview 环境测试
# ❌ 不行就回滚：git revert HEAD
# ✅ 可以就合并到 master
```

### 场景2：紧急修复生产 bug
```bash
# 从 master 创建 hotfix 分支
git checkout master
git checkout -b hotfix/critical-bug
# ... 修复 ...
git add .
git commit -m "紧急修复：XXX"
git push origin hotfix/critical-bug
# 合并到 master
git checkout master
git merge hotfix/critical-bug
git push origin master
# 同步到 dev
git checkout dev
git merge master
git push origin dev
```

### 场景3：查看某次提交的详细信息
```bash
git show <commit-hash>   # 查看具体修改内容
git diff HEAD~1          # 对比上一次提交
```

---

## 🔒 保护 master 分支（可选）

### GitHub 设置

1. **Settings** → **Branches** → **Add rule**
2. **Branch name pattern**: `master`
3. 勾选：
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
4. **Create**

这样强制通过 Pull Request 才能合并到 master，避免误操作。

---

## 🎓 总结

**日常开发建议流程：**

1. 🔧 **开发阶段**：在 `dev` 分支随意提交测试
2. 🧪 **测试阶段**：Vercel 自动部署 Preview 环境测试
3. ✅ **确认可用**：合并到 `master` 部署生产环境
4. 🗑️ **不需要的**：`git revert` 或者不合并到 master

**核心优势：**
- ✅ master 保持整洁（只有稳定版本）
- ✅ dev 可以随意测试（不影响生产）
- ✅ 每个分支自动部署到独立环境
- ✅ 出问题可以快速回滚

---

## 🆘 需要帮助？

```bash
# 不确定当前在哪个分支
git branch

# 想放弃所有修改，回到上次提交状态
git reset --hard HEAD

# 想回到某个历史版本
git log --oneline        # 查看历史
git checkout <hash>      # 回到指定版本
```

