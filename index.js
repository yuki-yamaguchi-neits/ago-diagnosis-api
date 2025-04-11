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
      model: "gpt-4",
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
