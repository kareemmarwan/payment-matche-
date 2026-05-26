

import { useState } from "react";
import type { MatchResult } from "../lib/matching";
import { Badge } from "./ui/badge";
import { AlertTriangle, Send } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

const fmt = (n: number) => n.toLocaleString("ar-EG", { maximumFractionDigits: 2 });

const statusStyle: Record<string, string> = {
  paid: "bg-success/15 text-success border-success/30 whitespace-nowrap",
  unpaid: "bg-destructive/15 text-destructive border-destructive/30 whitespace-nowrap",
  underpaid: "bg-warning/20 text-warning-foreground border-warning/40 whitespace-nowrap",
  overpaid: "bg-info/15 text-info border-info/30 whitespace-nowrap",
};

const statusTranslation: Record<string, string> = {
  paid: "تم الدفع",
  unpaid: "لم يدفع",
  underpaid: "دفع أقل",
  overpaid: "دفع أعلى",
};

export function ResultTable({ results }: { results: MatchResult[] }) {
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);

  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground" dir="rtl">
        لا توجد سجلات في هذه الفئة.
      </div>
    );
  }

  const selectedRows = results.filter((_, idx) => selectedIndexes.includes(idx));
  const actionableRows = selectedRows.filter(r => r.status !== "paid" && r.customer.phone);

  const handleSendSMS = () => {
    if (actionableRows.length === 0) return;

    const phones = actionableRows.map(r => r.customer.phone).join(",");

    let message = "";
    if (actionableRows.length === 1) {
      const r = actionableRows[0];
      const diff = Math.abs(r.customer.expected - r.paidAmount);
      if (r.status === "unpaid") {
        message = `مرحباً ${r.customer.name}، يرجى العلم بأن مستحقاتك بقيمة ${fmt(r.customer.expected)} شيكل لم يتم سدادها بعد. يرجى تحويل المبلغ في أقرب وقت.`;
      } else if (r.status === "underpaid") {
        message = `مرحباً ${r.customer.name}، شكراً لك. لقد استلمنا دفعة جزئية، والمتبقي عليك هو عجز بقيمة ${fmt(diff)} شيكل. يرجى استكمال السداد.`;
      } else if (r.status === "overpaid") {
        message = `مرحباً ${r.customer.name}، يرجى العلم بأنه يوجد لكم رصيد زائد لدينا بقيمة ${fmt(diff)} شيكل من معاملتكم الأخيرة.`;
      }
    } else {
      const firstStatus = actionableRows[0].status;
      if (firstStatus === "unpaid") {
        message = "مرحباً عميلنا الكريم، يرجى مراجعة حسابك لدينا وسداد المبالغ المستحقة المتأخرة في أقرب وقت ممكن. شكراً لك.";
      } else if (firstStatus === "underpaid") {
        message = "مرحباً عميلنا الكريم، يوجد عجز متبقي في دفعتكم الأخيرة المحولة، يرجى مراجعة الحساب وتغطية العجز المتبقي.";
      } else {
        message = "مرحباً عميلنا الكريم، نود تذكيركم بضرورة مراجعة الحساب المالي الخاص بكم مع المتجر لتسوية المعاملات الحالية.";
      }
    }

    const encodedMessage = encodeURIComponent(message);
    const smsUrl = `sms:${phones}?&body=${encodedMessage}`;

    window.location.href = smsUrl;
  };

  const showPaid = results.some((r) => r.status !== "unpaid");
  const showMissing = results.every((r) => r.status === "underpaid");
  const showExtra = results.every((r) => r.status === "overpaid");
  const showConfidence = results.every((r) => r.status === "paid");

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const indexesToSelect = results
        .map((r, idx) => (r.status !== "paid" ? idx : -1))
        .filter(idx => idx !== -1);
      setSelectedIndexes(indexesToSelect);
    } else {
      setSelectedIndexes([]);
    }
  };

  const handleSelectRow = (idx: number, checked: boolean) => {
    if (checked) {
      setSelectedIndexes(prev => [...prev, idx]);
    } else {
      setSelectedIndexes(prev => prev.filter(i => i !== idx));
    }
  };

  return (
    <div className="w-full space-y-3" dir="rtl">

      {/* شريط الإجراءات العلوي */}
      {actionableRows.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl animate-in fade-in slide-in-from-top-1">
          <span className="text-sm font-medium text-primary">
            تم تحديد ({actionableRows.length}) عملاء جاهزين للمراسلة
          </span>
          <Button onClick={handleSendSMS} size="sm" className="gap-2 bg-primary text-primary-foreground font-medium shadow-sm">
            <Send className="h-4 w-4" />
            إرسال رسالة تذكير جماعية
          </Button>
        </div>
      )}

      <div className="w-full overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-soft)]">
        <div className="w-full overflow-x-auto scrollbar-thin">
          <Table className="min-w-[900px] table-fixed w-full">
            <TableHeader>
              <TableRow className="bg-muted/50">
                {/* تم حذف الكلاسات الثابتة (sticky) كلياً لجميع الأعمدة */}
                <TableHead className="w-[50px] text-center font-bold text-muted-foreground">#</TableHead>
                <TableHead className="text-right w-[200px]">العميل</TableHead>
                <TableHead className="text-right w-[130px] whitespace-nowrap">رقم الهاتف</TableHead>
                <TableHead className="text-left w-[120px] whitespace-nowrap">المبلغ المتوقع</TableHead>
                {showPaid && <TableHead className="text-left w-[120px] whitespace-nowrap">المدفوع</TableHead>}
                {showMissing && <TableHead className="text-left w-[120px] whitespace-nowrap">المتبقي</TableHead>}
                {showExtra && <TableHead className="text-left w-[120px] whitespace-nowrap">الزائد</TableHead>}
                {showConfidence && <TableHead className="text-left w-[140px] whitespace-nowrap">نسبة التطابق</TableHead>}
                <TableHead className="text-right w-[150px] whitespace-nowrap">الحالة</TableHead>

                {/* عمود التحديد في النهاية بدون تثبيت */}
                <TableHead className="w-[55px] text-center border-r border-muted">
                  <Checkbox
                    checked={actionableRows.length > 0 && results.filter(r => r.status !== "paid").length === actionableRows.length}
                    onCheckedChange={(v) => handleSelectAll(!!v)}
                    aria-label="تحديد الكل"
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r, i) => {
                const isSelected = selectedIndexes.includes(i);
                const isPaidUser = r.status === "paid";

                return (
                  <TableRow key={i} className={`hover:bg-accent/30 group transition-colors duration-150 ${isSelected ? 'bg-primary/5 hover:bg-primary/10' : ''}`}>

                    {/* الترقيم التلقائي */}
                    <TableCell className="text-center font-medium text-muted-foreground/80 tabular-nums">
                      {(i + 1).toLocaleString("ar-EG")}
                    </TableCell>

                    {/* العميل */}
                    <TableCell className="text-right truncate">
                      <div className="font-medium text-foreground truncate" title={r.customer.name}>
                        {r.customer.name}
                      </div>

                    </TableCell>

                    {/* رقم الهاتف */}
                    <TableCell className="text-right text-muted-foreground tabular-nums whitespace-nowrap">
                      {r.customer.phone || "—"}
                    </TableCell>

                    {/* المتوقع */}
                    <TableCell className="text-left tabular-nums whitespace-nowrap">{fmt(r.customer.expected)}</TableCell>

                    {/* المدفوع */}
                    {showPaid && (
                      <TableCell className="text-left tabular-nums whitespace-nowrap">{fmt(r.paidAmount)}</TableCell>
                    )}

                    {/* المتبقي */}
                    {showMissing && (
                      <TableCell className="text-left tabular-nums font-medium text-warning-foreground whitespace-nowrap">
                        {fmt(r.customer.expected - r.paidAmount)}
                      </TableCell>
                    )}

                    {/* الزائد */}
                    {showExtra && (
                      <TableCell className="text-left tabular-nums font-medium text-info whitespace-nowrap">
                        {fmt(r.paidAmount - r.customer.expected)}+
                      </TableCell>
                    )}

                    {/* نسبة التطابق */}
                    {showConfidence && (
                      <TableCell className="text-left whitespace-nowrap">
                        <div className="inline-flex items-center gap-2" dir="ltr">
                          <span className="text-xs tabular-nums text-muted-foreground">{r.confidence}%</span>
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <span className="block h-full rounded-full bg-primary" style={{ width: `${r.confidence}%` }} />
                          </span>
                        </div>
                      </TableCell>
                    )}

                    {/* الحالة */}
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center gap-1.5 justify-start flex-wrap sm:flex-nowrap">
                        <Badge variant="outline" className={statusStyle[r.status]}>
                          {statusTranslation[r.status]}
                        </Badge>
                        {r.needsReview && (
                          <Badge variant="outline" className="border-warning/40 bg-warning/20 text-warning-foreground whitespace-nowrap">
                            <AlertTriangle className="ml-1 h-3 w-3 shrink-0" /> مراجعة
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* خانة الـ Checkbox في نهاية السطر بدون تثبيت */}
                    <TableCell className="text-center border-r border-muted/60">
                      <Checkbox
                        disabled={isPaidUser}
                        checked={isSelected}
                        onCheckedChange={(v) => handleSelectRow(i, !!v)}
                        aria-label={`تحديد ${r.customer.name}`}
                      />
                    </TableCell>

                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
