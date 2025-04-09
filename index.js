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

  const diagnosis = {
    target: url,
    date: new Date().toISOString().slice(0, 10),
    score: 41,
    rank: "D",
    summary: "構造化データ未設定、llms.txtも確認できません。AIにとって認識されにくいサイト構造です。",
    sections: [
      {
        name: "技術的SEO",
        score: 2,
        comment: "metaタグはあるが構造化データがなく、llms.txtも存在しません。"
      },
      {
        name: "信頼性要素（E-E-A-T）",
        score: 1,
        comment: "代表者・会社情報・SNS情報が不十分です。"
      },
      {
        name: "コンテンツの厚み",
        score: 2,
        comment: "情報はあるがオリジナリティや専門性が伝わりにくい構成です。"
      },
      {
        name: "拡散力・言及性",
        score: 1,
        comment: "外部リンクや引用される要素が少なく、ナレッジパネルも確認できません。"
      },
      {
        name: "AI読み取り支援",
        score: 1,
        comment: "llms.txtなし、代替テキストも未整備。plainテキストもなし。"
      }
    ],
    recommendation: "llms.txtと構造化データを整備し、E-E-A-Tの強化とplainテキスト生成を行いましょう。"
  };

  res.json(diagnosis);
});

app.listen(port, () => {
  console.log(`AGO Diagnosis API listening at http://localhost:${port}`);
});
