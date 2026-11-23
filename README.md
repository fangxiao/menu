# 冰箱极简配菜与采购助手（Skill + 线上 H5 版）

面向「每天做饭前不知道吃什么」和「周末去超市怕盲买」的上班族、年轻情侣与独居青年，同时提供 **Agent Skill 配置包** 与 **移动端 H5 Web 应用**，共用同一份 50 道家常菜结构化知识库。

## 目录结构

```text
.
├── README.md
├── package.json                          # Next.js 16 + Tailwind v4（端口 3007）
├── Dockerfile                            # standalone 容器部署配置
├── .env.example                          # 大模型 API 环境变量模板
├── .agents/skills/fridge-menu/
│   ├── SKILL.md                          # Agent Skill 核心指令与决策规则
│   └── resources/recipes.json            # 50 道高频家常快手菜结构化知识库
└── src/
    ├── lib/
    │   ├── types.ts                      # 前后端共享类型
    │   └── recipes.ts                    # 知识库加载与食材关键词粗筛
    └── app/
        ├── page.tsx                      # 手机端 H5 主界面（快捷示例/人数/打钩采购清单）
        └── api/menu/route.ts             # POST /api/menu 配菜接口
```

## 快速启动 H5（复用 hairstyle 环境）

```bash
# 1. 复用 hairstyle 的模型接口配置（或参考 .env.example 自行填写）
cp ../hairstyle/.env.local .env.local

# 2. 启动本地服务（默认端口 3007，不与 hairstyle 的 3006 冲突）
npm run dev
```

打开浏览器或手机同一局域网访问 `http://localhost:3007` 即可体验。

## 作为 AI Agent Skill 使用

将 `.agents/skills/fridge-menu` 复制到你的全局 Skill 目录即可在任意对话中触发：

```bash
cp -r .agents/skills/fridge-menu ~/.gemini/skills/fridge-menu
```
