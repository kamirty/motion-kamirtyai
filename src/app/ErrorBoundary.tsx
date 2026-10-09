import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

const AUTOSAVE_KEY = 'kamirty-motion:autosave:v1';

/**
 * Last-resort screen instead of a blank page. Offers a reload and, if the saved project itself is
 * the cause, a reset that keeps a downloadable copy of it first.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  private backupAndReset = () => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const url = URL.createObjectURL(new Blob([saved], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kamirty-motion-backup.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
      localStorage.removeItem(AUTOSAVE_KEY);
    } catch {
      /* storage unavailable: reload is still worth trying */
    }
    location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h1>حدث خطأ غير متوقع</h1>
        <p>نعتذر! توقفت الأداة بسبب خطأ. جرّب إعادة تحميل الصفحة؛ وإن تكرر الخطأ فابدأ من جديد (سنحفظ لك نسخة من مشروعك أولًا).</p>
        <div className="row">
          <button type="button" className="primary" onClick={() => location.reload()}>
            إعادة تحميل الصفحة
          </button>
          <button type="button" onClick={this.backupAndReset}>
            حفظ نسخة والبدء من جديد
          </button>
        </div>
        <details>
          <summary>تفاصيل تقنية</summary>
          <pre dir="ltr">{String(this.state.error?.stack ?? this.state.error)}</pre>
        </details>
      </div>
    );
  }
}
