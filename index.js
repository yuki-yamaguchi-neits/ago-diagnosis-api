const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

// ✅ キャッシュを防ぐヘッダーをすべてのレスポンスに付ける
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

app.use(cors());

app.get('/diagnose', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'URL parameter is required.' });

  try {
    const response = await axios.get(targetUrl);
    const $ = cheerio.load(response.data);

    const results = [
      {
        id: '1a-01',
        label: '構造化データ（JSON-LD）',
        score: $('script[type="application/ld+json"]').length > 0 ? 5 : 0,
        rank: $('script[type="application/ld+json"]').length > 0 ? 'A' : 'D',
        comment: $('script[type="application/ld+json"]').length > 0
          ? '構造化データが確認できました。'
          : '構造化データが見つかりませんでした。',
        recommendation: $('script[type="application/ld+json"]').length > 0
          ? '現状維持で問題ありません。'
          : 'JSON-LD形式の構造化データを設置してください。',
        source: 'machine'
      },
      {
        id: '1a-02',
        label: 'HTML言語属性（lang）',
        score: $('html[lang]').length > 0 ? 5 : 0,
        rank: $('html[lang]').length > 0 ? 'A' : 'D',
        comment: $('html[lang]').length > 0
          ? 'HTMLに言語属性（lang）が指定されています。'
          : 'HTMLのlang属性が未指定です。',
        recommendation: $('html[lang]').length > 0
          ? 'このままで問題ありません。'
          : 'htmlタグに lang="ja" などを明記してください。',
        source: 'machine'
      }
    ];

    // スコア・評価
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const evaluatedItems = results.length;
    const maxScore = evaluatedItems * 5;
    const percentage = Math.round((totalScore / maxScore) * 100);
    const rank = percentage >= 85 ? 'A' : percentage >= 70 ? 'B' : percentage >= 50 ? 'C' : 'D';

    res.json({
      timestamp: new Date().toISOString(),
      url: targetUrl,
      total_score: totalScore,
      evaluated_items: evaluatedItems,
      percentage,
      rank,
      summary: "構造化データや言語設定など、AIに理解されるための基本が整っているかを確認しました。",
      results
    });

  } catch (err) {
    console.error("診断中エラー:", err.message);
    res.status(500).json({
      error: '診断処理中にエラーが発生しました',
      results: [{
        id: 'system',
        label: '診断不能',
        score: 0,
        rank: 'D',
        comment: 'HTMLの解析に失敗しました。URLが正しいか確認してください。',
        recommendation: '対象ページが存在するか、サーバーが応答しているかをご確認ください。',
        source: 'system'
      }]
    });
  }
});

app.listen(port, () => {
  console.log(`診断サーバー起動：http://localhost:${port}`);
});
