const databaseName = "dh2-sourcebook-library";
const databaseVersion = 1;
const storeName = "libraries";
const activeLibraryKey = "dark-heresy-2e";

const bookSpecs = [
  {
    id: "core",
    title: "Dark Heresy Second Edition Core Rulebook",
    shortTitle: "Core Rulebook",
    filename: /(?:dark[_ -]?heresy.*(?:core|rulebook)|core.*dark[_ -]?heresy)/i,
    expectedPages: 447,
  },
  {
    id: "enemies-within",
    title: "Dark Heresy Second Edition: Enemies Within",
    shortTitle: "Enemies Within",
    filename: /enemies[_ -]?within/i,
    expectedPages: 146,
  },
  {
    id: "enemies-without",
    title: "Dark Heresy Second Edition: Enemies Without",
    shortTitle: "Enemies Without",
    filename: /enemies[_ -]?without/i,
    expectedPages: 146,
  },
  {
    id: "enemies-beyond",
    title: "Dark Heresy Second Edition: Enemies Beyond",
    shortTitle: "Enemies Beyond",
    filename: /enemies[_ -]?beyond/i,
    expectedPages: 146,
  },
];

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("The local sourcebook library could not be opened."));
  });
}

async function useStore(mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("The local sourcebook library operation failed."));
      transaction.onerror = () => reject(transaction.error || new Error("The local sourcebook transaction failed."));
    });
  } finally {
    database.close();
  }
}

export async function loadStoredSourcebookLibrary() {
  return useStore("readonly", (store) => store.get(activeLibraryKey));
}

export async function saveSourcebookLibrary(library) {
  const stored = {
    ...library,
    storedAt: new Date().toISOString(),
  };
  await useStore("readwrite", (store) => store.put(stored, activeLibraryKey));
  return stored;
}

export async function clearStoredSourcebookLibrary() {
  await useStore("readwrite", (store) => store.delete(activeLibraryKey));
}

function normalizeLine(value) {
  return String(value || "")
    .replace(/\u00ad/g, "")
    .replace(/\ufb01/g, "fi")
    .replace(/\ufb02/g, "fl")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value) {
  return normalizeLine(value).toLocaleLowerCase().replace(/[^a-z0-9+%–—-]+/g, "");
}

function prefixLengthForCompactCharacters(value, count) {
  if (count <= 0) return 0;
  let consumed = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/[a-z0-9+%–—-]/i.test(value[index])) consumed += 1;
    if (consumed >= count) return index + 1;
  }
  return value.length;
}

function textOverlap(left, right) {
  const leftCompact = compactText(left);
  const rightCompact = compactText(right);
  const maximum = Math.min(leftCompact.length, rightCompact.length);
  for (let size = maximum; size > 0; size -= 1) {
    if (leftCompact.slice(-size) === rightCompact.slice(0, size)) return size;
  }
  return 0;
}

