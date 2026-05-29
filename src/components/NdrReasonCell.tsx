"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { formatNdrReason } from "@/lib/format";
import { useShipmentNavigation } from "@/contexts/shipment-navigation";

type Props = {
  shipmentId: string;
  reasonCode: string;
};

const POPOVER_WIDTH = 288;
const VIEWPORT_PADDING = 8;

export function NdrReasonCell({ shipmentId, reasonCode }: Props) {
  const text = formatNdrReason(reasonCode);
  const anchorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const { navigateToShipment, viewingShipmentId } = useShipmentNavigation();
  const isViewLoading = viewingShipmentId === shipmentId;

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const popoverHeight = popoverRef.current?.offsetHeight ?? 220;

    let left = rect.left;
    if (left + POPOVER_WIDTH > window.innerWidth - VIEWPORT_PADDING) {
      left = window.innerWidth - POPOVER_WIDTH - VIEWPORT_PADDING;
    }
    left = Math.max(VIEWPORT_PADDING, left);

    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
    const spaceAbove = rect.top - VIEWPORT_PADDING;
    const gap = 6;

    // Prefer above when near bottom of viewport (e.g. last rows in table)
    const placeAbove =
      spaceBelow < popoverHeight + gap ||
      (spaceAbove > spaceBelow && rect.bottom > window.innerHeight * 0.55);

    let top: number;
    if (placeAbove) {
      top = Math.max(VIEWPORT_PADDING, rect.top - popoverHeight - gap);
    } else {
      top = rect.bottom + gap;
      if (top + popoverHeight > window.innerHeight - VIEWPORT_PADDING) {
        top = Math.max(
          VIEWPORT_PADDING,
          window.innerHeight - popoverHeight - VIEWPORT_PADDING,
        );
      }
    }

    setPosition({ top, left });
  }, []);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  const showPopover = () => {
    cancelClose();
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition, text]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    return () => cancelClose();
  }, []);

  const popover =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={popoverRef}
        className="fixed z-50 w-72 rounded-lg border border-slate-200 bg-white shadow-xl"
        style={{ top: position.top, left: position.left }}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        role="tooltip"
      >
        <div className="max-h-40 overflow-y-auto overflow-x-hidden p-3 text-sm leading-relaxed text-slate-700">
          {text}
        </div>
        <div className="border-t border-slate-100 px-3 py-2.5">
          <button
            type="button"
            disabled={isViewLoading}
            onClick={() => {
              setOpen(false);
              navigateToShipment(shipmentId);
            }}
            className="cursor-pointer inline-flex items-center gap-1.5 text-left text-xs font-medium text-sky-700 hover:text-sky-900 disabled:opacity-50"
          >
            {isViewLoading ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            )}
            View details
          </button>
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <div
        ref={anchorRef}
        className="max-w-[200px] cursor-default"
        onMouseEnter={showPopover}
        onMouseLeave={scheduleClose}
      >
        <p className="line-clamp-2 text-xs leading-snug text-slate-600">
          {text}
        </p>
      </div>
      {popover}
    </>
  );
}
