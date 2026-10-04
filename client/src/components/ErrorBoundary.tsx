import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      // A lazy route chunk that cannot load means the device is offline or a
      // new deploy replaced the old file. The fix for both is to reload.
      const isChunkError = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(
        this.state.error?.message ?? ""
      );
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div
            role="alert"
            className="flex flex-col items-center w-full max-w-2xl p-8"
          >
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="type-lead mb-2 text-[var(--color-ink)]">
              {isChunkError ? "โหลดหน้านี้ไม่สำเร็จ" : "เกิดข้อผิดพลาดที่ไม่คาดคิด"}
            </h2>
            <p className="type-caption mb-4 text-center text-muted-foreground">
              {isChunkError
                ? "ตรวจสอบสัญญาณอินเทอร์เน็ต แล้วกดโหลดหน้าใหม่"
                : "กรุณากดโหลดหน้าใหม่ หากยังพบปัญหาเดิม แจ้งผู้ดูแลระบบ"}
            </p>

            {import.meta.env.DEV && (
              <div className="mb-6 w-full overflow-auto rounded bg-muted p-4">
                <pre className="type-fine whitespace-break-spaces text-[var(--color-ink)]">
                  {this.state.error?.stack}
                </pre>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex min-h-11 items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              โหลดหน้าใหม่
            </button>
            <a href="/" className="type-caption mt-4 inline-flex min-h-11 items-center text-[var(--color-primary)] underline">
              กลับหน้าหลัก
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
