import path from "path";

import fsExtra from "fs-extra";

/**
 * 复原源处理器包的位置
 * @param {*} { langs: ['scss','less'] }
 * @returns
 */
export function resetStylePreprocessor(options = {}) {
  if (!Array.isArray(options.langs) || !options.langs.length) {
    return Promise.resolve();
  }
  options.langs.forEach((lang) => {
    const langName = lang === "scss" ? "sass" : lang;
    let isSubstitute = false;
    let resolveDir = "";
    let resolveName = "";
    try {
      const resolved = require.resolve(langName).replace(/\\/g, "/");
      const pathnames = resolved.split("/");
      const index = pathnames.findIndex(
        (str) => new RegExp(`^_${langName}@`).test(str) || str === langName
      );
      resolveName = pathnames[index];
      resolveDir = `${pathnames.slice(0, index).join("/")}/${resolveName}`;
      isSubstitute = fsExtra.existsSync(
        `${resolveDir}/preprocessor-substitute-options.js`
      );
      // eslint-disable-next-line no-empty
    } catch (e) {}

    if (isSubstitute) {
      // 替换处理器
      if (fsExtra.existsSync(resolveDir)) {
        const preprocessorFiles = fsExtra.readdirSync(resolveDir) || [];

        preprocessorFiles.forEach((name) => {
          if (name !== "node_modules" && name !== "bin") {
            fsExtra.removeSync(`${resolveDir}/${name}`);
          }
        });
      }
      const originalPreDir = path
        .resolve("node_modules/.zougtTheme/original", resolveName)
        .replace(/\\/g, "/");
      if (fsExtra.existsSync(originalPreDir)) {
        const originalFiles = fsExtra.readdirSync(originalPreDir) || [];
        originalFiles.forEach((name) => {
          if (name !== "node_modules" && name !== "bin") {
            fsExtra.copySync(
              `${originalPreDir}/${name}`,
              `${resolveDir}/${name}`
            );
          }
        });
      }
    }
  });
  return Promise.resolve();
}

export default resetStylePreprocessor;
