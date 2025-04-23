const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

app.use(cors());

// スコア評価関数
function getScoreByCount(count) {
  if (count >= 5) return 5;
  if (count === 4) return 4;
  if (count === 3) return 3;
  if (count === 2) return 2;
  if (count === 1) return 1;
  return 0;
}

// スコア→ランク変換
function getRank(score) {
  if (score >= 5) return 'A';
  if (score >= 4) return 'B';
  if (score >= 3) return 'C';
  if (score >= 1) return 'D';
  return 'E';
}

app.get('/diagnose', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'URL parameter is required.' });

  try {
    const response = await axios.get(targetUrl);
    const $ = cheerio.load(response.data);
    const results = [];

    // ✅ 1a-01 構造化データ（JSON-LD）
    const jsonLdCount = $('script[type="application/ld+json"]').length;
    const score1 = getScoreByCount(jsonLdCount);
    results.push({
      id: '1a-01',
      label: '構造化データ（JSON-LD）',
      score: score1,
      rank: getRank(score1),
      comment: jsonLdCount > 0
        ? `${jsonLdCount}件のJSON-LD構造化データが検出されました。`
        : '構造化データが見つかりませんでした。',
      recommendation: score1 < 5
        ? '最低でも3件以上のJSON-LD構造化データを配置してください。'
        : '現状維持で問題ありません。',
      source: 'machine'
    });

    // ✅ 1a-02 HTML言語属性（lang）
    const langAttr = $('html').attr('lang');
    const score2 = langAttr ? 5 : 0;
    results.push({
      id: '1a-02',
      label: 'HTML言語属性（lang）',
      score: score2,
      rank: getRank(score2),
      comment: langAttr
        ? `言語属性 "${langAttr}" が設定されています。`
        : 'HTMLのlang属性が未設定です。',
      recommendation: score2 < 5
        ? 'htmlタグに lang="ja" などを明記してください。'
        : 'このままで問題ありません。',
      source: 'machine'
    });

    // ✅ 総合評価
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const evaluatedItems = results.length;
    const maxScore = evaluatedItems * 5;
    const percentage = Math.round((totalScore / maxScore) * 100);
    const rank = percentage >= 85 ? 'A' : percentage >= 70 ? 'B' : percentage >= 50 ? 'C' : 'D';

    // ✅ 総合コメント
    let summary = '';
    if (percentage >= 85) {
      summary = '全体的に非常に良好な構成です。構造化データやHTML属性が整っており、AIから正確に理解される状態に近いです。';
    } else if (percentage >= 70) {
      summary = '基礎的な対策はできていますが、一部補強すべき項目があります。特に構造化データや言語設定の見直しを推奨します。';
    } else {
      summary = 'AIにとって十分に理解できる構成とは言えません。基本的な構造化や属性指定が不足しています。早急な見直しが必要です。';
    }

    res.json({
      timestamp: new Date().toISOString(),
      url: targetUrl,
      total_score: totalScore,
      evaluated_items: evaluatedItems,
      percentage,
      rank,
      summary,
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
        rank: 'E',
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
