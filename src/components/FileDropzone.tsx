import { useCallback, useRef, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, X } from "lucide-react";
import { cn } from "../lib/utils";
type Props = {
  title: string;
  description: string;
  file: File | null;
  onFile: (f: File | null) => void;
  accent?: "primary" | "info";
};

export function FileDropzone({ title, description, file, onFile, accent = "primary" }: Props) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const f = files[0];
      if (!/\.(xlsx|xls|csv)$/i.test(f.name)) return;
      onFile(f);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handleFiles(e.dataTransfer.files);
      }}
      // إضافة dir="rtl" لضبط اتجاه العناصر بالداخل
      dir="rtl"
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)] transition-all",
        drag && "border-primary ring-4 ring-primary/15",
        file && "border-success/40"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl",
            accent === "primary" ? "bg-primary/10 text-primary" : "bg-info/10 text-info"
          )}
        >
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        {/* المحاذاة لليمين للنصوص الممررة من الخارج */}
        <div className="flex-1 text-right">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "mt-4 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-8 text-sm transition-colors cursor-pointer",
          "hover:border-primary/60 hover:bg-accent/40",
          drag && "border-primary bg-primary/5"
        )}
      >
        {file ? (
          <>
            <CheckCircle2 className="h-7 w-7 text-success" />
            {/* ترقيم أحادي التناسق لاسم الملف والتعريب للنص المساعد */}
            <span className="font-medium text-foreground tabular-nums">{file.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {(file.size / 1024).toFixed(1)} كيلوبايت · اضغط لاستبدال الملف
            </span>
          </>
        ) : (
          <>
            <Upload className="h-7 w-7 text-muted-foreground" />
            <span className="font-medium text-foreground">أفلت الملف هنا أو اضغط للتصفح</span>
            <span className="text-xs text-muted-foreground tabular-nums">.xlsx, .xls, .csv</span>
          </>
        )}
      </button>

      {file && (
        <button
          onClick={() => onFile(null)}
          // تم تبديل الكلاس من right-4 إلى left-4 ليتناسب زر الحذف (X) مع موقعه الأيسر في الواجهات العربية
          className="absolute left-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
          aria-label="إزالة الملف"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

// import { useCallback, useRef, useState } from "react";
// import { Upload, FileSpreadsheet, CheckCircle2, X } from "lucide-react";
// import { cn } from "@/lib/utils";

// type Props = {
//   title: string;
//   description: string;
//   file: File | null;
//   onFile: (f: File | null) => void;
//   accent?: "primary" | "info";
// };

// export function FileDropzone({ title, description, file, onFile, accent = "primary" }: Props) {
//   const [drag, setDrag] = useState(false);
//   const inputRef = useRef<HTMLInputElement>(null);

//   const handleFiles = useCallback(
//     (files: FileList | null) => {
//       if (!files || files.length === 0) return;
//       const f = files[0];
//       if (!/\.(xlsx|xls|csv)$/i.test(f.name)) return;
//       onFile(f);
//     },
//     [onFile]
//   );

//   return (
//     <div
//       onDragOver={(e) => {
//         e.preventDefault();
//         setDrag(true);
//       }}
//       onDragLeave={() => setDrag(false)}
//       onDrop={(e) => {
//         e.preventDefault();
//         setDrag(false);
//         handleFiles(e.dataTransfer.files);
//       }}
//       className={cn(
//         "group relative flex flex-col rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)] transition-all",
//         drag && "border-primary ring-4 ring-primary/15",
//         file && "border-success/40"
//       )}
//     >
//       <div className="flex items-start gap-3">
//         <div
//           className={cn(
//             "flex h-11 w-11 items-center justify-center rounded-xl",
//             accent === "primary" ? "bg-primary/10 text-primary" : "bg-info/10 text-info"
//           )}
//         >
//           <FileSpreadsheet className="h-5 w-5" />
//         </div>
//         <div className="flex-1">
//           <h3 className="font-semibold text-foreground">{title}</h3>
//           <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
//         </div>
//       </div>

//       <button
//         type="button"
//         onClick={() => inputRef.current?.click()}
//         className={cn(
//           "mt-4 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-8 text-sm transition-colors",
//           "hover:border-primary/60 hover:bg-accent/40",
//           drag && "border-primary bg-primary/5"
//         )}
//       >
//         {file ? (
//           <>
//             <CheckCircle2 className="h-7 w-7 text-success" />
//             <span className="font-medium text-foreground">{file.name}</span>
//             <span className="text-xs text-muted-foreground">
//               {(file.size / 1024).toFixed(1)} KB · click to replace
//             </span>
//           </>
//         ) : (
//           <>
//             <Upload className="h-7 w-7 text-muted-foreground" />
//             <span className="font-medium text-foreground">Drop file or click to browse</span>
//             <span className="text-xs text-muted-foreground">.xlsx, .xls, .csv</span>
//           </>
//         )}
//       </button>

//       {file && (
//         <button
//           onClick={() => onFile(null)}
//           className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
//           aria-label="Remove file"
//         >
//           <X className="h-4 w-4" />
//         </button>
//       )}

//       <input
//         ref={inputRef}
//         type="file"
//         accept=".xlsx,.xls,.csv"
//         className="hidden"
//         onChange={(e) => handleFiles(e.target.files)}
//       />
//     </div>
//   );
// }
