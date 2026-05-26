
import * as XLSX from "xlsx";
import Fuse from "fuse.js";

export type BankRow = {
  date?: string;
  description: string;
  amount: number;
  extractedName: string;
  extractedPhone?: string;
  raw: Record<string, unknown>;
};

export type MerchantRow = {
  name: string;
  phone?: string;
  expected: number;
  raw: Record<string, unknown>;
};

export type MatchStatus = "paid" | "unpaid" | "underpaid" | "overpaid";

export type MatchResult = {
  customer: MerchantRow;
  bank?: BankRow;
  paidAmount: number;
  confidence: number; // 0-100
  status: MatchStatus;
  needsReview: boolean;
};
export async function parseExcel(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];

  // نقوم بتجربة القراءة العادية، وإذا لم نجد بيانات، نبحث عن السطر الذي تبدأ فيه العناوين
  let rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];

  // إذا كانت الأعمدة الأساسية غير موجودة في أول سطر، نحاول البحث عن السطر الصحيح (حتى أول 10 أسطر)
  if (rows.length > 0) {
    const hasKeys = rows.some(r => Object.keys(r).some(k => k.includes("الإيضاحات") || k.includes("البيان") || k.includes("الوصف")));
    if (!hasKeys) {
      for (let i = 1; i <= 10; i++) {
        const testRows = XLSX.utils.sheet_to_json(sheet, { defval: "", range: i }) as Record<string, unknown>[];
        const found = testRows.some(r => Object.keys(r).some(k => k.includes("الإيضاحات") || k.includes("البيان") || k.includes("الوصف")));
        if (found) {
          rows = testRows;
          break;
        }
      }
    }
  }

  return rows;
}
// export async function parseExcel(file: File): Promise<Record<string, unknown>[]> {
//   const buf = await file.arrayBuffer();
//   const wb = XLSX.read(buf, { type: "array" });
//   const sheet = wb.Sheets[wb.SheetNames[0]];
//   return XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];
// }

