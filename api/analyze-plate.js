/* ==========================================================================
   Analyse photo d'une assiette → aliments, grammes, macros.
   Version gratuite : Google Gemini (offre gratuite, sans carte bancaire).

   Le téléphone envoie une photo déjà réduite (≤ 1280 px, JPEG) et la liste
   des noms de sa bibliothèque locale. Gemini identifie chaque composant,
   estime la portion et, quand un aliment correspond à la bibliothèque,
   renvoie son nom exact : l'app utilise alors ses propres valeurs vérifiées.

   Variables d'environnement Vercel (Settings → Environment Variables) :
     GEMINI_API_KEY   (obligatoire) — clé gratuite sur aistudio.google.com
     PLATE_SCAN_KEY   (optionnelle) — si définie, l'app doit envoyer la même
                      valeur dans l'en-tête x-scan-key.
     GEMINI_MODEL     (optionnelle) — pour forcer un autre modèle.
   ========================================================================== */

const MAX_IMAGE_B64 = 4_000_000; /* ~3 Mo d'image, sous la limite Vercel de 4,5 Mo par requête */
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"];
/* Le premier modèle qui répond est utilisé ; le second sert de secours
   si Google retire ou renomme le premier. Les deux sont gratuits. */
const MODELS = [process.env.GEMINI_MODEL, "gemini-3.8-flash", "gemini-2.5-flash"].filter(Boolean);

const SCHEMA = {
  type: "OBJECT",
  required: ["is_food", "dish", "items", "note"],
  properties: {
    is_food: { type: "BOOLEAN" },
    dish: { type: "STRING" },
    note: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["name", "library_match", "grams", "kcal_100g", "protein_100g",
                   "fat_100g", "carbs_100g", "confidence", "excluded"],
        properties: {
          name: { type: "STRING" },
          library_match: { type: "STRING" },
          grams: { type: "NUMBER" },
          kcal_100g: { type: "NUMBER" },
          protein_100g: { type: "NUMBER" },
          fat_100g: { type: "NUMBER" },
          carbs_100g: { type: "NUMBER" },
          confidence: { type: "STRING", enum: ["haute", "moyenne", "basse"] },
          excluded: { type: "BOOLEAN" }
        }
      }
    }
  }
};

const SYSTEM = `Tu estimes le contenu nutritionnel d'une assiette à partir d'une photo, pour une app de prise de masse utilisée en France.

Pour chaque composant visible :
- name : nom court en français, tel qu'on l'écrirait dans un carnet alimentaire (« Riz basmati cuit », « Blanc de poulet grillé »).
- library_match : si un nom de la bibliothèque fournie désigne le même aliment dans le même état (cru/cuit), recopie-le exactement, caractère pour caractère. Sinon chaîne vide. Ne force pas une correspondance approximative.
- grams : poids tel que servi (cuit si cuit). Sers-toi de l'assiette (≈ 26 cm pour une assiette plate, ≈ 20 cm pour une assiette à dessert), des couverts et de l'épaisseur des aliments comme échelle. Pour une boisson, donne des millilitres.
- *_100g : valeurs pour 100 g de l'aliment tel que servi, cohérentes avec les tables CIQUAL/USDA.
- confidence : ta confiance sur la portion (haute / moyenne / basse).
- excluded : true si c'est du poisson, un fruit de mer ou un champignon (l'utilisateur n'en mange pas).

Sépare les composants quand ils sont distincts (viande, féculent, légume, sauce). Un plat composé où on ne distingue pas les ingrédients (lasagnes, burger) peut rester un seul élément.
Compte la matière grasse de cuisson ou la sauce quand elle est visible (brillance, flaque) comme un élément à part, par exemple « Huile de cuisson ». N'invente pas ce qui n'est pas visible.
dish : nom du plat en quelques mots.
note : une ou deux phrases utiles au plus (ce qui rend l'estimation incertaine, calories cachées probables). Chaîne vide si rien à signaler.
Si la photo ne montre pas de nourriture, is_food = false et items vide.`;

async function callGemini(model, key, body) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) }
  );
  let j = null;
  try { j = await r.json(); } catch { /* corps vide ou non JSON */ }
  return { status: r.status, j };
}

export default async function handler(req, res) {
  const json = (status, out) => { res.setHeader("cache-control", "no-store"); res.status(status).json(out); };
  if (req.method !== "POST") return json(405, { error: "method" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(500, { error: "no_api_key" });

  const lock = process.env.PLATE_SCAN_KEY;
  if (lock && req.headers["x-scan-key"] !== lock) return json(401, { error: "scan_key" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== "object") return json(400, { error: "bad_json" });

  const image = typeof body.image === "string" ? body.image : "";
  const mediaType = MEDIA_TYPES.includes(body.mediaType) ? body.mediaType : "image/jpeg";
  if (!image || image.length > MAX_IMAGE_B64) return json(400, { error: "bad_image" });

  const library = Array.isArray(body.library)
    ? body.library.filter((n) => typeof n === "string").slice(0, 800).map((n) => n.slice(0, 80))
    : [];
  const hint = typeof body.hint === "string" ? body.hint.trim().slice(0, 300) : "";

  const text =
    "Bibliothèque de l'utilisateur (noms exacts) :\n" +
    (library.length ? library.join("\n") : "(vide)") +
    (hint ? `\n\nPrécision de l'utilisateur sur ce repas : ${hint}` : "") +
    "\n\nAnalyse l'assiette de la photo.";

  const request = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [
      { inline_data: { mime_type: mediaType, data: image } },
      { text }
    ] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.2 }
  };

  try {
    let r = null;
    for (const model of MODELS) {
      r = await callGemini(model, key, request);
      if (r.status !== 404) break;               /* modèle inconnu : on essaie le suivant */
    }
    const err = r.j && r.j.error;
    if (r.status === 429) return json(429, { error: "rate" });
    if (r.status === 400 && err && /API key/i.test(err.message || "")) return json(500, { error: "bad_api_key" });
    if (r.status === 401 || r.status === 403) return json(500, { error: "bad_api_key" });
    if (r.status !== 200) {
      console.error("Gemini", r.status, err && err.message);
      return json(502, { error: "api", status: r.status });
    }

    if (r.j.promptFeedback && r.j.promptFeedback.blockReason) return json(422, { error: "refusal" });
    const cand = r.j.candidates && r.j.candidates[0];
    if (!cand) return json(502, { error: "empty" });
    if (cand.finishReason === "SAFETY") return json(422, { error: "refusal" });
    if (cand.finishReason === "MAX_TOKENS") return json(502, { error: "truncated" });

    const out = ((cand.content && cand.content.parts) || []).map((p) => p.text || "").join("")
      .replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
    if (!out) return json(502, { error: "empty" });
    return json(200, JSON.parse(out));
  } catch (e) {
    if (e instanceof SyntaxError) return json(502, { error: "parse" });
    console.error(e);
    return json(500, { error: "server" });
  }
}
