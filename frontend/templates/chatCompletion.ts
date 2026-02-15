export const CHAT_COMPLETION_TEMPLATE = `import OpenAI from "openai";

export const handler = async (event) => {
  try {
    const body = event?.body ? JSON.parse(event.body) : {};
    const message = typeof body.message === "string" ? body.message : "";

    if (!message) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Missing required field: message" }),
      };
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
      };
    }

    const rawContextFiles = process.env.S3_CONTEXT_FILES || "";
    const contextFiles = rawContextFiles
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const systemPrompt = [
      "You are a helpful assistant for a frontend app.",
      contextFiles.length > 0
        ? "Use the following S3 context file references when relevant:\n" + contextFiles.join("\n")
        : "No external context files were provided.",
    ].join("\n\n");

    const client = new OpenAI({ apiKey: openaiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.4,
    });

    const answer = completion.choices?.[0]?.message?.content || "";

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
      body: JSON.stringify({ response: answer }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected Lambda error",
      }),
    };
  }
};
`;
