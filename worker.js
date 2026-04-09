/**
 * ============================================================
 * LORD MILLION CLUB — WORKER 2: CONTENT ENGINE
 * ============================================================
 * FASE 0 — 100% GRATUITO
 * 
 * API usada: Google Gemini 2.5 Flash (FREE TIER)
 * - 1,500 requests/día gratis
 * - Sin tarjeta de crédito requerida
 * - Excelente calidad ES + EN
 * 
 * Separado COMPLETAMENTE del Worker 1 (señales/dashboard)
 * 
 * QUÉ HACE ESTE WORKER:
 * 1. Lee RSS de noticias financieras (cron cada 6 horas)
 * 2. Genera artículo completo ES + EN con tono LMC
 * 3. Genera post para X/Twitter, caption Instagram, script TikTok
 * 4. Detecta tema → embebe afiliado automáticamente
 * 5. Publica al blog (Cloudflare KV como base de datos)
 * 6. Envía a webhook para redes sociales (Buffer/Make)
 * 
 * ACTIVACIÓN:
 * - Manual: GET /generate?rss=crypto (para testing)
 * - Automático: Cron trigger cada 6 horas
 * - Dashboard: GET /articles para ver artículos guardados
 * ============================================================
 */

// ============================================================
// CONFIGURACIÓN — Variables de entorno (Cloudflare Secrets)
// ============================================================
// Configurar en: Workers > lmc-content-worker > Settings > Variables
// GEMINI_API_KEY     → Tu key de Google AI Studio (gratis)
// BUFFER_WEBHOOK     → URL webhook de Buffer (opcional fase 1)
// MAKE_WEBHOOK       → URL webhook de Make.com (opcional fase 1)

// ============================================================
// AFILIADOS — Tu configuración personal
// ============================================================
// IMPORTANTE: Reemplaza con tus códigos reales al registrarte

const AFFILIATES = {
  crypto: {
    binance: {
      name: "Binance",
      url: "https://www.binance.com/es/activity/referral-entry/CPA?ref=TU_CODIGO",
      bonus: "20% de descuento en fees",
      cta_es: "🚀 Crea tu cuenta en Binance GRATIS con mi código y obtén 20% de descuento",
      cta_en: "🚀 Create your FREE Binance account with my code and get 20% fee discount"
    },
    bybit: {
      name: "Bybit",
      url: "https://www.bybit.com/es-ES/invite?ref=TU_CODIGO",
      bonus: "Hasta $30,000 en bonos de bienvenida",
      cta_es: "💰 Únete a Bybit y recibe hasta $30,000 en bonos",
      cta_en: "💰 Join Bybit and get up to $30,000 in welcome bonuses"
    },
    coinbase: {
      name: "Coinbase",
      url: "https://coinbase.com/join/TU_CODIGO",
      bonus: "$10 en Bitcoin gratis",
      cta_es: "🎁 Obtén $10 en Bitcoin GRATIS al crear tu cuenta en Coinbase",
      cta_en: "🎁 Get $10 in FREE Bitcoin when you create your Coinbase account"
    },
    ledger: {
      name: "Ledger",
      url: "https://shop.ledger.com/es?r=TU_CODIGO",
      bonus: "Wallet física más segura del mercado",
      cta_es: "🔒 Protege tus cryptos con una wallet Ledger — la más segura del mundo",
      cta_en: "🔒 Protect your crypto with a Ledger wallet — the most secure in the world"
    }
  },
  stocks: {
    etoro: {
      name: "eToro",
      url: "https://www.etoro.com/people/TU_USUARIO",
      bonus: "Copy trading - copia a los mejores inversores",
      cta_es: "📈 Invierte en acciones con eToro — copia a los mejores traders automáticamente",
      cta_en: "📈 Invest in stocks with eToro — automatically copy the best traders"
    }
  },
  savings: {
    general: {
      cta_es: "💎 Únete al canal Telegram GRATUITO de Lord Million Club para más consejos exclusivos",
      cta_en: "💎 Join the FREE Lord Million Club Telegram channel for more exclusive tips"
    }
  }
};

