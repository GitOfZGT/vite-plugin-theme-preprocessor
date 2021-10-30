/* eslint-disable global-require */
/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
/* eslint-env browser */
import {
  assetsDir,
  buildCommand,
  browerPreprocessorOptions,
} from "./toBrowerEnvs";

export function addClassNameToHtmlTag({ scopeName, multipleScopeVars }) {
  const $multipleScopeVars =
    Array.isArray(multipleScopeVars) && multipleScopeVars.length
      ? multipleScopeVars
      : browerPreprocessorOptions.multipleScopeVars;

  let currentHtmlClassNames = (document.documentElement.className || "").split(
    /\s+/g
  );
  if (!currentHtmlClassNames.includes(scopeName)) {
    currentHtmlClassNames = currentHtmlClassNames.filter((classname) =>
      $multipleScopeVars.every((item) => item.scopeName !== classname)
    );
    currentHtmlClassNames.push(scopeName);
    document.documentElement.className = currentHtmlClassNames.join(" ");
  }
}

export function toggleTheme(opts) {
  const options = {
    // multipleScopeVars: [],
    scopeName: "theme-default",
    customLinkHref: (href) => href,
    // themeLinkTagId: "theme-link-tag",
    // "head" || "body"
    // themeLinkTagInjectTo: "head",
    ...opts,
  };

  if (buildCommand !== "build" || !browerPreprocessorOptions.extract) {
    addClassNameToHtmlTag(options);
    return;
  }
  let styleLink = document.getElementById(
    options.themeLinkTagId || browerPreprocessorOptions.themeLinkTagId
  );
  const href = options.customLinkHref(
    `/${(browerPreprocessorOptions.outputDir || assetsDir || "").replace(
      /(^\/+|\/+$)/g,
      ""
    )}/${options.scopeName}.css`
  );
  if (styleLink) {
    // 假如存在id为theme-link-tag 的link标签，直接修改其href
    styleLink.href = href;
    // 注：如果是removeCssScopeName:true移除了主题文件的权重类名，就可以不用修改className 操作
    if (!browerPreprocessorOptions.removeCssScopeName) {
      addClassNameToHtmlTag(options);
    }
  } else {
    // 不存在的话，则新建一个
    styleLink = document.createElement("link");
    styleLink.type = "text/css";
    styleLink.rel = "stylesheet";
    styleLink.id =
      options.themeLinkTagId || browerPreprocessorOptions.themeLinkTagId;
    styleLink.href = href;
    // 注：如果是removeCssScopeName:true移除了主题文件的权重类名，就可以不用修改className 操作
    if (!browerPreprocessorOptions.removeCssScopeName) {
      addClassNameToHtmlTag(options);
    }
    document[
      options.themeLinkTagInjectTo ||
        browerPreprocessorOptions.themeLinkTagInjectTo.replace("-prepend", "")
    ].append(styleLink);
  }
}

export default {
  toggleTheme,
  addClassNameToHtmlTag,
};
