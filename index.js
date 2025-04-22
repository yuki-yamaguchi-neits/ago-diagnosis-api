import express from 'express';
import cors from 'cors';
import fs from 'fs';
import csv from 'csv-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const csvPath = './data/ai-diagnosis-definition-v1.csv';

async function loadCSV() {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

async function generateGPTComment(prompt) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500
  });
  return response.choices[0].message.content.trim();
}

function inferScoreFromComment(comment) {
  if (/良好|十分|問題なし|適切/i.test(comment)) return { score: 5, rank: 'A' };
  if (/一部|やや|改善/i.test(comment)) return { score: 3, rank: 'B' };
  if (/不十分|不足|見つからない/i.test(comment)) return { score: 1, rank: 'D' };
  return { score: 2, rank: 'C' };
}

async function evaluateItem(item, $) {
  const {
    項目コード,
    項目名,
    判定対象,
    評価方式コード,
    評価プロンプト
  } = item;

  const id = 項目コード;
  const label = 項目名;
  const method = 評価方式コード.trim();
  const selector = 判定対象?.trim();

  if (!selector || selector.match(/^\s*$/)) {
    return {
      id,
      label,
      score: 0,
      rank: 'D',
      comment: '判定対象が未設定です',
      recommendation: 'CSVの判定対象列を確認してください',
      source: 'machine'
    };
  }

  try {
    if (method === '0') {
      const value = $(selector);
      const count = value.length;
      const score = count > 0 ? 5 : 0;
      const rank = score === 5 ? 'A' : score >= 3 ? 'B' : score > 0 ? 'C' : 'D';

      return {
        id,
        label,
        score,
        rank,
        comment: count > 0 ? '対象要素が確認されました。' : '対象要素が見つかりません。',
        recommendation: count > 0 ? '現状維持で問題ありません。' : 'HTMLに要素を追加してください。',
        source: 'machine'
      };
    }

    if (method === '1' || method === '2') {
      const rawHtml = $(selector).html() || $(selector).text() || '';
      const trimmed = rawHtml.slice(0, 1000);
      const prompt = `${評価プロンプト}\n\n対象のHTML:\n${trimmed}`;
      const comment = await generateGPTComment(prompt);
      const { score, rank } = inferScoreFromComment(comment);

      return {
        id,
        label,
        score,
        rank,
        comment,
        recommendation: 'AIによる評価に基づく内容を確認してください。',
        source: method === '1' ? 'ai' : 'hybrid'
      };
    }

    return {
      id,
      label,
      score: 0,
      rank: '未評価',
      comment: '不明な評価方式コードです',
      recommendation: '',
      source: 'unknown'
    };

  } catch (err) {
    return {
      id,
      label,
      score: 0,
      rank: 'D',
      comment: `処理中にエラーが発生しました: ${err.message}`,
      recommendation: '対象セレクタやHTML構造を見直してください',
      source: 'error'
    };
  }
}

app.get('/diagnose', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'urlパラメータが必要です' });

  try {
    const csvData = await loadCSV();
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const results = [];
    for (const item of csvData) {
      const result = await evaluateItem(item, $);
      results.push(result);
    }

    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const maxScore = results.length * 5;
    const percentage = Math.round((totalScore / maxScore) * 100);
    const rank = percentage >= 90 ? 'S' : percentage >= 75 ? 'A' : percentage >= 60 ? 'B' : percentage >= 40 ? 'C' : 'D';

    res.json({
      timestamp: new Date().toISOString(),
      url,
      evaluated_items: results.length,
      total_score: totalScore,
      percentage,
      rank,
      results
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '診断処理中にエラーが発生しました' });
  }
});

app.listen(port, () => {
  console.log(`診断サーバー起動：http://localhost:${port}`);
});