// ============================================================
// RSS FEEDS — Fuentes de noticias financieras
// ============================================================

const RSS_FEEDS = {
  crypto: [
    "https://cointelegraph.com/rss",
    "https://coindesk.com/arc/outboundfeeds/rss/",
    "https://decrypt.co/feed"
  ],
  finance: [
    "https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US",
    "https://www.investing.com/rss/news.rss",
    "https://feeds.bloomberg.com/markets/news.rss"
  ],
  motivation: [
    // Frases y artículos motivacionales de finanzas
    "https://www.entrepreneur.com/latest.rss"
  ]
};

// ============================================================
// PROMPTS PARA GEMINI — El alma del contenido LMC
// ============================================================

function buildArticlePrompt(newsTitle, newsContent, language = "es") {
  const isEs = language === "es";

  return `Eres el redactor jefe de LORD MILLION CLUB, el club digital más exclusivo de educación financiera y motivación económica. Tu trabajo es transformar noticias financieras en contenido aspiracional, práctico y viral.

NOTICIA BASE:
Título: ${newsTitle}
Contenido: ${newsContent.substring(0, 800)}

GENERA UN ARTÍCULO COMPLETO EN ${isEs ? "ESPAÑOL" : "INGLÉS"} con este formato EXACTO:

===TITULO===
[Título potente, número o resultado + beneficio claro, max 70 caracteres]

===DESCRIPCION_SEO===
[Meta descripción SEO, 150-160 caracteres, incluye palabras clave]

===INTRO===
[2-3 párrafos de gancho. Empieza con una pregunta poderosa o dato sorprendente. Crea urgencia y FOMO. Conecta emocionalmente.]

===CUERPO===
[4-6 secciones con subtítulos. Contenido práctico paso a paso. Mezcla educación real con aspiración. Usa frases como "Los millonarios saben que...", "Lo que Wall Street no te dice...", "El secreto que el 1% usa..."]

===FRASE_CELEBRE===
[Una frase célebre real de un millonario famoso relacionada al tema. Formato: "Frase" — Nombre Apellido]

===CONCLUSION===
[Párrafo motivador que conecte la noticia con el lector. Invita a tomar acción HOY.]

===POST_TWITTER===
[Tweet de máximo 270 caracteres. Impactante, con emoji, hashtags: #LordMillionClub #Crypto #Finanzas #Riqueza]

===CAPTION_INSTAGRAM===
[Caption Instagram 150-200 palabras. Hook fuerte primera línea. Emojis estratégicos. Call to action. Hashtags al final: #LordMillionClub #Millonarios #EducacionFinanciera #Crypto #Inversiones #LibertadFinanciera]

===SCRIPT_TIKTOK===
[Script de 45-60 segundos. Formato:
HOOK (0-3s): [Frase que detiene el scroll]
PROBLEMA (3-10s): [El dolor/problema del espectador]
SOLUCIÓN (10-40s): [3 puntos clave, dinámico]
CTA (40-60s): [Invita a seguir y al grupo Telegram]]

===PALABRAS_CLAVE===
[5-8 palabras clave SEO separadas por comas]

===TEMA_DETECTADO===
[Una sola palabra: CRYPTO, ACCIONES, AHORRO, HIPOTECA, LUJO, TRADING, MOTIVACION, ECONOMIA]

Tono: Aspiracional pero accesible. Exclusivo pero no elitista. Como un mentor millonario que comparte sus secretos. Nunca condescendiente.`;
}

// ============================================================
// FUNCIÓN: Llamar a Gemini API (GRATIS)
// ============================================================

