import * as React from "react";
export { useState, useMemo, useEffect } from "react";
export type ChangeEvent<T = Element> = React.ChangeEvent<T>;
export function useGrokTheme() { return { font: { family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' } }; }
export function Page(props: { title: string; summary?: string; width?: string; children?: React.ReactNode }) {
  return <main style={{ maxWidth: "560px", margin: "0 auto" }}>{props.children}</main>;
}
