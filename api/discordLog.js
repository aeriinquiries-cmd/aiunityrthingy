export async function discordLog(message) {
  try {
    const webhook = process.env.DISCORD_WEBHOOK_URL;

    if (!webhook) {
      console.error("❌ Missing DISCORD_WEBHOOK_URL");
      return;
    }

    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "```log\n" + message + "\n```"
      }),
    });
  } catch (err) {
    console.error("❌ Discord logging failed:", err);
  }
}
