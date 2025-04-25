const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const csv = require('csv-parser');
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;
app.use(cors());

// OpenAI API初期化
const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));

// CSVを非同期で読み込む関数
function loadCsvDefinitions(path) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// スコア→ランク変換
function getRank(score) {
  if (score >= 5) return 'A';
  if (score >= 4) return 'B';
  if (score >= 3) return 'C';
  if (score >= 1) return 'D';
  return 'E';
}

// 提案テンプレートを配列で処理（0〜5に対応）
function getTemplateForScore(raw, score) {
  const parts = (raw || '').split('/');
  return parts[score] || parts[parts.length - 1] || '';
}

// メイン診断API
app.get('/diagnose', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'URLパラメータが必要です。' });

  try {
    const html = (await axios.get(url)).data;
    const $ = cheerio.load(html);
    const definitions = await loadCsvDefinitions('./ai-diagnosis-definition-v1.csv');
    const results = [];

    for (const row of definitions) {
      const {
        項目コード: id,
        項目名: label,
        判定対象: selector,
        評価方式コード: method,
        AIへの評価プロンプト: aiPrompt,
        提案テンプレート（機械判定用）: rawTemplates
      } = row;

      let score = 0;
      let comment = '';
      let recommendation = '';
      let source = 'machine';

      try {
        if (method === '0') {
          // ✅ 機械判定（スコア決定方法はCSVでの記述内容に従ってここで実装）
          const count = $(selector).length;
          score = count >= 5 ? 5 : count;
          comment = `${count}件の要素が検出されました。`;
          recommendation = getTemplateForScore(rawTemplates, score);

        } else if (method === '1' || method === '2') {
          // ✅ AI判定またはハイブリッド
          const context = $(selector).toString();
          const prompt = `${aiPrompt}\n\n該当HTML要素:\n${context}`;
          const aiResponse = await openai.createChatCompletion({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.4
          });
          const reply = aiResponse.data.choices[0].message.content.trim();
          const match = reply.match(/([0-5])/);
          score = match ? parseInt(match[1]) : 0;
          comment = reply;
          recommendation = getTemplateForScore(rawTemplates, score);
          source = 'ai';
        }
      } catch (e) {
        score = 0;
        comment = `評価エラー: ${e.message}`;
        recommendation = '再実行を推奨します。';
        source = 'error';
      }

      results.push({
        id,
        label,
        score,
        rank: getRank(score),
        comment,
        recommendation,
        source
      });
    }

    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const maxScore = results.length * 5;
    const percentage = Math.round((totalScore / maxScore) * 100);
    const rank = percentage >= 85 ? 'A' : percentage >= 70 ? 'B' : percentage >= 50 ? 'C' : 'D';
    const summary =
      rank === 'A' ? '非常に良好な構成です。' :
      rank === 'B' ? '基本的な対策はできています。' :
      'AIに正しく伝わるための改善が必要です。';

    res.json({
      timestamp: new Date().toISOString(),
      url,
      total_score: totalScore,
      evaluated_items: results.length,
      percentage,
      rank,
      summary,
      results
    });

  } catch (err) {
    console.error('診断エラー:', err.message);
    res.status(500).json({ error: '診断処理に失敗しました。' });
  }
});

app.listen(port, () => {
  console.log(`診断サーバー起動：http://localhost:${port}`);
});
