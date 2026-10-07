import { Component, type ReactNode } from "react";
import { useLocation } from "wouter";
import { ErrorState } from "@/components/DesignSystem";

interface BoundaryProps {
  children: ReactNode;
  /** When this value changes (a new route), a caught error is cleared. */
  resetKey: string;
  /**
   * Wraps the error message in the app shell. Pages render their own layout, so
   * an error thrown by the page itself unmounts the layout with it; this puts
   * the sidebar or bottom navigation back around the message.
   */
  wrap?: (content: ReactNode) => ReactNode;
}

interface BoundaryState {
  error: Error | null;
}

class Boundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidUpdate(prev: BoundaryProps) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const message = (
      <ErrorState
        title="แสดงหน้านี้ไม่สำเร็จ"
        description="ข้อมูลที่ได้รับจากระบบอาจไม่ครบหรือไม่ตรงกับที่หน้านี้ต้องการ ลองอีกครั้ง หรือเปิดเมนูอื่นแล้วกลับมา"
        technical={import.meta.env.DEV ? this.state.error.stack : undefined}
        onRetry={() => this.setState({ error: null })}
      />
    );
    return this.props.wrap ? this.props.wrap(message) : message;
  }
}

/**
 * Contains a render error to the page area so the sidebar, topbar and bottom
 * navigation stay usable. The app-level `ErrorBoundary` is still the last
 * resort for errors outside a page (the layout itself, providers).
 */
export function RouteErrorBoundary({
  children,
  wrap,
}: {
  children: ReactNode;
  wrap?: (content: ReactNode) => ReactNode;
}) {
  const [location] = useLocation();
  return (
    <Boundary resetKey={location} wrap={wrap}>
      {children}
    </Boundary>
  );
}
