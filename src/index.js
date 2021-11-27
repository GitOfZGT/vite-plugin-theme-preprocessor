import path from "path";

import fsExtra from "fs-extra";

import stringHash from "string-hash";

import {
  extractThemeCss,
  addScopnameToHtmlClassname,
  createPulignParamsFile,
  createSetCustomThemeFile,
  getCurrentPackRequirePath,
} from "@zougt/some-loader-utils";

import pack from "../package.json";
// eslint-disable-next-line import/no-unresolved
export function getModulesScopeGenerater(opt) {
  return (name, filename, css) => {
    if ((opt.multipleScopeVars || []).some((item) => item.scopeName === name)) {
      return name;
    }

    if (typeof opt.generateScopedName === "function") {
      return opt.generateScopedName(name, filename, css);
    }

    const i = css.indexOf(`.${name}`);
    const lineNumber = css.substr(0, i).split(/[\r\n]/).length;
    const hash = stringHash(css).toString(36).substr(0, 5);
    return `_${name}_${hash}_${lineNumber}`;
  };
}

function addExtractThemeLinkTag({
  html,
  defaultOptions,
  allmultipleScopeVars,
  buildCommand,
  config,
}) {
  // 向html中添加抽取的主题css文件的link标签，并在html标签中添加 calssName
  let newHtml = html;
  const tags = [];
  const {
    themeLinkTagInjectTo,
    extract,
    removeCssScopeName,
    themeLinkTagId,
    outputDir,
    defaultScopeName,
    customThemeCssFileName,
  } = defaultOptions;

  if (Array.isArray(allmultipleScopeVars) && allmultipleScopeVars.length) {
    const scopeName = defaultScopeName || allmultipleScopeVars[0].scopeName;

    if (buildCommand !== "build" || !removeCssScopeName) {
      newHtml = addScopnameToHtmlClassname(newHtml, scopeName);
    }

    if (buildCommand === "build" && extract && themeLinkTagId) {
      const filename =
        (typeof customThemeCssFileName === "function"
          ? customThemeCssFileName(scopeName)
          : "") || scopeName;
      const linkHref = `/${config.base || ""}/${
        outputDir || config.build.assetsDir
      }/${filename}.css`.replace(/\/+(?=\/)/g, "");
      const tag = {
        tag: "link",
        attrs: {
          rel: "stylesheet",
          href: linkHref,
          id: themeLinkTagId,
        },
        injectTo: themeLinkTagInjectTo,
      };
      tags.push(tag);
    }
  }
  return {
    html: newHtml,
    tags,
  };
}

/**
 * lang : "less" | "scss" | "sass"
 * @param {*} options : { [lang]:{ multipleScopeVars: [{scopeName:"theme-1",path: path.resolve('./vars.less')}], outputDir, defaultScopeName ,extract,removeCssScopeName,customThemeCssFileName,themeLinkTagId,themeLinkTagInjectTo } }
 * @returns
 */

