
// قم بإضافة هذا السطر في أعلى الملف

import { useMemo, useState, useEffect } from "react";
import {
  Sparkles,
  Wallet,
  Users,
  CheckCircle2,
  XCircle,
  TrendingDown,
  TrendingUp,
  Download,
  Play,
  Search,
  Loader2,
  Info,
} from "lucide-react";
import { FileDropzone } from '../components/FileDropzone';
import { ResultTable } from "../components/ResultTable";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Slider } from "../components/ui/slider";
import { Label } from "../components/ui/label";
import { cn } from "../lib/utils";
import {
  parseExcel,
  normalizeBank,
  normalizeMerchant,
  matchPayments,
  exportResults,
  type MatchResult,
} from '../lib/matching';

type Filter = "all" | "paid" | "unpaid" | "underpaid" | "overpaid";

const fmt = (n: number) => n.toLocaleString("ar-EG", { maximumFractionDigits: 2 });

export default function Index() {
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [nameThreshold, setNameThreshold] = useState(0.6);
  const [tolerance, setTolerance] = useState(0.01);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  // تعويض ميزة head() لتحديث عنوان الصفحة في المتصفح داخل Vite
  useEffect(() => {
    document.title = "المطابقة الذكية للمدفوعات — تسوية التحويلات البنكية في ثوانٍ";
  }, []);

  async function runMatch() {
    if (!bankFile || !salesFile) return;
    setLoading(true);
    setError(null);
    try {
      const [bankRaw, salesRaw] = await Promise.all([parseExcel(bankFile), parseExcel(salesFile)]);
      const bank = normalizeBank(bankRaw);
      const merchants = normalizeMerchant(salesRaw);
      if (merchants.length === 0) throw new Error("لم يتم العثور على صفوف للعملاء في ملف المبيعات.");
      const res = matchPayments(merchants, bank, {
        nameThreshold,
        amountTolerance: tolerance,
      });
      setResults(res);
      setFilter("all");
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل في معالجة الملفات.");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const r = results ?? [];
    const sum = (fn: (x: MatchResult) => number) => r.reduce((a, x) => a + fn(x), 0);
    return {
      total: r.length,
      paid: r.filter((x) => x.status === "paid").length,
      unpaid: r.filter((x) => x.status === "unpaid").length,
      under: r.filter((x) => x.status === "underpaid").length,
      over: r.filter((x) => x.status === "overpaid").length,
      expected: sum((x) => x.customer.expected),
      received: sum((x) => x.paidAmount),
    };
  }, [results]);

  const filtered = useMemo(() => {
    if (!results) return [];
    const q = query.trim().toLowerCase();
    return results.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.customer.name.toLowerCase().includes(q) ||
        (r.customer.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [results, filter, query]);

  return (
    <main className="min-h-screen pb-20" dir="rtl">
      {/* الهيدر / شريط التنقل */}
      <header className="border-b border-border/60 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-[var(--shadow-elevated)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                المطابقة الذكية للمدفوعات
              </h1>
              <p className="hidden text-xs text-muted-foreground sm:block">
                طابق التحويلات البنكية مع المبيعات اليومية — بالكامل داخل متصفحك
              </p>
            </div>
          </div>
          {results && (
            <Button onClick={() => exportResults(results)} variant="outline" className="gap-2">
              <Download className="h-4 w-4" /> تصدير إلى Excel
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
        {/* قسم الواجهة الرئيسية */}
        <section className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-[var(--shadow-soft)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" /> يعمل 100% بدون إنترنت داخل متصفحك
          </div>
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            اكتشف من دفع ومن لم يدفع —{" "}
            <span className="bg-gradient-to-r from-primary to-info bg-clip-text text-transparent">
              في ثوانٍ معدودة
            </span>
            .
          </h2>
          <p className="max-w-2xl text-muted-foreground">
            قم برفع كشف الحساب البنكي وجدول مبيعات التجار. سنقوم باستخراج أسماء المرسلين، أرقام الهواتف والمبالغ، ثم مطابقتها تلقائيًا وبذكاء لكل عميل.
          </p>
        </section>

        {/* قسم رفع الملفات */}
        <section className="grid gap-4 md:grid-cols-2">
          <FileDropzone
            title="كشف الحساب البنكي"
            description="أعمدة مثل: البيان/الوصف، المبلغ المدفوع/المستلم."
            file={bankFile}
            onFile={setBankFile}
            accent="primary"
          />
          <FileDropzone
            title="ملف مبيعات التاجر"
            description="الأعمدة: الاسم الكامل، رقم الهاتف، المبلغ المتوقع."
            file={salesFile}
            onFile={setSalesFile}
            accent="info"
          />
        </section>

        {/* الإعدادات والتشغيل */}
        <section className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Info className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold">إعدادات المطابقة</h3>
              <p className="text-sm text-muted-foreground">
                ضبط حساسية المطابقة التقريبية للأسماء. الإعدادات الافتراضية تعمل بشكل ممتاز في معظم الحالات.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>درجة تطابق الأسماء</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {(100 - nameThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[nameThreshold * 100]}
                onValueChange={(v) => setNameThreshold(v[0] / 100)}
                min={20}
                max={80}
                step={5}
              />
              <p className="text-xs text-muted-foreground">أقل = مطابقة أكثر صرامة للأسماء.</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>نسبة التسامح في المبالغ</Label>
                <span className="text-xs tabular-nums text-muted-foreground">±{tolerance}</span>
              </div>
              <Slider
                value={[tolerance]}
                onValueChange={(v) => setTolerance(v[0])}
                min={0}
                max={5}
                step={0.5}
              />
              <p className="text-xs text-muted-foreground">اعتبار المبالغ ضمن هذا النطاق متساوية.</p>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button
              onClick={runMatch}
              disabled={!bankFile || !salesFile || loading}
              size="lg"
              className="gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 transform rotate-180" />}
              {loading ? "جاري المطابقة..." : "تشغيل المطابقة الذكية"}
            </Button>
          </div>
        </section>

        {/* النتائج */}
        {!results ? (
          <EmptyState />
        ) : (
          <>
            {/* الملخص الإحصائي */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Users} label="إجمالي العملاء" value={String(stats.total)} tone="default" />
              <StatCard icon={CheckCircle2} label="تم الدفع" value={String(stats.paid)} tone="success" />
              <StatCard icon={XCircle} label="لم يدفع" value={String(stats.unpaid)} tone="destructive" />
              <StatCard icon={TrendingDown} label="دفع أقل" value={String(stats.under)} tone="warning" />
              <StatCard icon={TrendingUp} label="دفع أعلى" value={String(stats.over)} tone="info" />
              <StatCard icon={Wallet} label="الإجمالي المتوقع" value={fmt(stats.expected)} tone="default" />
              <StatCard
                icon={Wallet}
                label="إجمالي المستلم"
                value={fmt(stats.received)}
                tone={stats.received >= stats.expected ? "success" : "warning"}
              />
              <StatCard
                icon={Wallet}
                label="الفرق"
                value={fmt(stats.received - stats.expected)}
                tone={stats.received >= stats.expected ? "success" : "destructive"}
              />
            </section>

            {/* الفلاتر والبحث */}
            <section className="space-y-4" dir="rtl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="w-full sm:w-auto">
                  <TabsList
                    className="w-full flex flex-row justify-start overflow-x-auto sm:w-auto bg-muted/60 p-1"
                    dir="rtl"
                  >
                    <TabsTrigger value="all" className="whitespace-nowrap">الكل ({stats.total})</TabsTrigger>
                    <TabsTrigger value="paid" className="whitespace-nowrap">تم الدفع ({stats.paid})</TabsTrigger>
                    <TabsTrigger value="unpaid" className="whitespace-nowrap">لم يدفع ({stats.unpaid})</TabsTrigger>
                    <TabsTrigger value="underpaid" className="whitespace-nowrap">أقل ({stats.under})</TabsTrigger>
                    <TabsTrigger value="overpaid" className="whitespace-nowrap">أعلى ({stats.over})</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="ابحث بالاسم أو رقم الهاتف..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pr-9 pl-3"
                  />
                </div>
              </div>

              <Tabs value={filter}>
                <TabsContent value="all"><ResultTable results={filtered} /></TabsContent>
                <TabsContent value="paid"><ResultTable results={filtered} /></TabsContent>
                <TabsContent value="unpaid"><ResultTable results={filtered} /></TabsContent>
                <TabsContent value="underpaid"><ResultTable results={filtered} /></TabsContent>
                <TabsContent value="overpaid"><ResultTable results={filtered} /></TabsContent>
              </Tabs>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

// تم إخراج الدوال هنا لتصبح مستقلة تماماً وتعمل بدون مشاكل نطاق (Scope)
function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "default" | "success" | "destructive" | "warning" | "info";
}) {
  const toneMap: Record<string, string> = {
    default: "bg-accent text-accent-foreground",
    success: "bg-success/15 text-success",
    destructive: "bg-destructive/15 text-destructive",
    warning: "bg-warning/20 text-warning-foreground",
    info: "bg-info/15 text-info",
  };
  return (
    <div className="group rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", toneMap[tone])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="text-xl font-semibold tabular-nums text-foreground">{value}</div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">بانتظار رفع ملفاتك لبدء العمل</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        قم برفع كلا الملفين في الأعلى ثم اضغط على <span className="font-medium text-foreground">تشغيل المطابقة الذكية</span>. بياناتك آمنة تماماً ولا تغادر متصفحك أبداً.
      </p>
      <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-3 text-right">
        {[
          { t: "١. كشف الحساب البنكي", d: "أعمدة البيان، والمبالغ المدفوعة / المستلمة." },
          { t: "٢. ملف المبيعات", d: "اسم العميل، رقم الهاتف، والمبلغ المتوقع." },
          { t: "٣. مطابقة تلقائية", d: "مطابقة الهاتف، المبالغ، والأسماء بشكل ذكي وتقريبي." },
        ].map((s) => (
          <div key={s.t} className="rounded-xl border bg-background/60 p-3">
            <div className="text-sm font-semibold">{s.t}</div>
            <div className="text-xs text-muted-foreground">{s.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}