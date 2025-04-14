const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const OpenAI = require("openai");

const app = express();
app.use(cors());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get("/api/diagnose", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    const results = [
      { name: "title", value: $("title").text().trim().length > 0 ? 5 : 0 },
      { name: "metaDesc", value: $('meta[name="description"]').attr("content") ? 5 : 0 },
      { name: "ogp", value: $('meta[property^="og:"]').length >= 3 ? 5 : 0 },
      { name: "canonical", value: $('link[rel="canonical"]').attr("href") ? 5 : 0 },
      { name: "lang", value: $("html").attr("lang") ? 5 : 0 },
      { name: "jsonld", value: $('script[type="application/ld+json"]').length > 0 ? 5 : 0 },
      { name: "h1", value: $("h1").length > 0 ? 5 : 0 },
      { name: "favicon", value: $('link[rel="icon"]').attr("href") ? 5 : 0 },
    ];

    const validResults = results.filter(r => typeof r.value === "number");
    const totalScore = validResults.reduce((sum, r) => sum + r.value, 0);
    const maxScore = validResults.length * 5;
    const scorePercentage = Math.round((totalScore / maxScore) * 100);
    const validCount = validResults.length;

    const rank =
      scorePercentage >= 90 ? "S" :
      scorePercentage >= 80 ? "A" :
      scorePercentage >= 65 ? "B" :
      scorePercentage >= 50 ? "C" : "D";

    const gptPrompt = `以下の情報を元に、このWebサイトのAI検索への最適化状況を100文字以内で総評してください。\n- スコア：${scorePercentage}%\n- ランク：${rank}\n- 評価項目数：${validCount}/90`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",  // ← ← ← 安定版に変更済み
      messages: [{ role: "user", content: gptPrompt }],
    });

    const comment = completion.choices[0].message.content.trim();

    res.json({
      url,
      date: new Date().toISOString().slice(0, 10),
      scorePercentage,
      validCount,
      rank,
      comment
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "診断処理中にエラーが発生しました" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


//ここからカテゴリ①Ａ判定コード
app.get("/api/diagnose/1a", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    const checks = [
      {
        name: "タイトル（titleタグ）",
        raw: $("title").text().trim(),
        evaluate(value) {
          const len = value.length;
          if (!value) return 0;
          if (len < 10) return 2;
          if (len < 20) return 3;
          if (len < 30) return 4;
          return 5;
        },
        advice: "タイトルは30文字前後で内容が伝わるものにしましょう"
      },
      {
        name: "ディスクリプション（meta description）",
        raw: $('meta[name="description"]').attr("content") || "",
        evaluate(value) {
          const len = value.length;
          if (!value) return 0;
          if (len < 50) return 2;
          if (len < 100) return 3;
          if (len < 160) return 5;
          return 4;
        },
        advice: "自然な日本語で120〜160文字程度が望ましいです"
      },
      {
        name: "OGPタグ",
        raw: $('meta[property^="og:"]').length,
        evaluate(count) {
          if (count >= 5) return 5;
          if (count >= 3) return 4;
          if (count >= 1) return 2;
          return 0;
        },
        advice: "og:title / og:description / og:image を設定してください"
      },
      {
        name: "JSON-LD構造化データ",
        raw: $('script[type="application/ld+json"]').length,
        evaluate(count) {
          if (count === 0) return 0;
          if (count >= 1) return 5;
          return 2;
        },
        advice: "schema.org に準拠したJSON-LDを設置しましょう"
      },
      {
        name: "canonicalタグ",
        raw: $('link[rel="canonical"]').attr("href") || "",
        evaluate(value) {
          if (!value) return 0;
          if (value.includes("http")) return 5;
          return 3;
        },
        advice: "正規URLを絶対パスで指定してください"
      },
      {
        name: "htmlタグのlang属性",
        raw: $("html").attr("lang") || "",
        evaluate(value) {
          if (value === "ja") return 5;
          if (value) return 3;
          return 0;
        },
        advice: "htmlタグに lang=\"ja\" を明示しましょう"
      },
      {
        name: "favicon設定",
        raw: $('link[rel="icon"]').attr("href") || "",
        evaluate(value) {
          if (!value) return 0;
          return 5;
        },
        advice: "サイト認知のため favicon.ico を設定しましょう"
      },
      {
        name: "Twitterカード",
        raw: $('meta[name="twitter:card"]').length,
        evaluate(count) {
          if (count > 0) return 5;
          return 0;
        },
        advice: "twitter:card など SNS対応メタを設定してください"
      },
      {
        name: "WebSiteスキーマ",
        raw: html.includes('"@type": "WebSite"'),
        evaluate(bool) {
          return bool ? 5 : 0;
        },
        advice: "トップページにはWebSiteタイプを含めましょう"
      },
      {
        name: "Organizationスキーマ",
        raw: html.includes('"@type": "Organization"'),
        evaluate(bool) {
          return bool ? 5 : 0;
        },
        advice: "会社名・連絡先・ロゴのスキーマを含めてください"
      },
      {
        name: "Serviceスキーマ",
        raw: html.includes('"@type": "Service"'),
        evaluate(bool) {
          return bool ? 5 : 0;
        },
        advice: "提供するサービス内容を構造化データ化しましょう"
      },
      {
        name: "FAQスキーマ",
        raw: html.includes('"@type": "FAQPage"'),
        evaluate(bool) {
          return bool ? 5 : 0;
        },
        advice: "よくある質問がある場合はFAQスキーマを活用しましょう"
      },
    ];

    const items = checks.map(check => {
      const score = check.evaluate(check.raw);
      const comment = `現在の状態：${typeof check.raw === "boolean" ? (check.raw ? "◯" : "×") : check.raw}`;
      return {
        name: check.name,
        score,
        comment,
        advice: check.advice
      };
    });

    const validItems = items.filter(i => typeof i.score === "number");
    const totalScore = validItems.reduce((sum, i) => sum + i.score, 0);
    const maxScore = validItems.length * 5;
    const scorePercentage = Math.round((totalScore / maxScore) * 100);
    const validCount = validItems.length;

    const rank =
      scorePercentage >= 90 ? "S" :
      scorePercentage >= 80 ? "A" :
      scorePercentage >= 65 ? "B" :
      scorePercentage >= 50 ? "C" : "D";

    const gptPrompt = `以下はカテゴリ①A（構造・メタデータ対策）の診断結果です。お客様向けに、100文字以内のやさしい総評コメントを出してください。\nスコア: ${scorePercentage}%\nランク: ${rank}\n診断項目数: ${validCount}/12`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: gptPrompt }]
    });

    const summary = completion.choices[0].message.content.trim();

    res.json({
      scorePercentage,
      validCount,
      rank,
      summary,
      items: validItems
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "診断エラーが発生しました" });
  }
});
