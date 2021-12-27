/* eslint-disable global-require */
/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
/* eslint-env browser */
import {
  basePath,
  assetsDir,
  buildCommand,
  browerPreprocessorOptions,
} from "./toBrowerEnvs";

function getRegstr(scopeName) {
  return `(^${scopeName}\\s+|\\s+${scopeName}\\s+|\\s+${scopeName}$|^${scopeName}$)`;
}
export function addClassNameToHtmlTag({ scopeName, multipleScopeVars }) {
  const $multipleScopeVars =
    Array.isArray(multipleScopeVars) && multipleScopeVars.length
      ? multipleScopeVars
      : browerPreprocessorOptions.multipleScopeVars;

  let currentClassName = document.documentElement.className;

  if (new RegExp(getRegstr(scopeName)).test(currentClassName)) {
    return;
  }
  $multipleScopeVars.forEach((item) => {
    currentClassName = currentClassName.replace(
      new RegExp(getRegstr(item.scopeName), "g"),
      ` ${scopeName} `
    );
  });
  document.documentElement.className = currentClassName.replace(
    /(^\s+|\s+$)/g,
    ""
  );
}
function createThemeLinkTag({ id, href }) {
  // 不存在的话，则新建一个
  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = href;
  styleLink.id = id;
  return styleLink;
}
/**
 *
 * @param {object} opts
 * @param {string} opts.scopeName
 * @returns
 */
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
  const linkId =
    options.themeLinkTagId || browerPreprocessorOptions.themeLinkTagId;
  let styleLink = document.getElementById(linkId);
  const href = options.customLinkHref(
    `/${basePath || ""}/${
      browerPreprocessorOptions.outputDir || assetsDir || ""
    }/${options.scopeName}.css`.replace(/\/+(?=\/)/g, "")
  );
  if (styleLink) {
    // 假如存在id为theme-link-tag 的link标签，创建一个新的添加上去加载完成后再60毫秒后移除旧的
    styleLink.id = `${linkId}_old`;
    const newLink = createThemeLinkTag({ id: linkId, href });
    if (styleLink.nextSibling) {
      styleLink.parentNode.insertBefore(newLink, styleLink.nextSibling);
    } else {
      styleLink.parentNode.appendChild(newLink);
    }
    newLink.onload = () => {
      setTimeout(() => {
        styleLink.parentNode.removeChild(styleLink);
        styleLink = null;
      }, 60);
      // 注：如果是removeCssScopeName:true移除了主题文件的权重类名，就可以不用修改className 操作
      if (!browerPreprocessorOptions.removeCssScopeName) {
        addClassNameToHtmlTag(options);
      }
    };
    return;
  }
  // 不存在的话，则新建一个
  styleLink = createThemeLinkTag({ id: linkId, href });
  // 注：如果是removeCssScopeName:true移除了主题文件的权重类名，就可以不用修改className 操作
  if (!browerPreprocessorOptions.removeCssScopeName) {
    addClassNameToHtmlTag(options);
  }
  document[
    (
      options.themeLinkTagInjectTo ||
      browerPreprocessorOptions.themeLinkTagInjectTo ||
      ""
    ).replace("-prepend", "")
  ].appendChild(styleLink);
}

export default {
  toggleTheme,
  addClassNameToHtmlTag,
};
