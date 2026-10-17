/**
 * Starts a same-origin file download without opening a new window.
 * `window.open(url, "_blank")` is unreliable in the LINE in-app browser and in
 * an installed (standalone) PWA, where the new window can be blocked or left
 * blank; an anchor with `download` keeps the user where they are. The session
 * cookie travels with the request, so authorization is unchanged.
 */
export function downloadFile(url: string, filename?: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename ?? "";
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
