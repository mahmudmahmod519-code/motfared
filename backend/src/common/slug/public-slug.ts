/**
 * Ported unchanged from the original (backend/src/public-links.js); its tests are in public-slug.spec.ts.
 *
 * The readable name in a doctor's two public addresses.
 *
 *   /dr/karim-naim           the registration link that goes into the ads
 *   /dr/karim-naim/clinic    the clinic's own page, behind its password
 *
 * Both are printed, forwarded and read aloud, so the string has to survive being typed by
 * hand off a phone screen: lower case only, Latin letters and digits, single hyphens.
 *
 * It is typed by an admin, not derived from the name. Transliterating "د. كريم نعيم"
 * automatically gives something nobody would choose to put on an advert, and this is the
 * one thing a stranger reads before deciding whether the page is real. [[suggestSlug]]
 * offers a starting point and the admin edits it.
 *
 * Its own module because it is pure and because a wrong answer here is public: a slug that
 * slips through and collides with a route takes a doctor's link down, and one that a phone
 * keyboard cannot produce takes their ad down.
 */

export const MIN_SLUG = 3;
export const MAX_SLUG = 40;

/**
 * Addresses that must never belong to a doctor.
 *
 * The /dr/ prefix already keeps these away from the app's own routes, so this is not
 * about collisions - it is about a link that reads as something it is not. `/dr/admin`
 * and `/dr/login` invite a stranger to type a password into a lead form.
 */
export const RESERVED_SLUGS = new Set<string>([
  "admin", "api", "app", "clinic", "dashboard", "dr", "help", "login", "logout",
  "me", "my", "new", "settings", "signin", "signup", "static", "support", "www",
]);

/**
 * The names that actually turn up on Egyptian clinic doors, spelled the way their owners
 * spell them in Latin.
 *
 * Letter-by-letter transliteration cannot do this: Arabic does not write short vowels, so
 * كريم comes out "krym" and محمود comes out "mhmwd". A suggestion that bad is worse than
 * none - an admin in a hurry accepts it and a doctor's advert carries it for a year. This
 * covers the common case; anything else falls through to the letters below and is edited.
 */
const KNOWN_NAMES: Record<string, string> = {
  محمد: "mohamed", أحمد: "ahmed", احمد: "ahmed", محمود: "mahmoud", مصطفى: "mostafa",
  كريم: "karim", خالد: "khaled", عمرو: "amr", علي: "ali", حسن: "hassan", حسين: "hussein",
  إبراهيم: "ibrahim", ابراهيم: "ibrahim", يوسف: "youssef", عمر: "omar", طارق: "tarek",
  شريف: "sherif", هشام: "hesham", وليد: "walid", سامح: "sameh", ماجد: "maged",
  أمير: "amir", امير: "amir", رامي: "ramy", سيد: "sayed", صلاح: "salah", فتحي: "fathy",
  نبيل: "nabil", عادل: "adel", سمير: "samir", ياسر: "yasser", مازن: "mazen",
  نعيم: "naim", عفيفي: "afifi", البغدادي: "elbaghdady", الشاذلي: "elshazly",
  فاطمة: "fatma", مريم: "mariam", نورا: "noura", سارة: "sara", ياسمين: "yasmin",
  دينا: "dina", رانيا: "rania", هبة: "heba", شيماء: "shaimaa", منى: "mona",
  رنا: "rana", إيمان: "eman", ايمان: "eman", شروق: "shorouk", حنان: "hanan",
  إيناس: "enas", ايناس: "enas", رشدي: "roshdy", جمال: "gamal", زكي: "zaki",
  كمال: "kamal", كامل: "kamel", زياد: "ziad", حمزة: "hamza", سليم: "selim", عبدالله: "abdallah", الحبشي: "elhabashy",
  الجداوي: "elgedawy", ايمن: "ayman", أيمن: "ayman", ياسين: "yassin", عاطف: "atef", صابر: "saber",
};

