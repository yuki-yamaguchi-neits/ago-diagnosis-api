import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import csv from 'csv-parser';
import OpenAI from 'openai';

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const csvPath = './data/ai-diagnosis-definition-v1.csv';

// CSV読み込み
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

// GPT生成
async function generateGPTComment(prompt) {
  const completion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'gpt-4-turbo',
  });
  return completion.choices[0].message.content.trim();
}

// 各項目の評価処理
async function evaluateItem(item, $) {
  const {
    項目コード,
    項目名,
    判定対象,
    評価方式コード,
    評価基準,
    AIへの評価プロンプト,
  } = item;

  const id = 項目コード;
  const label = 項目名;
  const method = 評価方式コード;

if (method === '0') {
  const selector = 判定対象?.trim();

  // ✅ 空欄チェック（nullや""も含む）
  if (!selector || selector === '') {
    console.warn(`【警告】判定対象が空欄のためスキップ（項目コード: ${id}）`);
    return {
      id,
      label,
      score: 0,
      rank: 'D',
      comment: 'この診断項目の「判定対象」がCSV上で未設定です。',
      recommendation: 'CSVの該当行に正しいセレクタを設定してください。',
      source: 'machine'
    };
  }

  try {
    const value = $(selector).length;
    const score = value > 0 ? 5 : 0;
    const rank = score >= 5 ? 'A' : score >= 3 ? 'B' : score > 0 ? 'C' : 'D';

    return {
      id,
      label,
      score,
      rank,
      comment: value > 0 ? '該当要素がHTML内に存在しています。' : '該当要素が見つかりませんでした。',
      recommendation: score < 5 ? 'HTMLに必要な構造が存在しません。適切に設置してください。' : '現状維持で問題ありません。',
      source: 'machine'
    };
  } catch (err) {
    console.error(`セレクタエラー（${id}）：${err.message}`);
    return {
      id,
      label,
      score: 0,
      rank: 'D',
      comment: `【セレクタ解析失敗】 "${selector}" の解析中にエラーが発生しました。`,
      recommendation: 'CSSセレクタの形式やHTML構造を確認してください。',
      source: 'machine'
    };
  }
}
  
  if (method === '1') {
    const comment = await generateGPTComment(AIへの評価プロンプト);
    return {
      id,
      label,
      score: 3,
      rank: 'B',
      comment,
      recommendation: '詳細はコメントを参照',
      source: 'ai',
    };
  }

  if (method === '2') {
    const raw = $(判定対象).text().trim().slice(0, 300);
    const prompt = `以下のHTML要素に基づいて、${AIへの評価プロンプト} \n\n対象内容:\n${raw}`;
    const comment = await generateGPTComment(prompt);
    return {
      id,
      label,
      score: 3,
      rank: 'B',
      comment,
      recommendation: '内容を見直すと効果的です。',
      source: 'hybrid',
    };
  }

  return {
    id,
    label,
    score: 0,
    rank: '未評価',
    comment: '評価方式コードに対応していません',
    recommendation: '',
    source: 'unknown',
  };
}

// メインAPI：診断エンドポイント
app.get('/diagnose', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'urlパラメータが必要です' });

  try {
    const csvData = await loadCSV();
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const results = [];
    for (const item of csvData) {
      const result = await evaluateItem(item, $);
      results.push(result);
    }

    const totalScore = results.reduce((acc, cur) => acc + cur.score, 0);
    const maxScore = results.length * 5;
    const percentage = Math.round((totalScore / maxScore) * 100);
    const rank =
      percentage >= 90 ? 'S' : percentage >= 75 ? 'A' : percentage >= 60 ? 'B' : percentage >= 40 ? 'C' : 'D';

    res.json({
      category: 'AI対策診断',
      url,
      evaluated_items: results.length,
      total_score: percentage,
      rank,
      items: results,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '診断処理でエラーが発生しました' });
  }
});

app.listen(port, () => {
  console.log(`診断サーバー起動：http://localhost:${port}`);
});
