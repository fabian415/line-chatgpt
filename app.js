require("dotenv").config();

const line = require("@line/bot-sdk");
const express = require("express");
// const { Configuration, OpenAIApi } = require("openai");

// const configuration = new Configuration({
//   apiKey: process.env.OPENAI_API_KEY,
// });
// const openai = new OpenAIApi(configuration);
const OpenAI = require("openai");

const openAIclient = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"], // This is the default and can be omitted
});

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
  const completion = await openAIclient.chat.completions.create({
    messages: [{ role: "user", content: "你好嗎？" }],
    model: "gpt-3.5-turbo",
  });
  const answer = completion.choices[0].message.content;
  res.send(answer);
});

// event handler
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    // ignore non-text-message event
    return Promise.resolve(null);
  }

  // // create a echoing text message
  // const echo = { type: "text", text: event.message.text };

  // // use reply API
  // return client.replyMessage(event.replyToken, echo);

  // const completion = await openai.createCompletion({
  //   model: "text-davinci-003",
  //   prompt: event.message.text,
  // });

  const completion = await openAIclient.chat.completions.create({
    messages: [{ role: "user", content: event.message.text }],
    model: "gpt-3.5-turbo",
  });

  const text = completion.choices[0].message.content;
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
