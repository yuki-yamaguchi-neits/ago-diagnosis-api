
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('AGO Diagnosis API is running. Use /diagnose?url=YOUR_URL');
});

app.get('/diagnose', (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing url parameter');
  }

  // 仮の診断結果（今後GPTで生成に切り替え予定）
  const result = {
    target: url,
    score: 41,
    rank: 'D',
    summary: '構造化データが未設定、llms.txtが存在しないため、AI検索最適化が不十分です。',
    recommendation: '構造化データとllms.txtの設定を行い、コンテンツの信頼性と可読性を高めましょう。'
  };

  res.json(result);
});

app.listen(port, () => {
  console.log(`AGO Diagnosis API listening at http://localhost:${port}`);
});