export default function themePreprocessorPlugin(options = {}) {
  let config = {
    root: process.cwd(),
  };
  let buildCommand;
  const processorNames = Object.keys(options);
  let browerPreprocessorOptions = {};
  let defaultOptions = {
    outputDir: "",
    // 默认取 multipleScopeVars[0].scopeName
    defaultScopeName: "",
    extract: true,
    themeLinkTagId: "theme-link-tag",
    // "head"||"head-prepend" || "body" ||"body-prepend"
    themeLinkTagInjectTo: "head",
    removeCssScopeName: false,
    customThemeCssFileName: null,

    arbitraryMode: false,
    defaultPrimaryColor: "",
    customThemeOutputPath: "",
    styleTagId: "custom-theme-tagid",
    InjectDefaultStyleTagToHtml: true,
  };
  const allmultipleScopeVars = [];
  return {
    name: "vite-plugin-theme-preprocessor",
    enforce: "pre",

    config(conf, { command }) {
      buildCommand = command;
      // 在对应的预处理器配置添加 multipleScopeVars 属性

      const css = conf.css || {};
      const preprocessorOptions = css.preprocessorOptions || {};

      processorNames.forEach((lang) => {
        const langOptions = options[lang] || {};
        defaultOptions = { ...defaultOptions, ...langOptions };
        browerPreprocessorOptions = langOptions;
        if (
          Array.isArray(langOptions.multipleScopeVars) &&
          langOptions.multipleScopeVars.length
        ) {
          preprocessorOptions[lang] = {
            ...(preprocessorOptions[lang] || {}),
            multipleScopeVars: langOptions.multipleScopeVars,
            arbitraryMode: defaultOptions.arbitraryMode,
          };
          langOptions.multipleScopeVars.forEach((item) => {
            const founded = allmultipleScopeVars.find(
              (f) => f.scopeName === item.scopeName
            );
            if (founded) {
              let paths = [];
              if (Array.isArray(founded.path)) {
                paths = paths.concat(founded.path);
              } else if (founded.path) {
                paths.push(founded.path);
              }
              if (Array.isArray(item.path)) {
                paths = paths.concat(item.path);
              } else if (item.path) {
                paths.push(item.path);
              }
              founded.path = paths;
            } else {
              allmultipleScopeVars.push(item);
            }
          });
        }
      });
      css.preprocessorOptions = preprocessorOptions;
      const modulesOptions = css.modules !== false ? css.modules || {} : null;

      if (modulesOptions) {
        modulesOptions.generateScopedName = getModulesScopeGenerater({
          multipleScopeVars: allmultipleScopeVars,
          generateScopedName: modulesOptions.generateScopedName,
        });
      }

      css.modules = modulesOptions; // eslint-disable-next-line no-param-reassign

      conf.css = css;
    },

    configResolved(resolvedConfig) {
      // 存储最终解析的配置
      config = resolvedConfig;

      createPulignParamsFile({
        extract: buildCommand !== "build" ? false : defaultOptions.extract,
      });

      const targetRsoleved = require
        .resolve(pack.name, {
          paths: [config.root],
        })
        .replace(/[\\/]index\.js$/, "");
      // 将一些参数打入到 toBrowerEnvs.js , 由brower-utils.js 获取
      fsExtra.writeFileSync(
        `${targetRsoleved}/toBrowerEnvs.js`,
        `export const browerPreprocessorOptions = ${JSON.stringify(
          browerPreprocessorOptions
        )};\nexport const basePath="${
          config.base || ""
        }";\nexport const assetsDir="${
          config.build.assetsDir || ""
        }";\nexport const buildCommand="${buildCommand}";
        `
      );
    },

    buildStart() {
      // @zougt/vite-plugin-theme-preprocessor 被 require() 时的实际路径
      const targetRsoleved = require
        .resolve(pack.name, {
          paths: [config.root],
        })
        .replace(/[\\/]dist[\\/]index\.js$/, "");

      return Promise.all(
        processorNames.map((lang) => {
          const langName = lang === "scss" ? "sass" : lang;
          // 得到 require('less') 时的绝对路径
          const resolved = require
            .resolve(langName, {
              paths: [config.root],
            })
            .replace(/\\/g, "/");
          const pathnames = resolved.split("/");
          // 存在类似 _less@ 开头的，兼容cnpm install
          const index = pathnames.findIndex(
            (str) => new RegExp(`^_${langName}@`).test(str) || str === langName
          );
          // 真正 less 执行的目录名称，通常情况下就是 "less" , 但cnpm install的可能就是 "_less@4.1.2@less"
          const resolveName = pathnames[index];
          // 完整的 less 所在的路径
          const resolveDir = `${pathnames
            .slice(0, index)
            .join("/")}/${resolveName}`;

          if (!fsExtra.existsSync(resolveDir)) {
            throw new Error(
              `Preprocessor dependency "${langName}" not found. Did you install it?`
            );
          }
          // substitute：替代品的源位置
          const substituteDir = `${targetRsoleved}/dist/substitute`;
          const substitutePreprocessorDir = `${substituteDir}/${resolveName}`;

          return resetStylePreprocessor({ lang: [langName] }).then(() => {
            // "getLess" || "getSass"
            const funName = `get${
              langName.slice(0, 1).toUpperCase() + langName.slice(1)
            }`;

            // 在substitute生成替代包
            fsExtra.copySync(resolveDir, substitutePreprocessorDir);

            fsExtra.copySync(
              `${substituteDir}/preprocessor-substitute-options.js`,
              `${substitutePreprocessorDir}/preprocessor-substitute-options.js`
            );
            const originalDir = `${path.resolve(
              "node_modules/.zougtTheme/original"
            )}`;
            // require('less')时的文件名，如 "index.js"
            const mainFile = resolved
              .replace(resolveDir, "")
              .replace(/^\/+/g, "");
            // 向 "index.js" 中写上如 "getLess" 的调用
            fsExtra.writeFileSync(
              `${substitutePreprocessorDir}/${mainFile}`,
              `const nodePreprocessor = require("${originalDir}/${resolveName}/${mainFile}");
                const { ${funName} } =  require("@zougt/some-loader-utils");
                module.exports = ${funName}({
                  arbitraryMode:${defaultOptions.arbitraryMode},
                  implementation: nodePreprocessor,
                });
                `
            );
            // 如果 源less中存在bin，生成一份替代品的bin
            if (fsExtra.existsSync(`${resolveDir}/bin`)) {
              fsExtra.readdirSync(`${resolveDir}/bin`).forEach((name) => {
                if (fsExtra.statSync(`${resolveDir}/bin/${name}`).isFile()) {
                  if (!fsExtra.existsSync(`${substitutePreprocessorDir}/bin`)) {
                    fsExtra.mkdirSync(`${substitutePreprocessorDir}/bin`);
                  }
                  fsExtra.writeFileSync(
                    `${substitutePreprocessorDir}/bin/${name}`,
                    `#!/usr/bin/env node\n"use strict";\n
                      require("${originalDir}/${resolveName}/bin/${name}");
                    `
                  );
                }
              });
            }

            // 替换了处理器的标识

            const isSubstitute = fsExtra.existsSync(
              `${resolveDir}/preprocessor-substitute-options.js`
            );

            if (!isSubstitute) {
              // 用less的替代品替换 源 less
              return fsExtra
                .move(resolveDir, `${originalDir}/${resolveName}`)
                .then(() =>
                  fsExtra.copy(substitutePreprocessorDir, resolveDir)
                );
            }
            return Promise.resolve();
          });
        })
      );
    },

    generateBundle() {
      if (buildCommand !== "build") {
        return Promise.resolve();
      }
      // 在资产生成文件之前，抽取multipleScopeVars对应的内容

      const {
        extract,
        arbitraryMode,
        removeCssScopeName,
        outputDir,
        customThemeCssFileName,
      } = defaultOptions;

      if (extract && !arbitraryMode) {
        // 生产时，非任意模式下抽取对应的主题css
        return extractThemeCss({
          removeCssScopeName,
        }).then(({ themeCss }) => {
          Object.keys(themeCss).forEach((scopeName) => {
            const name =
              (typeof customThemeCssFileName === "function"
                ? customThemeCssFileName(scopeName)
                : "") || scopeName;

            const fileName = path.posix
              .join(outputDir, `${name}.css`)
              .replace(/^[\\/]+/g, "");
            this.emitFile({
              type: "asset",
              fileName,
              source: themeCss[scopeName],
            });
          });
        });
      }
      return Promise.resolve();
    },
    handleHotUpdate({ server, modules }) {
      const {
        arbitraryMode,
        defaultPrimaryColor,
        customThemeOutputPath,
        styleTagId,
      } = defaultOptions;
      if (!arbitraryMode) {
        return;
      }
      // processorNames.
      const hasCssUpdate = modules.some((item) =>
        processorNames.some((lang) => {
          const isSass =
            ["scss", "sass"].includes(lang) &&
            (item.id.includes(".scss") || item.id.includes(".sass"));
          if (isSass) {
            return true;
          }
          const isLess = lang === "less" && item.id.includes(".less");
          return isLess;
        })
      );
      if (hasCssUpdate) {
        createSetCustomThemeFile({
          defaultPrimaryColor,
          customThemeOutputPath,
          styleTagId,
        })
        // .then(({ styleContent }) => {
          
        // });
      }
    },
    transformIndexHtml(html) {
      const {
        arbitraryMode,
        defaultPrimaryColor,
        customThemeOutputPath,
        styleTagId,
        InjectDefaultStyleTagToHtml,
      } = defaultOptions;
      if (arbitraryMode) {
        // 任意模式下，获取主题css生成一个setCustomTheme.js，并添加css到html
        const targetRsoleved = getCurrentPackRequirePath();
        const dirName = "extractTheme";
        if (!fsExtra.existsSync(`${targetRsoleved}/${dirName}`)) {
          return null;
        }
        return createSetCustomThemeFile({
          defaultPrimaryColor,
          customThemeOutputPath,
          styleTagId,
        }).then(({ styleContent }) => {
          const tag = {
            tag: "style",
            attrs: {
              id: styleTagId,
              type: "text/css",
            },
            injectTo: "body",
            children: styleContent,
          };
          return {
            html,
            tags: InjectDefaultStyleTagToHtml ? [tag] : [],
          };
        });
      }
      // 非任意模式，添加默认的抽取的主题css的link
      return addExtractThemeLinkTag({
        html,
        defaultOptions,
        allmultipleScopeVars,
        buildCommand,
        config,
      });
    },
  };
}
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
      const resolved = require
        .resolve(langName, {
          paths: [options.root || process.cwd()],
        })
        .replace(/\\/g, "/");
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
      fsExtra.removeSync(resolveDir);
      fsExtra.moveSync(
        `${path.resolve("node_modules/.zougtTheme/original")}/${resolveName}`,
        resolveDir
      );
    }
  });
  return Promise.resolve();
}
