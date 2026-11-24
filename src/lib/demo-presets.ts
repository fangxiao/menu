import type { MenuResponse } from "./types";

export function getDemoMenuResponse(params: {
  ingredients: string;
  servings: number;
  constraints: string[];
}): MenuResponse {
  const { ingredients, servings, constraints } = params;
  const text = ingredients.trim();

  // Scenario 2: Safety hard-filter showcase (e.g. peanut allergy / no spicy / halal)
  if (
    constraints.length > 0 ||
    /(过敏|不吃辣|清真|全素|电饭煲)/.test(text)
  ) {
    const active =
      constraints.length > 0
        ? constraints
        : ["花生过敏", "不吃辣"];

    return {
      isDemoFallback: true,
      assessment: {
        sufficient: true,
        servings,
        summary: `按 ${servings} 人份估算，现有鸡胸肉、黄瓜、胡萝卜、嫩豆腐与鸡蛋足够做 2 道家常菜；已自动启用安全硬过滤（${active.join("、")}），零采购即可安心开火。`,
      },
      safetyReport: {
        totalScanned: 64,
        passedCount: 51,
        excludedCount: 13,
        activeConstraints: active,
        excludedSamples: [
          { recipeName: "宫保鸡丁", reason: "含过敏原：花生；默认含辣/辣椒调料" },
          { recipeName: "麻婆豆腐", reason: "默认含辣/辣椒调料" },
          { recipeName: "水煮肉片", reason: "默认含辣/辣椒调料" },
          { recipeName: "酸辣土豆丝", reason: "默认含辣/辣椒调料" },
        ],
      },
      valueSummary: {
        usedInventoryCount: 4,
        toBuyCount: 0,
        estimatedSavedYuan: 32,
        highlight: "消化 4 样现有库存、0 补货安全开火，并硬过滤 13 道高风险菜谱",
      },
      plans: [
        {
          id: "demo-safe-a",
          title: "方案 A：清炒时蔬鸡丁 + 葱花嫩豆腐",
          badge: "安全硬过滤 · 零采购",
          totalTimeMin: 18,
          reason: "完全避开花生与辣椒调料，老人孩子都能放心吃",
          dishes: [
            {
              name: "黄瓜胡萝卜炒鸡丁（免辣无花生）",
              timeMin: 12,
              ingredientsText: `鸡胸肉 ${servings * 120}g、黄瓜 1 根、胡萝卜半根（腌肉仅用盐+生抽+淀粉）`,
              steps: [
                "鸡胸肉、黄瓜、胡萝卜切丁；鸡丁加少许盐、半勺生抽和1勺淀粉抓匀腌5分钟。",
                "热锅倒油，中大火滑炒鸡丁至表面变白盛出。",
                "留底油先炒胡萝卜丁1分钟，再下黄瓜丁和鸡丁大火翻炒1分钟，加少许盐出锅。",
              ],
            },
            {
              name: "清蒸/焖煎嫩豆腐",
              timeMin: 8,
              ingredientsText: `嫩豆腐 1 盒（约300g）、鸡蛋 1 个（可选增香）`,
              steps: [
                "嫩豆腐切麻将块，平底锅少油中小火煎至两面微黄。",
                "淋入1勺生抽、半碗清水小火咕嘟3分钟收汁，撒葱花出锅（全程零辣零坚果）。",
              ],
            },
          ],
          shoppingList: {
            main: [],
            aromatics: [{ name: "小葱", amount: "1小把（提香，没有可省）" }],
          },
        },
        {
          id: "demo-safe-b",
          title: "方案 B：嫩滑鸡肉豆腐羹（一锅出）",
          badge: "极简省锅 · 清淡暖胃",
          totalTimeMin: 15,
          reason: "只需洗一口锅，适合下班累了想 15 分钟端上桌",
          dishes: [
            {
              name: "鲜蔬滑鸡豆腐羹",
              timeMin: 15,
              ingredientsText: `鸡胸肉 ${servings * 100}g、嫩豆腐 1 盒、胡萝卜半根、鸡蛋 1 个`,
              steps: [
                "鸡胸肉切薄片加少许淀粉抓匀；豆腐、胡萝卜切小丁。",
                "汤锅烧开水，先放胡萝卜和豆腐丁煮3分钟，再滑入鸡片煮至变色。",
                "淋入水淀粉微勾芡，关小火绕圈淋入蛋液，加盐和几滴香油即可。",
              ],
            },
          ],
        },
      ],
      leftoverTip:
        "剩余半根胡萝卜可用厨房纸包好装保鲜袋冷藏，明早切丝炒鸡蛋不浪费；严格过敏人群请使用独立砧板避免交叉污染。",
    };
  }

  // Scenario 3: Specific dish / minimal restock showcase
  if (/(土豆炖牛肉|炖牛肉|补货|采购)/.test(text)) {
    return {
      isDemoFallback: true,
      assessment: {
        sufficient: false,
        servings,
        summary: `按 ${servings} 人份估算，半斤牛肉（250g）足够主菜肉量，但做「土豆炖牛肉」还缺土豆与胡萝卜；为你准备了零采购应急版与微补货标准版。`,
      },
      safetyReport: {
        totalScanned: 64,
        passedCount: 64,
        excludedCount: 0,
        activeConstraints: [],
        excludedSamples: [],
      },
      valueSummary: {
        usedInventoryCount: 1,
        toBuyCount: 2,
        estimatedSavedYuan: 26,
        highlight: "精准按克数算出缺口，仅补买 2 样配菜（约 ¥6），避免去超市盲买",
      },
      plans: [
        {
          id: "demo-restock-a",
          title: "方案 A：黑椒蒜香滑牛肉（零采购）",
          badge: "零采购 · 15分钟救急",
          totalTimeMin: 15,
          reason: "不想下楼买菜时，直接用现有半斤牛肉和基础调料搞定下饭硬菜",
          dishes: [
            {
              name: "快手黑椒滑牛肉",
              timeMin: 15,
              ingredientsText: "牛肉 250g（半斤）、基础调料（生抽、淀粉、黑胡椒粉）",
              steps: [
                "牛肉逆纹切薄片，加1勺生抽、1勺淀粉、1勺食用油抓匀腌10分钟锁水。",
                "锅烧热倒油，大火下牛肉快速滑炒40秒至变色。",
                "撒现磨黑胡椒粉和少许白糖翻炒均匀，立刻出锅防老。",
              ],
            },
          ],
        },
        {
          id: "demo-restock-b",
          title: "方案 B：经典土豆炖牛肉（微补货升级）",
          badge: "只买 2 样 · 凑齐标准餐",
          totalTimeMin: 35,
          reason: "路过菜市场顺手买 2 样配菜，一锅炖出软烂下饭大菜",
          dishes: [
            {
              name: "家常土豆炖牛肉",
              timeMin: 35,
              ingredientsText: `牛肉 250g、土豆 ${servings} 个（约350g）、胡萝卜 1 根（约150g）`,
              steps: [
                "牛肉切块冷水下锅焯水撇去浮沫捞出；土豆和胡萝卜去皮切滚刀块。",
                "热油炒香姜蒜，下牛肉中火翻炒2分钟，加2勺生抽、1勺老抽炒上色。",
                "倒入没过食材的热水，中小火焖煮20分钟后加入土豆和胡萝卜再炖15分钟，大火收汁即可。",
              ],
            },
          ],
          shoppingList: {
            main: [
              { name: "黄心土豆", amount: `${servings}个（约350g）` },
              { name: "胡萝卜", amount: "1根（约150g）" },
            ],
            aromatics: [
              { name: "姜", amount: "1小块" },
              { name: "大蒜", amount: "1头（家里没有再买）" },
            ],
          },
        },
      ],
      leftoverTip:
        "牛肉一次用完无剩余；若买了一大袋土豆，阴凉避光处可放 1 周，下顿可做酸辣土豆丝。",
    };
  }

  // Scenario 1: Default weekday dinner (Tomato + Beef + Eggs)
  return {
    isDemoFallback: true,
    assessment: {
      sufficient: true,
      servings,
      summary: `按 ${servings} 人份估算，2 个西红柿（约300g）+ 半斤牛肉（250g）+ 3 个鸡蛋（约150g）蛋白与蔬菜均衡，完全够吃，无需额外采购！`,
    },
    safetyReport: {
      totalScanned: 64,
      passedCount: 64,
      excludedCount: 0,
      activeConstraints: [],
      excludedSamples: [],
    },
    valueSummary: {
      usedInventoryCount: 3,
      toBuyCount: 0,
      estimatedSavedYuan: 38,
      highlight: "消化 3 样冰箱库存、0 补货直接开火，约省 ¥38 外卖与盲买成本",
    },
    plans: [
      {
        id: "demo-default-a",
        title: "方案 A：番茄滑牛肉 + 葱香滑蛋",
        badge: "零采购 · 20分钟下饭",
        totalTimeMin: 20,
        reason: "牛肉与番茄酸甜开胃，再配一道 5 分钟快手蛋菜，2 人吃得扎实不透支库存",
        dishes: [
          {
            name: "番茄滑牛肉",
            timeMin: 15,
            ingredientsText: "牛肉 250g（半斤）、西红柿 2 个（约300g）",
            steps: [
              "牛肉逆纹切薄片，加1勺生抽、1勺淀粉和1勺油抓匀腌10分钟；西红柿切块。",
              "热锅炒西红柿至出沙出汁，加半碗热水、少许盐和半勺糖煮沸成浓汤底。",
              "转中小火逐片滑入牛肉，待全部变色后大火煮30秒收汁出锅。",
            ],
          },
          {
            name: "嫩滑葱花炒蛋",
            timeMin: 5,
            ingredientsText: "鸡蛋 3 个（约150g）",
            steps: [
              "鸡蛋打散，加少许盐和1勺清水搅匀（口感更蓬松嫩滑）。",
              "热锅宽油，中大火倒入蛋液待边缘鼓起，用铲子推散至刚凝固立即关火盛出。",
            ],
          },
        ],
        shoppingList: {
          main: [],
          aromatics: [{ name: "小葱", amount: "1小把（家里没有可省）" }],
        },
      },
      {
        id: "demo-default-b",
        title: "方案 B：滑蛋牛肉 + 番茄蛋花汤",
        badge: "一菜一汤 · 清淡省油",
        totalTimeMin: 18,
        reason: "合理拆分 3 个鸡蛋（2 个滑牛肉、1 个打汤），有菜有汤更舒服",
        dishes: [
          {
            name: "港式滑蛋牛肉",
            timeMin: 12,
            ingredientsText: "牛肉 250g、鸡蛋 2 个",
            steps: [
              "牛肉切薄片用生抽、淀粉腌8分钟；2个鸡蛋加少许盐和1勺水淀粉打散。",
              "大火快炒牛肉至八成熟，直接倒入蛋液转中小火轻推至半凝固关火，利用余温焖熟。",
            ],
          },
          {
            name: "快手番茄蛋花汤",
            timeMin: 8,
            ingredientsText: "西红柿 2 个、鸡蛋 1 个",
            steps: [
              "少油炒软西红柿至出红油，加 2 大碗清水煮沸 2 分钟。",
              "加盐调味，转小火绕圈淋入剩余 1 个蛋液，关火滴几滴香油即可。",
            ],
          },
        ],
      },
    ],
    leftoverTip:
      "本餐已将西红柿、牛肉、鸡蛋 100% 精准消耗完毕，零剩菜不浪费。",
  };
}

