// Allow importing CSS files as raw strings (Vite `?raw` suffix) so the portal
// theme can live in restormel-theme.css and be passed to theme.customCss.
declare module "*.css?raw" {
  const content: string;
  export default content;
}
