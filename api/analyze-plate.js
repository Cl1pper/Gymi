/* ==========================================================================
   Analyse photo d'une assiette → aliments, grammes, macros.

   Le téléphone envoie une photo déjà réduite (≤ 1280 px, JPEG) et la liste
   des noms de sa bibliothèque locale. Claude identifie chaque composant,
   estime la portion et, quand un aliment correspond à la bibliothèque,
   renvoie son nom exact : l'app utilise alors ses propres valeurs vérifiées
   plutôt que l'estimation.

   Variables d'environnement Vercel (Settings → Environment Variables) :
     ANTHROPIC_API_KEY  (obligatoire)
     PLATE_SCAN_KEY     (optionnelle) — si définie, l'app doit envoyer la même
                        valeur dans l'en-tête x-scan-key. Évite qu'un inconnu
                        qui trouve l'URL consomme ton crédit API.
   ========================================================================== */
import Anthropic from "@anthropic-ai/sdk";


const MAX_IMAGE_B64 = 4_000_000; /* ~3 Mo d'image, sous la limite Vercel de 4,5 Mo par requête */
const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_food", "dish", "items", "note"],
  properties: {
    is_food: { type: "boolean" },
    dish: { type: "string" },
    note: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "library_match", "grams", "kcal_100g", "protein_100g",
                   "fat_100g", "carbs_100g", "confidence", "excluded"],
        properties: {
          name: { type: "string" },
          library_match: { type: "string" },
          grams: { type: "number" },
          kcal_100g: { type: "number" },
          protein_100g: { type: "number" },
          fat_100g: { type: "number" },
          carbs_100g: { type: "number" },
          confidence: { type: "string", enum: ["haute", "moyenne", "basse"] },
          excluded: { type: "boolean" }
        }
      }
    }
  }
}

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


export default async function handler(req, res) {
  const json = (status, out) => { res.setHeader("cache-control", "no-store"); res.status(status).json(out); };
  if (req.method !== "POST") return json(405, { error: "method" });

  if (!process.env.ANTHROPIC_API_KEY) return json(500, { error: "no_api_key" });

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

  const client = new Anthropic();

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: SCHEMA }
      },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          { type: "text", text }
        ]
      }]
    });

    if (response.stop_reason === "refusal") return json(422, { error: "refusal" });
    if (response.stop_reason === "max_tokens") return json(502, { error: "truncated" });

    const out = response.content.find((b) => b.type === "text");
    if (!out) return json(502, { error: "empty" });

    return json(200, JSON.parse(out.text));
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json(429, { error: "rate" });
    if (err instanceof Anthropic.AuthenticationError) return json(500, { error: "bad_api_key" });
    if (err instanceof Anthropic.APIError) return json(502, { error: "api", status: err.status });
    if (err instanceof SyntaxError) return json(502, { error: "parse" });
    console.error(err);
    return json(500, { error: "server" });
  }
}
