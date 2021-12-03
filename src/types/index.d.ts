import { Plugin as Plugin_2 } from "vite";

declare module "@getCustomThemeSetter" {
  export function getCustomThemeSetter(options: Object): Function;
  export  default  getCustomThemeSetter;
}
declare module "color" {
  export function Color(options: Object): Function;
  export  default  Color;
}

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