function pickKey(row: Record<string, unknown>, keys: string[]): unknown {
  const lower: Record<string, unknown> = {};
  for (const k of Object.keys(row)) lower[k.toLowerCase().trim()] = row[k];
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v !== undefined && v !== "") return v;
  }
  for (const k of keys) {
    for (const rk of Object.keys(lower)) {
      if (rk.includes(k.toLowerCase()) && lower[rk] !== "") return lower[rk];
    }
  }
  return undefined;
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const s = String(v).replace(/[^\d.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

const PHONE_RE = /(\+?\d[\d\s\-]{7,}\d)/;

function normalizePhone(p?: string): string {
  if (!p) return "";
  const digits = p.replace(/\D/g, "");
  return digits.length > 9 ? digits.slice(-9) : digits;
}

export function normalizeBank(rows: Record<string, unknown>[]): BankRow[] {
  console.log("الأسطر الخام الواردة من ملف البنك:", rows);
  return rows
    .map((r) => {
      const description = String(
        pickKey(r, ["description", "details", "narration", "memo", "البيان", "الوصف", "الإيضاحات"]) ?? ""
      );

      const received = toNumber(pickKey(r, ["received amount", "credit", "received", "in", "دائن", "وارد", "مبالغ مستلمة"]));
      const paid = toNumber(pickKey(r, ["paid amount", "debit", "out", "مدين", "مبالغ مدفوعة"]));
      const amount = received || paid;
      const date = pickKey(r, ["actual date", "bank date", "date", "value date", "تاريخ", "التاريخ الفعلي", "التاريخ البنكي"]);

      let name = description
        .replace(/تحويل إلكتروني موبايل/g, "")
        .replace(/الدفع لصديق من/g, "")
        .replace(/حوالة من|دفعة من|تحويل من/g, "")
        .replace(/\d+/g, "")
        .replace(/[^\p{L}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

      return {
        description,
        amount,
        date: date ? String(date) : undefined,
        extractedName: name,
        raw: r,
      } as BankRow;
    })
    .filter((b) => b.description || b.amount);
}

export function normalizeMerchant(rows: Record<string, unknown>[]): MerchantRow[] {
  return rows
    .map((r) => {
      const name = String(pickKey(r, ["full name", "name", "customer", "الاسم"]) ?? "").trim();
      const phoneRaw = pickKey(r, ["phone number", "phone", "mobile", "tel", "الهاتف", "الجوال"]);
      const expected = toNumber(pickKey(r, ["expected amount", "amount", "total", "price", "المبلغ"]));
      return {
        name,
        phone: phoneRaw ? normalizePhone(String(phoneRaw)) : undefined,
        expected,
        raw: r,
      } as MerchantRow;
    })
    .filter((m) => m.name);
}

export function matchPayments(
  merchants: MerchantRow[],
  bank: BankRow[],
  opts: { nameThreshold?: number; amountTolerance?: number } = {}
): MatchResult[] {

  // ==================== كود الفحص والطباعة في الكونسول ====================
  console.log("%c📊 فحص بيانات المطابقة المستلمة:", "color: #10b981; font-weight: bold; font-size: 14px;");
  console.log(`🔹 عدد سجلات كشف التاجر: ${merchants.length}`);
  console.log(`🔹 عدد سجلات كشف الحساب البنكي: ${bank.length}`);

  if (bank.length > 0) {
    console.log("%c🔍 عينة من الأسماء والمبالغ المستخرجة من كشف البنك بعد التنظيف:", "color: #3b82f6; font-weight: bold;");
    // طباعة جدول أنيق يحتوي على الاسم المنظف والمبلغ المقابل له من البنك
    console.table(
      bank.slice(0, 5).map((b) => ({
        "الاسم المستخرج الصافي": b.extractedName,
        "المبلغ": b.amount,
        "النص الأصلي من البنك": b.description.slice(0, 50) + "...",
      }))
    );
  }

  if (merchants.length > 0) {
    console.log("%c📋 عينة من الأسماء والمبالغ المطلوبة من كشف التاجر:", "color: #f59e0b; font-weight: bold;");
    console.table(
      merchants.slice(0, 5).map((m) => ({
        "اسم العميل": m.name,
        "المبلغ المتوقع منه": m.expected,
      }))
    );
  }
  // ====================================================================

  const nameThreshold = opts.nameThreshold ?? 0.6;
  const amountTolerance = opts.amountTolerance ?? 0.01;

  const fuse = new Fuse(bank, {
    keys: ["extractedName", "description"],
    includeScore: true,
    threshold: 0.5,
    ignoreLocation: true,
  });

  const used = new Set<number>();
  const results: MatchResult[] = [];

  for (const m of merchants) {
    let best: { bank: BankRow; idx: number; confidence: number } | undefined;
    let alternatives = 0;

    if (m.phone) {
      bank.forEach((b, i) => {
        if (used.has(i)) return;
        if (b.extractedPhone && b.extractedPhone === m.phone) {
          const amtClose = Math.abs(b.amount - m.expected) <= amountTolerance;
          const conf = amtClose ? 100 : 85;
          if (!best || conf > best.confidence) best = { bank: b, idx: i, confidence: conf };
        }
      });
    }

    if (!best || best.confidence < 90) {
      const candidates = fuse.search(m.name);
      for (const c of candidates) {
        if (used.has(bank.indexOf(c.item))) continue;
        const score = c.score ?? 1;
        if (score > nameThreshold) continue;
        const nameConfidence = (1 - score) * 100;
        const amtDiff = Math.abs(c.item.amount - m.expected);
        const amtClose = amtDiff <= amountTolerance;
        let conf = nameConfidence;
        if (amtClose) conf = Math.min(100, conf + 20);
        else if (c.item.amount > 0) conf = Math.max(40, conf - 10);
        const idx = bank.indexOf(c.item);
        if (!best || conf > best.confidence) best = { bank: c.item, idx, confidence: conf };
        alternatives++;
      }
    }

    if (best) {
      used.add(best.idx);
      const paid = best.bank.amount;
      let status: MatchStatus;
      if (Math.abs(paid - m.expected) <= amountTolerance) status = "paid";
      else if (paid < m.expected) status = "underpaid";
      else status = "overpaid";
      results.push({
        customer: m,
        bank: best.bank,
        paidAmount: paid,
        confidence: Math.round(best.confidence),
        status,
        needsReview: alternatives > 1 && best.confidence < 85,
      });
    } else {
      results.push({
        customer: m,
        paidAmount: 0,
        confidence: 0,
        status: "unpaid",
        needsReview: false,
      });
    }
  }

  console.log(`%c✅ اكتملت المطابقة والمقارنة بنجاح. إجمالي النتائج: ${results.length}`, "color: #10b981; font-weight: bold;");
  return results;
}

export function exportResults(results: MatchResult[], filename = "matching-results.xlsx") {
  const wb = XLSX.utils.book_new();
  const groups: Record<string, MatchResult[]> = {
    Paid: results.filter((r) => r.status === "paid"),
    Unpaid: results.filter((r) => r.status === "unpaid"),
    Underpaid: results.filter((r) => r.status === "underpaid"),
    Overpaid: results.filter((r) => r.status === "overpaid"),
  };
  for (const [sheet, rows] of Object.entries(groups)) {
    const data = rows.map((r) => ({
      "Customer Name": r.customer.name,
      "Phone Number": r.customer.phone ?? "",
      "Expected Amount": r.customer.expected,
      "Paid Amount": r.paidAmount,
      "Difference": +(r.paidAmount - r.customer.expected).toFixed(2),
      "Confidence %": r.confidence,
      "Status": r.status,
      "Needs Review": r.needsReview ? "Yes" : "",
      "Bank Description": r.bank?.description ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ Info: "No records" }]);
    XLSX.utils.book_append_sheet(wb, ws, sheet);
  }
  XLSX.writeFile(wb, filename);
}

// import * as XLSX from "xlsx";
// import Fuse from "fuse.js";

// export type BankRow = {
//   date?: string;
//   description: string;
//   amount: number;
//   extractedName: string;
//   extractedPhone?: string;
//   raw: Record<string, unknown>;
// };

// export type MerchantRow = {
//   name: string;
//   phone?: string;
//   expected: number;
//   raw: Record<string, unknown>;
// };

// export type MatchStatus = "paid" | "unpaid" | "underpaid" | "overpaid";

// export type MatchResult = {
//   customer: MerchantRow;
//   bank?: BankRow;
//   paidAmount: number;
//   confidence: number; // 0-100
//   status: MatchStatus;
//   needsReview: boolean;
// };

// export async function parseExcel(file: File): Promise<Record<string, unknown>[]> {
//   const buf = await file.arrayBuffer();
//   const wb = XLSX.read(buf, { type: "array" });
//   const sheet = wb.Sheets[wb.SheetNames[0]];
//   return XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];
// }

// function pickKey(row: Record<string, unknown>, keys: string[]): unknown {
//   const lower: Record<string, unknown> = {};
//   for (const k of Object.keys(row)) lower[k.toLowerCase().trim()] = row[k];
//   for (const k of keys) {
//     const v = lower[k.toLowerCase()];
//     if (v !== undefined && v !== "") return v;
//   }
//   // Loose contains match
//   for (const k of keys) {
//     for (const rk of Object.keys(lower)) {
//       if (rk.includes(k.toLowerCase()) && lower[rk] !== "") return lower[rk];
//     }
//   }
//   return undefined;
// }

// function toNumber(v: unknown): number {
//   if (typeof v === "number") return v;
//   if (!v) return 0;
//   const s = String(v).replace(/[^\d.\-]/g, "");
//   const n = parseFloat(s);
//   return isNaN(n) ? 0 : n;
// }

// const PHONE_RE = /(\+?\d[\d\s\-]{7,}\d)/;

// function normalizePhone(p?: string): string {
//   if (!p) return "";
//   const digits = p.replace(/\D/g, "");
//   return digits.length > 9 ? digits.slice(-9) : digits;
// }


// export function normalizeBank(rows: Record<string, unknown>[]): BankRow[] {
//   return rows
//     .map((r) => {
//       const description = String(
//         pickKey(r, ["description", "details", "narration", "memo", "البيان", "الوصف", "الإيضاحات"]) ?? ""
//       );

//       const received = toNumber(pickKey(r, ["received amount", "credit", "received", "in", "دائن", "وارد", "مبالغ مستلمة"]));
//       const paid = toNumber(pickKey(r, ["paid amount", "debit", "out", "مدين", "مبالغ مدفوعة"]));
//       const amount = received || paid;
//       const date = pickKey(r, ["actual date", "bank date", "date", "value date", "تاريخ", "التاريخ الفعلي", "التاريخ البنكي"]);

//       // تنظيف النص تماماً لاستخراج الاسم فقط بناءً على كشفك
//       let name = description
//         // 1. حذف العبارات الثابتة في تطبيق البنك
//         .replace(/تحويل إلكتروني موبايل/g, "")
//         .replace(/الدفع لصديق من/g, "")
//         .replace(/حوالة من|دفعة من|تحويل من/g, "")
//         // 2. حذف أي أرقام (مثل رقم المعاملة أو رقم الحساب الملتصق بالاسم)
//         .replace(/\d+/g, "")
//         // 3. حذف الرموز والشرطات المائلة مثل / أو -
//         .replace(/[^\p{L}\s]/gu, " ")
//         // 4. إزالة المسافات الزائدة
//         .replace(/\s+/g, " ")
//         .trim();

//       return {
//         description,
//         amount,
//         date: date ? String(date) : undefined,
//         extractedName: name, // هنا الاسم أصبح صافي تماماً مثل: "اسماعيل ايمن ابو معيلق"
//         raw: r,
//       } as BankRow;
//     })
//     .filter((b) => b.description || b.amount);
// }
// // export function normalizeBank(rows: Record<string, unknown>[]): BankRow[] {
// //   return rows
// //     .map((r) => {
// //       const description = String(
// //         pickKey(r, ["description", "details", "narration", "memo", "البيان", "الوصف"]) ?? ""
// //       );
// //       const received = toNumber(pickKey(r, ["received amount", "credit", "received", "in", "دائن", "وارد"]));
// //       const paid = toNumber(pickKey(r, ["paid amount", "debit", "out", "مدين"]));
// //       const amount = received || paid;
// //       const date = pickKey(r, ["actual date", "bank date", "date", "value date", "تاريخ"]);

// //       const phoneMatch = description.match(PHONE_RE);
// //       const extractedPhone = phoneMatch ? normalizePhone(phoneMatch[1]) : undefined;

// //       // Extract sender name: strip phone, strip common prefixes
// //       let name = description
// //         .replace(PHONE_RE, "")
// //         .replace(/mobile transfer payment from/gi, "")
// //         .replace(/payment from/gi, "")
// //         .replace(/transfer from/gi, "")
// //         .replace(/from[:\s]/gi, "")
// //         .replace(/حوالة من|دفعة من|تحويل من/g, "")
// //         .replace(/[^\p{L}\s]/gu, " ")
// //         .replace(/\s+/g, " ")
// //         .trim();

// //       return {
// //         description,
// //         amount,
// //         date: date ? String(date) : undefined,
// //         extractedName: name,
// //         extractedPhone,
// //         raw: r,
// //       } as BankRow;
// //     })
// //     .filter((b) => b.description || b.amount);
// // }

// export function normalizeMerchant(rows: Record<string, unknown>[]): MerchantRow[] {
//   return rows
//     .map((r) => {
//       const name = String(pickKey(r, ["full name", "name", "customer", "الاسم"]) ?? "").trim();
//       const phoneRaw = pickKey(r, ["phone number", "phone", "mobile", "tel", "الهاتف", "الجوال"]);
//       const expected = toNumber(pickKey(r, ["expected amount", "amount", "total", "price", "المبلغ"]));
//       return {
//         name,
//         phone: phoneRaw ? normalizePhone(String(phoneRaw)) : undefined,
//         expected,
//         raw: r,
//       } as MerchantRow;
//     })
//     .filter((m) => m.name);
// }

// export function matchPayments(
//   merchants: MerchantRow[],
//   bank: BankRow[],
//   opts: { nameThreshold?: number; amountTolerance?: number } = {}
// ): MatchResult[] {
//   const nameThreshold = opts.nameThreshold ?? 0.6; // Fuse score; lower = better
//   const amountTolerance = opts.amountTolerance ?? 0.01;

//   const fuse = new Fuse(bank, {
//     keys: ["extractedName", "description"],
//     includeScore: true,
//     threshold: 0.5,
//     ignoreLocation: true,
//   });

//   const used = new Set<number>();
//   const results: MatchResult[] = [];

//   for (const m of merchants) {
//     let best: { bank: BankRow; idx: number; confidence: number } | undefined;
//     let alternatives = 0;

//     // 1. Phone match
//     if (m.phone) {
//       bank.forEach((b, i) => {
//         if (used.has(i)) return;
//         if (b.extractedPhone && b.extractedPhone === m.phone) {
//           const amtClose = Math.abs(b.amount - m.expected) <= amountTolerance;
//           const conf = amtClose ? 100 : 85;
//           if (!best || conf > best.confidence) best = { bank: b, idx: i, confidence: conf };
//         }
//       });
//     }

//     // 2. Name + amount fuzzy
//     if (!best || best.confidence < 90) {
//       const candidates = fuse.search(m.name);
//       for (const c of candidates) {
//         if (used.has(bank.indexOf(c.item))) continue;
//         const score = c.score ?? 1;
//         if (score > nameThreshold) continue;
//         const nameConfidence = (1 - score) * 100;
//         const amtDiff = Math.abs(c.item.amount - m.expected);
//         const amtClose = amtDiff <= amountTolerance;
//         let conf = nameConfidence;
//         if (amtClose) conf = Math.min(100, conf + 20);
//         else if (c.item.amount > 0) conf = Math.max(40, conf - 10);
//         const idx = bank.indexOf(c.item);
//         if (!best || conf > best.confidence) best = { bank: c.item, idx, confidence: conf };
//         alternatives++;
//       }
//     }

//     if (best) {
//       used.add(best.idx);
//       const paid = best.bank.amount;
//       let status: MatchStatus;
//       if (Math.abs(paid - m.expected) <= amountTolerance) status = "paid";
//       else if (paid < m.expected) status = "underpaid";
//       else status = "overpaid";
//       results.push({
//         customer: m,
//         bank: best.bank,
//         paidAmount: paid,
//         confidence: Math.round(best.confidence),
//         status,
//         needsReview: alternatives > 1 && best.confidence < 85,
//       });
//     } else {
//       results.push({
//         customer: m,
//         paidAmount: 0,
//         confidence: 0,
//         status: "unpaid",
//         needsReview: false,
//       });
//     }
//   }

//   return results;
// }

// export function exportResults(results: MatchResult[], filename = "matching-results.xlsx") {
//   const wb = XLSX.utils.book_new();
//   const groups: Record<string, MatchResult[]> = {
//     Paid: results.filter((r) => r.status === "paid"),
//     Unpaid: results.filter((r) => r.status === "unpaid"),
//     Underpaid: results.filter((r) => r.status === "underpaid"),
//     Overpaid: results.filter((r) => r.status === "overpaid"),
//   };
//   for (const [sheet, rows] of Object.entries(groups)) {
//     const data = rows.map((r) => ({
//       "Customer Name": r.customer.name,
//       "Phone Number": r.customer.phone ?? "",
//       "Expected Amount": r.customer.expected,
//       "Paid Amount": r.paidAmount,
//       "Difference": +(r.paidAmount - r.customer.expected).toFixed(2),
//       "Confidence %": r.confidence,
//       "Status": r.status,
//       "Needs Review": r.needsReview ? "Yes" : "",
//       "Bank Description": r.bank?.description ?? "",
//     }));
//     const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ Info: "No records" }]);
//     XLSX.utils.book_append_sheet(wb, ws, sheet);
//   }
//   XLSX.writeFile(wb, filename);
// }
