import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Dashboard = {
  title: string;
  url: string;
  durationSeconds?: number;
  accent?: string;
};

type SlideshowConfig = {
  dashboards?: Dashboard[];
  defaults?: {
    durationSeconds?: number;
  };
};

const fallbackDashboards: Dashboard[] = [
  {
    title: "Configuration needed",
    url: "data:text/html,%3Cbody%20style%3D%22margin%3A0%3Bdisplay%3Agrid%3Bplace-items%3Acenter%3Bheight%3A100vh%3Bfont-family%3AArial%2Csans-serif%3Bbackground%3A%23f5f1ea%3Bcolor%3A%23241f1b%22%3E%3Cmain%20style%3D%22max-width%3A720px%3Bpadding%3A32px%3Btext-align%3Acenter%22%3E%3Ch1%3EAdd%20dashboard%20URLs%20to%20config.json%3C%2Fh1%3E%3Cp%3EThe%20Metabase%20TV%20slideshow%20loads%20dashboards%20from%20public%2Fconfig.json.%3C%2Fp%3E%3C%2Fmain%3E%3C%2Fbody%3E",
    durationSeconds: 60,
    accent: "#2f7d80",
  },
];

function clampDuration(seconds: number | undefined, fallback: number) {
  if (!seconds || Number.isNaN(seconds)) {
    return fallback;
  }

  return Math.max(8, seconds);
}

function normalizeConfig(config: SlideshowConfig): Dashboard[] {
  const defaultDuration = clampDuration(config.defaults?.durationSeconds, 60);
  const dashboards = config.dashboards?.filter(
    (dashboard) => dashboard.title && dashboard.url,
  );

  if (!dashboards?.length) {
    return fallbackDashboards;
  }

  return dashboards.map((dashboard) => ({
    ...dashboard,
    durationSeconds: clampDuration(dashboard.durationSeconds, defaultDuration),
  }));
}

function useClock() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const tick = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  return time.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="control-icon">
      {children}
    </span>
  );
}

export default function App() {
  const [dashboards, setDashboards] = useState<Dashboard[]>(fallbackDashboards);
  const [configState, setConfigState] = useState<"loading" | "ready" | "demo">(
    "loading",
  );
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [slideStart, setSlideStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [reloadToken, setReloadToken] = useState(0);
  const viewportRef = useRef<HTMLElement | null>(null);
  const clock = useClock();

  useEffect(() => {
    let isMounted = true;

    fetch("/config.json", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("config unavailable");
        }

        return response.json() as Promise<SlideshowConfig>;
      })
      .then((config) => {
        if (!isMounted) {
          return;
        }

        setDashboards(normalizeConfig(config));
        setConfigState("ready");
        setIndex(0);
        setSlideStart(Date.now());
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setDashboards(fallbackDashboards);
        setConfigState("demo");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const dashboard = dashboards[index] ?? fallbackDashboards[0];
  const durationMs = clampDuration(dashboard.durationSeconds, 60) * 1000;

  const advance = useCallback(
    (direction: 1 | -1 = 1) => {
      setIndex((current) => {
        const next = current + direction;
        return (next + dashboards.length) % dashboards.length;
      });
      setSlideStart(Date.now());
      setNow(Date.now());
    },
    [dashboards.length],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (isPaused) {
        return;
      }

      const nextNow = Date.now();
      setNow(nextNow);

      if (nextNow - slideStart >= durationMs) {
        advance(1);
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [advance, durationMs, isPaused, slideStart]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        advance(1);
      }

      if (event.key === "ArrowLeft") {
        advance(-1);
      }

      if (event.key === " ") {
        event.preventDefault();
        setIsPaused((current) => !current);
      }

      if (event.key.toLowerCase() === "r") {
        setReloadToken((current) => current + 1);
      }

      if (event.key.toLowerCase() === "f") {
        viewportRef.current?.requestFullscreen?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance]);

  const progress = useMemo(
    () => Math.min(100, ((now - slideStart) / durationMs) * 100),
    [durationMs, now, slideStart],
  );

  const src = `${dashboard.url}${
    dashboard.url.includes("?") ? "&" : "?"
  }tvReload=${reloadToken}`;
  const status = configState === "demo" ? "Demo feed" : "Live feed";

  return (
    <main
      ref={viewportRef}
      className="tv-shell"
      style={
        {
          "--accent": dashboard.accent ?? "#2f7d80",
        } as CSSProperties
      }
    >
      <section className="dashboard-stage" aria-label={dashboard.title}>
        <iframe
          key={`${dashboard.url}-${reloadToken}`}
          src={src}
          title={dashboard.title}
          className="dashboard-frame"
          allow="fullscreen"
        />
      </section>

      <div className="top-overlay">
        <div>
          <p className="eyebrow">{status}</p>
          <h1>{dashboard.title}</h1>
        </div>
        <div className="clock">{clock}</div>
      </div>

      <div className="bottom-overlay">
        <div className="slide-count">
          {index + 1}
          <span>/</span>
          {dashboards.length}
        </div>

        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="controls" aria-label="Slideshow controls">
          <button
            type="button"
            onClick={() => advance(-1)}
            aria-label="Previous dashboard"
            title="Previous dashboard"
          >
            <Icon>
              <svg viewBox="0 0 24 24">
                <path d="m15 6-6 6 6 6" />
              </svg>
            </Icon>
          </button>
          <button
            type="button"
            onClick={() => setIsPaused((current) => !current)}
            aria-label={isPaused ? "Resume slideshow" : "Pause slideshow"}
            title={isPaused ? "Resume slideshow" : "Pause slideshow"}
          >
            <Icon>
              {isPaused ? (
                <svg viewBox="0 0 24 24">
                  <path d="m8 5 11 7-11 7V5z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24">
                  <path d="M9 5v14" />
                  <path d="M15 5v14" />
                </svg>
              )}
            </Icon>
          </button>
          <button
            type="button"
            onClick={() => advance(1)}
            aria-label="Next dashboard"
            title="Next dashboard"
          >
            <Icon>
              <svg viewBox="0 0 24 24">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Icon>
          </button>
          <button
            type="button"
            onClick={() => setReloadToken((current) => current + 1)}
            aria-label="Refresh dashboard"
            title="Refresh dashboard"
          >
            <Icon>
              <svg viewBox="0 0 24 24">
                <path d="M20 12a8 8 0 1 1-2.35-5.65" />
                <path d="M20 4v6h-6" />
              </svg>
            </Icon>
          </button>
          <button
            type="button"
            onClick={() => viewportRef.current?.requestFullscreen?.()}
            aria-label="Fullscreen"
            title="Fullscreen"
          >
            <Icon>
              <svg viewBox="0 0 24 24">
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            </Icon>
          </button>
        </div>
      </div>
    </main>
  );
}