async function callGemini(prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,        // Creatividad equilibrada
        maxOutputTokens: 2048,   // Artículo completo
        topP: 0.95
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ============================================================
// FUNCIÓN: Parsear respuesta de Gemini
// ============================================================

function parseGeminiResponse(text) {
  const extract = (tag) => {
    const regex = new RegExp(`====${tag}====([\\s\\S]*?)(?====|$)`);
    // Try with = signs
    const r1 = new RegExp(`===${tag}===([\\s\\S]*?)(?====|$)`);
    const match = text.match(r1);
    return match ? match[1].trim() : "";
  };

  return {
    title:         extract("TITULO"),
    seoDesc:       extract("DESCRIPCION_SEO"),
    intro:         extract("INTRO"),
    body:          extract("CUERPO"),
    quote:         extract("FRASE_CELEBRE"),
    conclusion:    extract("CONCLUSION"),
    tweet:         extract("POST_TWITTER"),
    instagram:     extract("CAPTION_INSTAGRAM"),
    tiktok:        extract("SCRIPT_TIKTOK"),
    keywords:      extract("PALABRAS_CLAVE"),
    topic:         extract("TEMA_DETECTADO").toUpperCase().trim()
  };
}

// ============================================================
// FUNCIÓN: Seleccionar afiliado según tema
// ============================================================

function getAffiliate(topic, language = "es") {
  const isEs = language === "es";
  const telegramCTA = isEs
    ? "\n\n🔔 **Únete al canal Telegram GRATUITO de Lord Million Club** → t.me/lordmillionclub"
    : "\n\n🔔 **Join the FREE Lord Million Club Telegram channel** → t.me/lordmillionclub";

  switch (topic) {
    case "CRYPTO":
    case "TRADING":
      const aff = AFFILIATES.crypto.binance;
      return {
        platform: aff.name,
        url: aff.url,
        cta: isEs ? aff.cta_es : aff.cta_en,
        telegram: telegramCTA,
        secondary: isEs
          ? `\n💡 ¿Ya tienes crypto? Protégela con una [wallet Ledger](${AFFILIATES.crypto.ledger.url})`
          : `\n💡 Already have crypto? Protect it with a [Ledger wallet](${AFFILIATES.crypto.ledger.url})`
      };
    case "ACCIONES":
      return {
        platform: "eToro",
        url: AFFILIATES.stocks.etoro.url,
        cta: isEs ? AFFILIATES.stocks.etoro.cta_es : AFFILIATES.stocks.etoro.cta_en,
        telegram: telegramCTA,
        secondary: ""
      };
    default:
      return {
        platform: "Telegram LMC",
        url: "https://t.me/lordmillionclub",
        cta: isEs ? AFFILIATES.savings.general.cta_es : AFFILIATES.savings.general.cta_en,
        telegram: telegramCTA,
        secondary: ""
      };
  }
}

// ============================================================
// FUNCIÓN: Leer RSS y obtener noticias
// ============================================================

async function fetchRSSNews(category = "crypto") {
  const feeds = RSS_FEEDS[category] || RSS_FEEDS.crypto;
  const feed = feeds[Math.floor(Math.random() * feeds.length)];

  try {
    const response = await fetch(feed, {
      headers: { "User-Agent": "LordMillionClub/1.0" }
    });
    const text = await response.text();

    // Parsear XML del RSS manualmente (sin dependencias)
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(text)) !== null && items.length < 5) {
      const item = match[1];
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                     item.match(/<title>(.*?)<\/title>/))?.[1] || "";
      const desc  = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                     item.match(/<description>(.*?)<\/description>/))?.[1] || "";
      const link  = item.match(/<link>(.*?)<\/link>/)?.[1] || "";

      if (title) {
        items.push({
          title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
          description: desc.replace(/<[^>]*>/g, "").substring(0, 500),
          link
        });
      }
    }

    return items.length > 0 ? items : [{ 
      title: "Las mejores estrategias de inversión para 2026",
      description: "Los expertos recomiendan diversificar en crypto, acciones y activos alternativos.",
      link: ""
    }];
  } catch (err) {
    // Fallback si el RSS falla
    return [{
      title: "Por qué los millonarios invierten diferente al 99% de las personas",
      description: "La mentalidad y estrategia que separa a los ricos del resto.",
      link: ""
    }];
  }
}

// ============================================================
// FUNCIÓN: Guardar artículo en KV (base de datos gratuita)
// ============================================================

