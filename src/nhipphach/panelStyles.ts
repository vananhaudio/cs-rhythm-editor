import type { CSSProperties } from "react";

/** Khung hộp thoại dùng chung: "Bản nhạc của tôi" và "Thư viện bản nhạc". */
export const phu: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(24,24,27,.55)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "5vh 16px",
  zIndex: 60,
};
export const hop: CSSProperties = {
  background: "var(--surface)",
  borderRadius: 14,
  width: "min(680px, 100%)",
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 18px 48px rgba(0,0,0,.28)",
};
