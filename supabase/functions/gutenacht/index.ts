// Gute-Nacht-Würfel Backend (Supabase Edge Function)
// POST {mode:"story", hero, place, item, jackpot, kid}  -> {text}
// POST {mode:"tts", text}                               -> audio/wav
// Secret: GEMINI_API_KEY (Supabase > Edge Functions > Secrets)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STORY_MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash"];
const TTS_MODELS = ["gemini-2.5-flash-preview-tts", "gemini-2.5-flash-tts", "gemini-2.5-pro-preview-tts"];
const VOICE = Deno.env.get("GEMINI_VOICE") ?? "Sulafat";
const API = "https://generativelanguage.googleapis.com/v1beta/models/";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function clean(s: unknown, max = 60): string {
  return String(s ?? "").replace(/[^\p{L}\p{N} \-'.]/gu, "").slice(0, max).trim();
}

async function callGemini(models: string[], body: unknown, key: string) {
  let lastErr = "";
  for (const m of models) {
    const r = await fetch(`${API}${m}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });
    if (r.ok) return await r.json();
    lastErr = `${m}: ${r.status} ${(await r.text()).slice(0, 300)}`;
    // Nur bei "Modell nicht gefunden" das nächste Modell probieren
    if (r.status !== 404 && r.status !== 400) break;
  }
  throw new Error(lastErr);
}

function pcmToWav(pcm: Uint8Array, rate = 24000, channels = 1, bits = 16): Uint8Array {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  const byteRate = (rate * channels * bits) / 8;
  w(0, "RIFF"); v.setUint32(4, 36 + pcm.length, true); w(8, "WAVE");
  w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, channels, true); v.setUint32(24, rate, true);
  v.setUint32(28, byteRate, true); v.setUint16(32, (channels * bits) / 8, true);
  v.setUint16(34, bits, true); w(36, "data"); v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ error: "GEMINI_API_KEY fehlt (Supabase Secrets)" }, 500);

  let p: Record<string, unknown>;
  try { p = await req.json(); } catch { return json({ error: "Ungültiges JSON" }, 400); }

  try {
    if (p.mode === "story") {
      const hero = clean(p.hero), place = clean(p.place), item = clean(p.item), kid = clean(p.kid, 30);
      if (!hero || !place || !item) return json({ error: "Zutaten fehlen" }, 400);
      let prompt =
        "Erzähle auf Deutsch eine Gute-Nacht-Geschichte für einen sechsjährigen Jungen, der Autos und alles mit Rädern liebt. " +
        `Hauptfigur: ${hero}. Ort: ${place}. Wichtige Überraschung: ${item}. ` +
        "Länge: etwa 380 Wörter, also rund drei Minuten vorgelesen. " +
        "Kurze, einfache Sätze, freundlich und ein bisschen lustig, mit Fahrzeug-Geräuschen wie brumm oder tüt-tüt. " +
        "Nichts Gruseliges, keine Unfälle mit Verletzten. " +
        "Gegen Ende wird es langsam ruhig: Die Figur fährt nach Hause, macht die Scheinwerfer aus und schläft ein. ";
      if (kid) prompt += `Ein Junge namens ${kid} fährt als Beifahrer mit und hilft. `;
      if (p.jackpot) prompt += "Das ist eine Jackpot-Geschichte: Baue eine besonders lustige, glitzernde Überraschung ein. ";
      prompt += "Antworte nur mit der Geschichte selbst, ohne Überschrift, ohne Einleitung, ohne Markdown.";

      const r = await callGemini(STORY_MODELS, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.0, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
      }, key);
      const text = (r?.candidates?.[0]?.content?.parts ?? [])
        .map((x: { text?: string }) => x.text ?? "").join("").replace(/[*#_]/g, "").trim();
      if (!text) return json({ error: "Leere Geschichte" }, 502);
      return json({ text });
    }

    if (p.mode === "tts") {
      const text = String(p.text ?? "").slice(0, 1500).trim();
      if (!text) return json({ error: "Kein Text" }, 400);
      const r = await callGemini(TTS_MODELS, {
        contents: [{ parts: [{ text: "Lies ruhig, warm und langsam wie eine Gute-Nacht-Geschichte für ein Kind vor:\n\n" + text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
        },
      }, key);
      const part = r?.candidates?.[0]?.content?.parts?.find((x: { inlineData?: unknown }) => x.inlineData);
      const b64: string | undefined = part?.inlineData?.data;
      if (!b64) return json({ error: "Kein Audio erhalten" }, 502);
      const mime: string = part.inlineData.mimeType ?? "";
      const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
      const pcm = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return new Response(pcmToWav(pcm, rate), {
        headers: { ...CORS, "Content-Type": "audio/wav", "Cache-Control": "no-store" },
      });
    }

    return json({ error: "mode muss story oder tts sein" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 502);
  }
});