function lineItemScore(item) {
  const text = normalizeLine(item.str);
  const compact = compactText(text);
  const punctuation = (text.match(/[’'“”"():;,.!?–—-]/g) || []).length;
  return compact.length * 10 + punctuation * 2 - (text.match(/\s/g) || []).length;
}

function mergeLineItems(rawItems) {
  const sorted = rawItems
    .filter((item) => normalizeLine(item.str))
    .sort((a, b) => a.x - b.x || lineItemScore(b) - lineItemScore(a));
  const items = [];
  for (const item of sorted) {
    const sameStart = items.findIndex((entry) => Math.abs(entry.x - item.x) <= 0.75);
    if (sameStart >= 0) {
      const existing = items[sameStart];
      const existingCompact = compactText(existing.str);
      const itemCompact = compactText(item.str);
      if (
        existingCompact === itemCompact
        || Math.abs(existing.width - item.width) <= 1
        || Math.min(existing.width, item.width) / Math.max(existing.width, item.width) >= 0.82
      ) {
        if (lineItemScore(item) > lineItemScore(existing)) items[sameStart] = item;
        continue;
      }
    }
    items.push(item);
  }
  items.sort((a, b) => a.x - b.x || lineItemScore(b) - lineItemScore(a));

  let output = "";
  let coverageEnd = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    const text = normalizeLine(item.str);
    const itemEnd = item.x + item.width;
    if (!output) {
      output = text;
      coverageEnd = itemEnd;
      continue;
    }
    const compactOutput = compactText(output);
    const compactItem = compactText(text);
    if (compactItem && compactOutput.includes(compactItem) && itemEnd <= coverageEnd + 1.5) continue;

    const overlap = textOverlap(output, text);
    if (overlap) {
      output += text.slice(prefixLengthForCompactCharacters(text, overlap)).trimStart();
    } else if (item.x <= coverageEnd + 2) {
      if (itemEnd <= coverageEnd + 1.5) continue;
      output += text.trimStart();
    } else {
      output += ` ${text}`;
    }
    coverageEnd = Math.max(coverageEnd, itemEnd);
  }
  return normalizeLine(output);
}

function groupColumnLines(items) {
  const lines = [];
  for (const item of items.sort((a, b) => b.y - a.y || a.x - b.x)) {
    let line = lines.find((entry) => Math.abs(entry.y - item.y) <= Math.max(2.2, item.height * 0.28));
    if (!line) {
      line = { y: item.y, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => mergeLineItems(line.items))
    .filter(Boolean);
}

function cleanExtractedLines(lines) {
  const seen = new Set();
  return lines.map((line) => line
    .replace(/^DIFFI?F?\s*CULTY\s+TESE?\s*T\s+MODIFIER$/i, "DIFFICULTY TEST MODIFIER")
    .replace(/^Rout\w*\s+ine(\s+[+-]\d+)?$/i, (_, modifier = "") => `Routine${modifier}`)
    .replace(/^Challeng\w*\s+ing(\s+[+-]\d+)?$/i, (_, modifier = "") => `Challenging${modifier}`)
    .replace(/^Diffic\w*\s+ult(\s+[–-]\d+)?$/i, (_, modifier = "") => `Difficult${modifier}`)
    .replace(/^H\s+rd(\s+[–-]\d+)?$/i, (_, modifier = "") => `Hard${modifier}`)
    .replace(/([+-]\d)\+\s*0\b/g, (_, prefix) => `${prefix}0`)
  ).filter((line) => {
    if (!line || /^\d{1,3}$/.test(line)) return false;
    if (/^(?:\d+\s+)?CHAPTER\s+[IVXLCDM]+(?::.*)?$/i.test(line)) return false;
    if (/\(cid:\d+\)/i.test(line)) return false;
    if (/(.{1,4})\1{4,}/i.test(line)) return false;
    if (/\b[A-Za-z]{42,}\b/.test(line)) return false;
    const letters = (line.match(/[A-Za-z]/g) || []).length;
    const spaces = (line.match(/\s/g) || []).length;
    const repeatedLetters = [...line.matchAll(/([A-Za-z])\1+/g)]
      .reduce((total, match) => total + match[0].length - 1, 0);
    if (line.length >= 65 && spaces / line.length < 0.045) return false;
    if (letters >= 55 && repeatedLetters / letters > 0.055 && spaces / line.length < 0.13) return false;
    const key = line.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (line.length > 45 && seen.has(key)) return false;
    if (line.length > 45) seen.add(key);
    return true;
  });
}

async function extractPageText(page) {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent({ includeMarkedContent: false });
  const items = content.items
    .filter((item) => item?.str)
    .map((item) => ({
      str: normalizeLine(item.str),
      x: Number(item.transform?.[4] || 0),
      y: Number(item.transform?.[5] || 0),
      width: Number(item.width || 0),
      height: Math.abs(Number(item.height || item.transform?.[0] || 10)),
    }))
    .filter((item) => item.str && item.y > 28 && item.y < viewport.height - 22);

  const midpoint = viewport.width / 2;
  const broadItems = items.filter((item) => item.width >= viewport.width * 0.58);
  const broadSet = new Set(broadItems);
  const left = items.filter((item) => !broadSet.has(item) && item.x < midpoint);
  const right = items.filter((item) => !broadSet.has(item) && item.x >= midpoint);
  const lines = [
    ...groupColumnLines(broadItems),
    ...groupColumnLines(left),
    ...groupColumnLines(right),
  ];
  return cleanExtractedLines(lines).join("\n");
}

async function resolveOutline(pdf) {
  const flattened = [];
  const outline = await pdf.getOutline() || [];
  const labels = await pdf.getPageLabels().catch(() => null);

  async function destinationPage(item) {
    let destination = item.dest;
    if (typeof destination === "string") destination = await pdf.getDestination(destination);
    if (!Array.isArray(destination) || !destination[0]) return null;
    const reference = destination[0];
    if (Number.isInteger(reference)) return reference + 1;
    try {
      return (await pdf.getPageIndex(reference)) + 1;
    } catch {
      return null;
    }
  }

  async function visit(items, level = 0) {
    for (const item of items || []) {
      const pdfPage = await destinationPage(item);
      if (pdfPage) {
        flattened.push({
          title: normalizeLine(item.title),
          level,
          pdfPage,
          printedPage: labels?.[pdfPage - 1] || String(pdfPage),
        });
      }
      if (item.items?.length) await visit(item.items, level + 1);
    }
  }

  await visit(outline);
  return { outline: flattened, labels };
}

function identifyBook(file, pageCount) {
  const byName = bookSpecs.find((spec) => spec.filename.test(file.name));
  if (byName) return byName;
  const pageMatches = bookSpecs.filter((spec) => spec.expectedPages === pageCount);
  if (pageMatches.length === 1) return pageMatches[0];
  return null;
}

async function loadPdfLibrary() {
  const pdfjs = await import("./vendor/pdfjs/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
  return pdfjs;
}

export async function extractSourcebookFile(file, pdfjs, progress) {
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    useWorkerFetch: false,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const spec = identifyBook(file, pdf.numPages);
  if (!spec) {
    await loadingTask.destroy();
    throw new Error(`Could not identify “${file.name}”. Keep the original book title in the filename.`);
  }

  const { outline, labels } = await resolveOutline(pdf);
  const headingsByPage = new Map();
  for (const heading of outline) {
    if (!headingsByPage.has(heading.pdfPage)) headingsByPage.set(heading.pdfPage, []);
    headingsByPage.get(heading.pdfPage).push(heading);
  }

  let currentChapter = spec.shortTitle;
  let currentHeading = spec.shortTitle;
  const pages = [];
  for (let index = 0; index < pdf.numPages; index += 1) {
    const pdfPage = index + 1;
    const pageHeadings = headingsByPage.get(pdfPage) || [];
    for (const heading of pageHeadings) {
      currentHeading = heading.title || currentHeading;
      if (heading.level === 0 || /^chapter\b/i.test(heading.title)) currentChapter = heading.title;
    }
    const page = await pdf.getPage(pdfPage);
    const text = await extractPageText(page);
    page.cleanup();
    pages.push({
      pdfPage,
      printedPage: labels?.[index] || String(pdfPage),
      chapter: currentChapter,
      heading: currentHeading,
      headings: pageHeadings.map((entry) => entry.title),
      text,
    });
    progress?.({
      book: spec.shortTitle,
      page: pdfPage,
      pages: pdf.numPages,
      message: `${spec.shortTitle}: indexing page ${pdfPage} of ${pdf.numPages}`,
    });
  }

  await loadingTask.destroy();
  return {
    id: spec.id,
    title: spec.title,
    shortTitle: spec.shortTitle,
    pageCount: pages.length,
    outline,
    pages,
  };
}

function validateImportedLibrary(payload) {
  if (!payload || !Array.isArray(payload.books) || payload.books.length < 1) {
    throw new Error("That file is not a readable Dark Heresy rules library.");
  }
  for (const book of payload.books) {
    if (!book?.id || !Array.isArray(book.pages)) {
      throw new Error("The imported rules library is incomplete.");
    }
  }
  return payload;
}

export async function buildSourcebookLibrary(files, progress) {
  const selected = [...files];
  const jsonFile = selected.find((file) => /\.json$/i.test(file.name));
  if (jsonFile) {
    progress?.({ message: "Reading the selected local rules index…" });
    const payload = validateImportedLibrary(JSON.parse(await jsonFile.text()));
    return saveSourcebookLibrary({
      ...payload,
      format: "dh2-browser-local-rules-compendium",
      source: "local-index",
    });
  }

  const pdfFiles = selected.filter((file) => /\.pdf$/i.test(file.name) || file.type === "application/pdf");
  if (pdfFiles.length !== 4) {
    throw new Error("Select the Core Rulebook and all three Enemies sourcebooks together.");
  }
  const pdfjs = await loadPdfLibrary();
  const books = [];
  for (const file of pdfFiles) {
    books.push(await extractSourcebookFile(file, pdfjs, progress));
  }
  const uniqueIds = new Set(books.map((book) => book.id));
  const missing = bookSpecs.filter((spec) => !uniqueIds.has(spec.id));
  if (missing.length) {
    throw new Error(`Missing sourcebook: ${missing.map((spec) => spec.shortTitle).join(", ")}.`);
  }
  const ordered = bookSpecs.map((spec) => books.find((book) => book.id === spec.id));
  return saveSourcebookLibrary({
    format: "dh2-browser-local-rules-compendium",
    version: 1,
    source: "locally-selected-pdfs",
    notice: "Built locally from sourcebooks selected by this user. Sourcebook data was not uploaded.",
    books: ordered,
  });
}

export function sourcebookRequirements() {
  return bookSpecs.map(({ id, shortTitle, expectedPages }) => ({ id, shortTitle, expectedPages }));
}
