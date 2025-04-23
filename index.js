
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import cheerio from 'cheerio';
import { config } from 'dotenv';

config();
const app = express();
const port = process.env.PORT || 10000;

app.use(cors());

app.get('/diagnose', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'URL parameter is required.' });

  try {
    const response = await axios.get(targetUrl);
    const $ = cheerio.load(response.data);

    // 仮の判定ロジック（12項目）例
    const results = [
      {
        id: '1a-01',
        label: '構造化データ（JSON-LD）',
        score: $('script[type="application/ld+json"]').length > 0 ? 5 : 0,
        rank: $('script[type="application/ld+json"]').length > 0 ? 'A' : 'D',
        comment: $('script[type="application/ld+json"]').length > 0
          ? '構造化データが見つかりました。'
          : '構造化データがありません。',
        recommendation: $('script[type="application/ld+json"]').length > 0
          ? '現状維持で問題ありません。'
          : '構造化データ（JSON-LD）を追加してください。',
        source: 'machine'
      },
      {
        id: '1a-02',
        label: 'HTML言語属性（lang）',
        score: $('html[lang]').length > 0 ? 5 : 0,
        rank: $('html[lang]').length > 0 ? 'A' : 'D',
        comment: $('html[lang]').length > 0
          ? '言語属性が設定されています。'
          : 'htmlタグにlang属性がありません。',
        recommendation: $('html[lang]').length > 0
          ? '現状維持で問題ありません。'
          : 'htmlタグに lang="ja" などの言語設定を追加してください。',
        source: 'machine'
      }
    ];

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
      summary: "これは仮の総合コメントです。",
      results
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '診断中にエラーが発生しました。' });
  }
});

app.listen(port, () => {
  console.log(`診断サーバー起動：http://localhost:${port}`);
});