async function saveArticle(env, article) {
  const id = `article_${Date.now()}`;
  const articleData = JSON.stringify({
    id,
    createdAt: new Date().toISOString(),
    ...article
  });

  // Guardar artículo individual
  await env.LMC_ARTICLES.put(id, articleData, {
    expirationTtl: 60 * 60 * 24 * 90 // 90 días
  });

  // Actualizar índice de artículos
  try {
    const indexRaw = await env.LMC_ARTICLES.get("index");
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    index.unshift({ id, title: article.es?.title || "", createdAt: article.createdAt });
    // Mantener solo los últimos 100 artículos en el índice
    if (index.length > 100) index.pop();
    await env.LMC_ARTICLES.put("index", JSON.stringify(index));
  } catch (e) {
    // Si falla el índice, no es crítico
    console.error("Index update failed:", e);
  }

  return id;
}

// ============================================================
// FUNCIÓN: Enviar a webhook (Buffer, Make.com, etc.)
// ============================================================

async function sendToWebhook(env, content) {
  const webhookUrl = env.MAKE_WEBHOOK || env.BUFFER_WEBHOOK;
  if (!webhookUrl) return; // Si no hay webhook configurado, saltar

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "lord-million-club",
        timestamp: new Date().toISOString(),
        ...content
      })
    });
  } catch (e) {
    console.error("Webhook failed (non-critical):", e);
  }
}

// ============================================================
// FUNCIÓN PRINCIPAL: Generar artículo completo
// ============================================================

async function generateArticle(env, category = "crypto") {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada en Variables de entorno");

  // 1. Obtener noticia del RSS
  const news = await fetchRSSNews(category);
  const selectedNews = news[Math.floor(Math.random() * Math.min(news.length, 3))];

  console.log(`📰 Noticia seleccionada: ${selectedNews.title}`);

  // 2. Generar contenido en ESPAÑOL
  const promptES = buildArticlePrompt(selectedNews.title, selectedNews.description, "es");
  const rawES = await callGemini(promptES, apiKey);
  const parsedES = parseGeminiResponse(rawES);

  // 3. Generar contenido en INGLÉS
  const promptEN = buildArticlePrompt(selectedNews.title, selectedNews.description, "en");
  const rawEN = await callGemini(promptEN, apiKey);
  const parsedEN = parseGeminiResponse(rawEN);

  // 4. Seleccionar afiliado según tema detectado
  const topic = parsedES.topic || "CRYPTO";
  const affiliateES = getAffiliate(topic, "es");
  const affiliateEN = getAffiliate(topic, "en");

  // 5. Construir artículo final con afiliado embebido
  const articleES = {
    ...parsedES,
    fullArticle: `# ${parsedES.title}\n\n${parsedES.intro}\n\n${parsedES.body}\n\n> ${parsedES.quote}\n\n${parsedES.conclusion}\n\n---\n\n### 🚀 Acción Inmediata\n\n${affiliateES.cta}\n👉 [${affiliateES.platform}](${affiliateES.url})\n${affiliateES.secondary}${affiliateES.telegram}`,
    affiliate: affiliateES,
    lang: "es"
  };

  const articleEN = {
    ...parsedEN,
    fullArticle: `# ${parsedEN.title}\n\n${parsedEN.intro}\n\n${parsedEN.body}\n\n> ${parsedEN.quote}\n\n${parsedEN.conclusion}\n\n---\n\n### 🚀 Take Action Now\n\n${affiliateEN.cta}\n👉 [${affiliateEN.platform}](${affiliateEN.url})\n${affiliateEN.secondary}${affiliateEN.telegram}`,
    affiliate: affiliateEN,
    lang: "en"
  };

  const finalArticle = {
    sourceNews: selectedNews,
    topic,
    category,
    createdAt: new Date().toISOString(),
    es: articleES,
    en: articleEN,
    // Contenido listo para redes sociales
    social: {
      tweet_es: parsedES.tweet,
      tweet_en: parsedEN.tweet,
      instagram_es: parsedES.instagram,
      instagram_en: parsedEN.instagram,
      tiktok_es: parsedES.tiktok,
      tiktok_en: parsedEN.tiktok
    }
  };

  // 6. Guardar en KV
  const articleId = await saveArticle(env, finalArticle);
  finalArticle.id = articleId;

  // 7. Enviar a webhook para redes sociales
  await sendToWebhook(env, {
    articleId,
    topic,
    tweet_es: parsedES.tweet,
    tweet_en: parsedEN.tweet,
    instagram_es: parsedES.instagram,
    tiktok_script_es: parsedES.tiktok
  });

  console.log(`✅ Artículo generado y guardado: ${articleId}`);
  return finalArticle;
}

