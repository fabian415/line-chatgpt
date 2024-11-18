require("dotenv").config();

const line = require("@line/bot-sdk");
const express = require("express");
const path = require("path");
const cors = require("cors");

const OpenAI = require("openai");
const openAIclient = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"], // This is the default and can be omitted
});

const { GoogleGenerativeAI } = require("@google/generative-ai");
const configuration = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = configuration.getGenerativeModel({ model: "gemini-1.5-flash" });
let chatSession = null;
let thread = [];

// create LINE SDK config from env variables
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// create LINE SDK client
const client = new line.Client(config);

// create Express app
// about Express itself: https://expressjs.com/
const app = express();

app.use(cors());
// 首頁
app.use(express.static(path.resolve(__dirname, "./static"))); // 設定靜態檔案目錄

// register a webhook handler with middleware
// about the middleware, please refer to doc
app.post("/callback", line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// Test
app.get("/hi", async (req, res) => {
  // Open AI
  // const completion = await openAIclient.chat.completions.create({
  //   messages: [{ role: "user", content: "你好嗎？" }],
  //   model: "gpt-3.5-turbo",
  // });
  // const answer = completion.choices[0].message.content;
  // res.send(answer);

  // Gemini
  const result = await model.generateContent(["Explain how AI works?"]);
  res.send(result.response.text());
});

app.get("/ask", async (req, res) => {
  const question = req.query.question;
  console.log(question);
  // // Open AI
  // const stream = await openAIclient.chat.completions.create({
  //   messages: [{ role: "user", content: question }],
  //   model: "gpt-3.5-turbo",
  //   stream: true,
  // });
  // res.set({
  //   "Content-Type": "text/event-stream",
  //   "Cache-Control": "no-cache",
  //   Connection: "keep-alive",
  // });

  // res.flushHeaders();
  // for await (const chunk of stream) {
  //   res.write(`data: ${chunk.choices[0]?.delta?.content || ""}\n\n`);
  // }

  // 紀錄對話
  thread.push({
    role: "user",
    parts: [{ text: question }],
  });
  if (!chatSession) {
    chatSession = model.startChat({
      history: thread,
      generationConfig: {
        maxOutputTokens: 5000,
      },
    });
  }
  const result = await chatSession.sendMessageStream(question);
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  res.flushHeaders();
  let text = "";
  for await (const chunk of result.stream) {
    text += chunk.text();
    res.write(`data: ${chunk.text() || ""}\n\n`);
  }
  thread.push({
    role: "model",
    parts: [{ text: text }],
  });

  // res.set({
  //   "Content-Type": "text/event-stream",
  //   "Cache-Control": "no-cache",
  //   Connection: "keep-alive",
  // });

  // res.flushHeaders();

  // thread.push({
  //   role: "user",
  //   parts: [{ text: question }],
  // });
  // const result = await model.generateContent({ contents: thread });
  // const response = await result.response;
  // const text = response.text();
  // thread.push({
  //   role: "model",
  //   parts: [{ text: text }],
  // });
  // console.log(text);
  // res.write(`data: ${text || ""}\n\n`);
});

app.get("/sse", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  res.flushHeaders();

  setInterval(() => {
    const data = {
      message: `Current time is ${new Date().toLocaleTimeString()}`,
    };

    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }, 1000);
});

// event handler
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    // ignore non-text-message event
    return Promise.resolve(null);
  }

  // // Open AI
  // const completion = await openAIclient.chat.completions.create({
  //   messages: [{ role: "user", content: event.message.text }],
  //   model: "gpt-3.5-turbo",
  // });

  // const text = completion.choices[0].message.content;

  // Gemini AI
  thread.push({
    role: "user",
    parts: [{ text: event.message.text }],
  });
  if (thread.length > 50) {
    thread.shift();
  }

  if (!chatSession) {
    chatSession = model.startChat({
      history: thread,
      generationConfig: {
        maxOutputTokens: 5000,
      },
    });
  }

  const result = await model.generateContent({ contents: thread });
  const response = await result.response;
  const text = response.text();
  thread.push({
    role: "model",
    parts: [{ text: text }],
  });
  // create a echoing text message
  const echo = { type: "text", text: text };

  // use reply API
  return client.replyMessage(event.replyToken, echo);
}

// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
