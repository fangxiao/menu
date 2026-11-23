# 冰箱有谱（WorkBuddy 兼容包）

输入冰箱现有食材和就餐人数，快速生成 1-2 个最省事的家常菜单、极简步骤和采购清单，解决“今天吃什么”的选择困难，减少食材浪费和盲买。

只支持文字输入，不需要拍照识别。

- **技能规则**：`SKILL.md`（单一事实来源）
- **轻量索引**：`resources/recipes-index.json`（64 道家常快手菜单行紧凑索引，省上下文）
- **菜谱库**：`resources/recipes.json`（64 道家常快手菜，含过敏原/饮食/辣度/锅具字段及完整步骤）
- **单位换算**：`resources/units.json`
- **食材别名**：`resources/ingredient-aliases.json`
- **专家 Agent**：`agents/fridge-menu.md`（启动时读取包根目录的 `SKILL.md` 与 `resources/`）
- **插件元数据**：`.codebuddy-plugin/plugin.json`

规则变更时只改 `SKILL.md`；只有文件路径变化时才需要同步 `agents/fridge-menu.md`。不要在多处维护不同版本的规则。

技能通道可以只取 `SKILL.md` 与 `resources/`；专家通道使用完整目录。
