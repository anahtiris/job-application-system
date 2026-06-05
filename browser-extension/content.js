/**
 * Runs at document_idle as a warm-up cache.
 * popup.js re-injects extractJobData() fresh on open so LinkedIn's
 * async React content is guaranteed to be in the DOM.
 */

function extractJobData() {
  // ── helpers ────────────────────────────────────────────────────────────────
  function getMeta(name) {
    const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
    return (el && el.getAttribute("content")) || "";
  }

  function text(el) {
    return el ? el.textContent.trim() : "";
  }

  function first(...candidates) {
    for (const c of candidates) {
      if (c && c.length > 0 && c.length < 120) return c;
    }
    return "";
  }

  // ── language detection (text-based, no user input) ─────────────────────────
  function detectLanguage(sampleText) {
    // 1. html lang attribute
    const htmlLang = document.documentElement.lang || "";
    if (htmlLang.toLowerCase().startsWith("de")) return "de";

    // 2. Count German-specific characters in the JD text
    const sample = sampleText.slice(0, 1500);
    const germanChars = (sample.match(/[äöüÄÖÜß]/g) || []).length;
    if (germanChars >= 4) return "de";

    // 3. Common German function words that don't appear in English
    const germanWords = /\b(und|die|der|das|Sie|wir|mit|für|ein|des|ist|als|von|auf|bei|nach|wird|sind|eine|sich|auch|durch|oder|wenn|diese|werden|haben|kann|sowie|Ihre|unser|unsere|Wir)\b/;
    const matches = sample.match(new RegExp(germanWords.source, "g")) || [];
    if (matches.length >= 5) return "de";

    return "en";
  }

  // ── company ────────────────────────────────────────────────────────────────
  function extractCompany() {
    // LinkedIn: title is "Job Title at Company | LinkedIn"
    const pageTitle = document.title;
    if (pageTitle && /linkedin\.com/i.test(window.location.hostname)) {
      const atMatch = pageTitle.match(/\bat\s+(.+?)\s*[|\-]/);
      if (atMatch) return atMatch[1].trim();
      // Fallback: company in subtitle below job title
      const subtitle = document.querySelector(
        ".job-details-jobs-unified-top-card__company-name a, " +
        ".jobs-unified-top-card__company-name a, " +
        ".topcard__org-name-link, " +
        "a[data-tracking-control-name='public_jobs_topcard-org-name']"
      );
      if (subtitle) return text(subtitle);
      // Second fallback: h3 or h4 in the top card that isn't the job title
      const h3 = document.querySelector(".jobs-unified-top-card h3, .job-details-jobs-unified-top-card h3");
      if (h3) return text(h3);
    }

    // StepStone
    const stepstone = document.querySelector("[data-at='job-header-company-name']");
    if (stepstone) return text(stepstone);

    // Indeed
    const indeed = document.querySelector(
      "[data-testid='inlineHeader-companyName'] a, " +
      "[data-testid='inlineHeader-companyName']"
    );
    if (indeed) return text(indeed);

    // Xing/kununu
    const xing = document.querySelector("[data-qa='company-name']");
    if (xing) return text(xing);

    // Arbeitsagentur
    const ba = document.querySelector(".jobdetails-arbeitgeber, .company-name");
    if (ba) return text(ba);

    // Generic: og:site_name (skip if it's a platform name)
    const siteName = getMeta("og:site_name");
    const platformNames = /^(linkedin|indeed|stepstone|xing|glassdoor|monster|jobs)/i;
    if (siteName && !platformNames.test(siteName) && siteName.length < 60) return siteName;

    // Last resort: last segment of page title after | or —
    if (pageTitle) {
      const parts = pageTitle.split(/[\|–—]/);
      if (parts.length > 1) return parts[parts.length - 1].trim();
    }
    return "";
  }

  // ── job title ──────────────────────────────────────────────────────────────
  function extractJobTitle() {
    // LinkedIn: title tag "Job Title at Company | LinkedIn" → take the part before " at "
    if (/linkedin\.com/i.test(window.location.hostname)) {
      const pageTitle = document.title;
      const atMatch = pageTitle.match(/^(.+?)\s+at\s+.+?(?:\s*\||\s*$)/);
      if (atMatch) return atMatch[1].trim();

      const h1 = document.querySelector(
        ".job-details-jobs-unified-top-card__job-title h1, " +
        ".jobs-unified-top-card__job-title, " +
        ".topcard__title, " +
        "h1.t-24"
      );
      if (h1) return text(h1);
    }

    // og:title: strip " at Company", " | Platform", " - Platform"
    const ogTitle = getMeta("og:title");
    if (ogTitle) {
      const cleaned = ogTitle
        .replace(/\s+(at|bei|@)\s+.+$/i, "")
        .replace(/\s*[\|–\-]\s*(LinkedIn|Indeed|StepStone|Xing|Glassdoor).*/i, "")
        .trim();
      if (cleaned && cleaned.length < 120) return cleaned;
    }

    // StepStone
    const stepstone = document.querySelector("[data-at='job-header-title']");
    if (stepstone) return text(stepstone);

    // Indeed
    const indeed = document.querySelector(
      "[data-testid='jobsearch-JobInfoHeader-title'], " +
      "h1.jobsearch-JobInfoHeader-title"
    );
    if (indeed) return text(indeed);

    // Xing
    const xing = document.querySelector("[data-qa='job-title']");
    if (xing) return text(xing);

    // Generic h1
    const h1 = document.querySelector("h1");
    return h1 ? text(h1) : "";
  }

  // ── job description ────────────────────────────────────────────────────────
  function extractJobDescription() {
    const selectors = [
      // LinkedIn (multiple variants across versions)
      "#job-details",
      ".jobs-description__content",
      ".jobs-description-content__text--stretch",
      ".jobs-description-content__text",
      ".jobs-box__html-content",
      // Indeed
      "#jobDescriptionText",
      // StepStone
      "[data-at='job-description']",
      "[data-testid='job-description']",
      // Xing
      "[data-qa='job-description']",
      // Arbeitsagentur
      ".jobsnippet-text",
      "[id='detail-content']",
      // Generic
      "[class*='job-description']:not(h1):not(h2)",
      "[class*='jobDescription']:not(h1):not(h2)",
      "[id*='job-description']",
      "[id*='jobDescription']",
      "article main, main article",
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const t = el.innerText || el.textContent;
        if (t && t.trim().length > 200) return t.trim();
      }
    }

    // Last resort: largest text block outside nav/header/footer
    let best = null;
    let bestLen = 0;
    document.querySelectorAll("div, section, main").forEach((el) => {
      if (el.closest("nav, header, footer, aside, [role='navigation']")) return;
      const len = (el.innerText || el.textContent || "").trim().length;
      if (len > bestLen && len < 25000) { bestLen = len; best = el; }
    });
    if (best) return (best.innerText || best.textContent).trim();
    return document.body.innerText.slice(0, 10000);
  }

  const jd = extractJobDescription().slice(0, 14000);
  return {
    company: extractCompany(),
    job_title: extractJobTitle(),
    language: detectLanguage(jd),
    job_description: jd,
    source_url: window.location.href,
  };
}

// Cache result for popup to read
window.__jobCapture = extractJobData();
