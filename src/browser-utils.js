/* eslint-disable global-require */
/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
/* eslint-env browser */

function addClassNameToHtmlTag({ scopeName, multipleScopeVars }) {
  const allmultipleScopeVars = require("./allmultipleScopeVars");
  const $multipleScopeVars = Array.isArray(multipleScopeVars)
    ? multipleScopeVars
    : allmultipleScopeVars;

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

function toggleTheme(opts) {
  const options = {
    multipleScopeVars:[],
    scopeName: "theme-default",
    customLinkHref: (href) => href,
    themeLinkTagId: "theme-link-tag",
    // 是否已经对抽取的css文件内对应scopeName的权重类名移除了
    hasRemoveScopeName: false,
    // "head" || "body"
    themeLinkTagInjectTo: "head",
    ...opts,
  };
  let styleLink = document.getElementById(options.themeLinkTagId);
  if (styleLink) {
    // 假如存在id为theme-link-tag 的link标签，直接修改其href
    styleLink.href = options.customLinkHref(`/${options.scopeName}.css`);
    // 注：如果是removeCssScopeName:true移除了主题文件的权重类名，就可以不用修改className 操作
    if (!options.hasRemoveScopeName) {
      addClassNameToHtmlTag(options);
    }
  } else {
    // 不存在的话，则新建一个
    styleLink = document.createElement("link");
    styleLink.type = "text/css";
    styleLink.rel = "stylesheet";
    styleLink.id = options.themeLinkTagId;
    styleLink.href = options.customLinkHref(`/${options.scopeName}.css`);
    // 注：如果是removeCssScopeName:true移除了主题文件的权重类名，就可以不用修改className 操作
    if (!options.hasRemoveScopeName) {
      addClassNameToHtmlTag(options);
    }
    document[options.themeLinkTagInjectTo].append(styleLink);
  }
}
exports.addClassNameToHtmlTag = addClassNameToHtmlTag;
exports.toggleTheme = toggleTheme;
module.exports = {
  toggleTheme,
  addClassNameToHtmlTag,
};
