import { Plugin as Plugin_2 } from "vite";
export declare interface Options {
  multipleScopeVars?: Object[];
  outputDir?: string;
  defaultScopeName?: string;
  extract?: boolean;
  themeLinkTagId?: string;
  themeLinkTagInjectTo?: string;
  removeCssScopeName?: boolean;
  customThemeCssFileName?: Function;
}
declare function themePreprocessorPlugin(rawOptions?: Options): Plugin_2;
export default themePreprocessorPlugin;