/** Arabic letters to the Latin an Egyptian would recognise. Only ever used for a suggestion. */
const ARABIC_TO_LATIN: Record<string, string> = {
  ا: "a", أ: "a", إ: "e", آ: "a", ب: "b", ت: "t", ث: "th", ج: "g", ح: "h", خ: "kh",
  د: "d", ذ: "z", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z",
  ع: "a", غ: "gh", ف: "f", ق: "k", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", ة: "a",
  و: "w", ي: "y", ى: "a", ئ: "y", ء: "", ؤ: "w",
};

/**
 * The slug as it will be stored, or null when the input cannot make a usable one.
 *
 * Deliberately strict rather than forgiving: silently turning "Dr Karim!!" into
 * "dr-karim" would leave an admin looking at an address they did not write. Anything with
 * a character that cannot survive is refused, and the admin is told which.
 */
export function normaliseSlug(input: unknown): string | null {
  const raw = String(input == null ? "" : input).trim().toLowerCase();
  if (!raw) return null;
  // Spaces and underscores become the hyphen people expect in a web address.
  const dashed = raw.replace(/[\s_]+/g, "-");
  if (!/^[a-z0-9-]+$/.test(dashed)) return null;
  const clean = dashed.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  if (clean.length < MIN_SLUG || clean.length > MAX_SLUG) return null;
  // A slug of digits alone reads as an id, not a name, and invites guessing the next one.
  if (/^\d+$/.test(clean)) return null;
  return clean;
}

/** Why a slug was refused, in the words the admin needs to fix it. */
export function slugError(input: unknown): string | null {
  const raw = String(input == null ? "" : input).trim();
  if (!raw) return "اكتب اسم اللينك";
  const dashed = raw.toLowerCase().replace(/[\s_]+/g, "-");
  if (/[؀-ۿ]/.test(dashed)) return "اللينك لازم يكون بحروف إنجليزي - الاسم العربي مش بيظهر صح في اللينكات";
  if (!/^[a-z0-9-]+$/.test(dashed)) return "حروف إنجليزي وأرقام وشرطة (-) بس";
  const clean = dashed.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  if (clean.length < MIN_SLUG) return `اللينك قصير أوي - ${MIN_SLUG} حروف على الأقل`;
  if (clean.length > MAX_SLUG) return `اللينك طويل أوي - ${MAX_SLUG} حرف كحد أقصى`;
  if (/^\d+$/.test(clean)) return "اللينك مينفعش يكون أرقام بس";
  if (RESERVED_SLUGS.has(clean)) return `"${clean}" محجوز - اختار اسم تاني`;
  return null;
}

/** Whether a normalised slug is one an admin may keep. */
export function isReserved(slug: unknown): boolean {
  return RESERVED_SLUGS.has(String(slug || "").toLowerCase());
}

/**
 * A starting point from the doctor's own name, for the admin to accept or rewrite.
 *
 * Drops the "د." / "دكتور" title: it is on every one of them, so keeping it makes every
 * link start with the same three characters and tells a reader nothing.
 */
export function suggestSlug(name: unknown): string | null {
  // "دكتور" before "د", or the alternation matches the bare letter first and leaves "كتور"
  // glued to the front of every suggestion. "عيادة" goes too: a clinic listed under its
  // own name ("عيادة الجداوي") would otherwise start its link with "ayada-".
  const withoutTitle = String(name || "")
    .replace(/^\s*(عيادة|دكتورة|دكتور|doctor|dr\.?|د\.?)\s*/i, "")
    .trim();
  const latin = withoutTitle
    .split(/\s+/)
    .filter(Boolean)
    .map((word: string) => {
      const bare = word.replace(/[.,؟!]/g, "");
      if (Object.prototype.hasOwnProperty.call(KNOWN_NAMES, bare)) return KNOWN_NAMES[bare];
      return [...bare]
        .map((ch: string) => {
          if (/[a-zA-Z0-9]/.test(ch)) return ch.toLowerCase();
          if (Object.prototype.hasOwnProperty.call(ARABIC_TO_LATIN, ch)) return ARABIC_TO_LATIN[ch];
          // Arabic diacritics and anything else are dropped rather than guessed at.
          return "";
        })
        .join("");
    })
    .join("-");
  const slug = normaliseSlug(latin);
  if (!slug || isReserved(slug)) return null;
  return slug;
}