// ============================================================
// ROUTER HTTP — Endpoints del Worker
// ============================================================

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const category = url.searchParams.get("rss") || "crypto";

  // CORS headers para acceso desde el dashboard
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  };

  // OPTIONS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    // ── GET /generate → Genera un artículo manualmente (testing)
    if (path === "/generate" && request.method === "GET") {
      const article = await generateArticle(env, category);
      return new Response(JSON.stringify({
        success: true,
        message: "✅ Artículo generado correctamente",
        id: article.id,
        topic: article.topic,
        titles: {
          es: article.es.title,
          en: article.en.title
        },
        preview: {
          es: article.es.fullArticle.substring(0, 300) + "...",
          en: article.en.fullArticle.substring(0, 300) + "..."
        },
        social: article.social
      }, null, 2), { headers });
    }

    // ── GET /articles → Lista los artículos guardados
    if (path === "/articles" && request.method === "GET") {
      const indexRaw = await env.LMC_ARTICLES.get("index");
      const index = indexRaw ? JSON.parse(indexRaw) : [];
      return new Response(JSON.stringify({
        success: true,
        total: index.length,
        articles: index
      }, null, 2), { headers });
    }

    // ── GET /article/:id → Ver artículo específico completo
    if (path.startsWith("/article/") && request.method === "GET") {
      const id = path.replace("/article/", "");
      const raw = await env.LMC_ARTICLES.get(id);
      if (!raw) {
        return new Response(JSON.stringify({ error: "Artículo no encontrado" }), {
          status: 404, headers
        });
      }
      return new Response(raw, { headers });
    }

    // ── GET /status → Estado del Worker
    if (path === "/status") {
      return new Response(JSON.stringify({
        status: "✅ Lord Million Club Content Worker — ACTIVO",
        version: "1.0.0",
        api: "Google Gemini 2.5 Flash (FREE)",
        endpoints: [
          "GET /generate?rss=crypto  → Genera artículo",
          "GET /generate?rss=finance → Artículo finanzas",
          "GET /articles             → Lista artículos",
          "GET /article/:id          → Ver artículo",
          "GET /status               → Este mensaje"
        ],
        affiliates_configured: Object.keys(AFFILIATES.crypto).length,
        note: "Cron automático: cada 6 horas"
      }, null, 2), { headers });
    }

    // 404 default
    return new Response(JSON.stringify({
      error: "Endpoint no encontrado",
      available: ["/status", "/generate", "/articles", "/article/:id"]
    }), { status: 404, headers });

  } catch (err) {
    console.error("Worker error:", err);
    return new Response(JSON.stringify({
      error: err.message,
      hint: "Verifica que GEMINI_API_KEY esté configurada en Variables de entorno"
    }), { status: 500, headers });
  }
}

// ============================================================
// CRON — Se ejecuta automáticamente cada 6 horas
// ============================================================

async function handleCron(event, env) {
  const categories = ["crypto", "finance", "crypto"]; // crypto 2x = más peso
  const category = categories[Math.floor(Math.random() * categories.length)];

  console.log(`⏰ Cron ejecutado: generando artículo de categoría "${category}"`);

  try {
    const article = await generateArticle(env, category);
    console.log(`✅ Cron completado: ${article.id} — ${article.es.title}`);
  } catch (err) {
    console.error("❌ Cron error:", err.message);
  }
}

// ============================================================
// EXPORT — Entry point de Cloudflare Worker
// ============================================================

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(event, env));
  }
};