export function applyDemoFollowUp(params: {
  previous: MenuResponse;
  followUp: string;
  constraints: string[];
}): MenuResponse {
  const { previous, followUp, constraints } = params;
  const text = followUp.trim();
  const next: MenuResponse = JSON.parse(JSON.stringify(previous)) as MenuResponse;
  next.isDemoFallback = true;

  // 1. Add 1 person / change servings
  if (/(多加|加1|加一|3人|4人|来.*朋友|多.*人)/.test(text)) {
    const newServings = Math.min(8, (previous.assessment.servings || 2) + 1);
    next.assessment.servings = newServings;
    next.assessment.sufficient = false;
    next.assessment.summary = `人数已临时调整为 ${newServings} 人份：原库存直接做略显紧凑，已为你重新换算克数，并自动补充了 1 样高性价比配菜到采购清单。`;
    next.adjustmentNote = `已按「${text}」将方案从 ${previous.assessment.servings} 人份升级为 ${newServings} 人份，并重算了肉菜比例与补货清单。`;
    if (next.plans[0]) {
      next.plans[0].badge = `${newServings}人份 · 微补货扩容`;
      next.plans[0].shoppingList = {
        main: [
          ...(next.plans[0].shoppingList?.main || []),
          { name: "嫩豆腐或快手青菜（扩容配菜）", amount: "1盒 / 1大把（约300g）" },
        ],
        aromatics: next.plans[0].shoppingList?.aromatics || [],
      };
    }
    if (next.valueSummary) {
      next.valueSummary.toBuyCount =
        next.plans[0]?.shoppingList?.main?.length ?? 1;
      next.valueSummary.highlight = `临时扩容至 ${newServings} 人份，仅需顺手加买 1 样配菜即可体面开席`;
    }
    return next;
  }

  // 2. Missing starch / cooking wine
  if (/(淀粉|料酒|没有.*调料|没.*酒)/.test(text)) {
    next.adjustmentNote = `已按「${text}」去掉所有料酒与淀粉步骤，改用清水+姜片去腥、少许蛋清/食用油锁水，零采购照样嫩滑。`;
    next.plans = next.plans.map((plan) => ({
      ...plan,
      dishes: plan.dishes.map((dish) => ({
        ...dish,
        ingredientsText: dish.ingredientsText
          .replace(/淀粉/g, "少许食用油锁水")
          .replace(/料酒/g, "姜片+清水"),
        steps: dish.steps.map((s) =>
          s
            .replace(/和?1勺淀粉/g, "和1勺食用油锁水（免淀粉）")
            .replace(/淀粉/g, "食用油")
            .replace(/料酒/g, "姜片和1勺清水")
        ),
      })),
    }));
    return next;
  }

  // 3. Add a quick soup
  if (/(汤|暖胃|喝点)/.test(text)) {
    next.adjustmentNote = `已按「${text}」在方案 A 中补充一道 6 分钟快手紫菜蛋花汤/番茄清汤，不额外增加复杂备菜。`;
    if (next.plans[0]) {
      next.plans[0].totalTimeMin += 6;
      next.plans[0].title = `${next.plans[0].title} + 快手清汤`;
      next.plans[0].dishes.push({
        name: "6分钟快手葱花紫菜蛋花汤",
        timeMin: 6,
        ingredientsText: "鸡蛋 1 个（从现有库存匀出）、免洗紫菜 1 小撮（可选）",
        steps: [
          "汤锅烧开 2 碗清水，放入紫菜碎和少许盐煮 1 分钟。",
          "转小火绕圈淋入打散的蛋液，关火滴几滴香油撒葱花即可。",
        ],
      });
    }
    return next;
  }

  // 4. Safety constraint added via follow-up
  if (/(过敏|不吃辣|清真|全素|电饭煲|免明火)/.test(text)) {
    const safeVersion = getDemoMenuResponse({
      ingredients: text,
      servings: previous.assessment.servings,
      constraints: Array.from(new Set([...constraints, text])),
    });
    safeVersion.adjustmentNote = `已按你的补充「${text}」触发安全硬过滤引擎，重新筛除不合规菜谱并替换为安全方案。`;
    return safeVersion;
  }

  // 5. Generic follow-up refinement
  next.adjustmentNote = `已根据你的补充「${text}」微调当前菜单方案，保持最少洗锅与零浪费原则。`;
  if (next.plans[0]) {
    next.plans[0].badge = "已按追问微调";
    next.plans[0].reason = `已结合「${text}」优化口味与步骤，更贴合当前厨房情况`;
  }
  return next;
}
