import { NextRequest, NextResponse } from "next/server";

interface DishImageRequest {
  dishName?: string;
  ingredientsText?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DishImageRequest;
    const dishName = (body.dishName || "").trim();
    if (!dishName) {
      return NextResponse.json({ error: "缺少菜名" }, { status: 400 });
    }

    const agnesKey = process.env.AGNES_API_KEY || "";
    const agnesBase = (
      process.env.AGNES_API_BASE_URL || "https://apihub.agnes-ai.com/v1"
    ).replace(/\/+$/, "");

    const baseUrl = agnesKey
      ? agnesBase
      : (process.env.AI_API_BASE_URL || "https://api.ailearning.top/v1").replace(
          /\/+$/,
          ""
        );
    const apiKey = agnesKey || process.env.AI_API_KEY || "";
    const imageModel =
      process.env.AGNES_IMAGE_MODEL ||
      process.env.AI_IMAGE_MODEL ||
      "agnes-image-2.5-flash";

    if (!apiKey || apiKey === "your-api-key-here") {
      return NextResponse.json(
        { error: "服务端未配置 AI_API_KEY" },
        { status: 500 }
      );
    }

    const ingredientsHint = body.ingredientsText
      ? `，主要食材：${body.ingredientsText}`
      : "";
    const prompt = `家常中餐美食实拍照片，菜品：${dishName}${ingredientsHint}。装在干净的白色家常陶瓷盘里，放在温暖的木质餐桌上，自然窗光，色泽诱人有食欲，写实风格，高清美食摄影，无文字水印。`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    try {
      const res = await fetch(`${baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: imageModel,
          prompt,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return NextResponse.json(
          { error: `生图接口失败 (${res.status}): ${errText.slice(0, 200)}` },
          { status: 502 }
        );
      }

      const data = (await res.json()) as {
        data?: Array<{ b64_json?: string; url?: string }>;
      };
      const b64 = data?.data?.[0]?.b64_json;
      if (b64) {
        const mime = b64.startsWith("/9j/") ? "image/jpeg" : "image/png";
        return NextResponse.json({ imageUrl: `data:${mime};base64,${b64}` });
      }
      const url = data?.data?.[0]?.url;
      if (url) {
        return NextResponse.json({ imageUrl: url });
      }

      return NextResponse.json(
        { error: "生图接口未返回有效图片" },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "生图请求失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
