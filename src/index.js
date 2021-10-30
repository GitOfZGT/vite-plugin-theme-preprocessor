import path from "path";

import fsExtra from "fs-extra";

import stringHash from "string-hash";

import {
  extractThemeCss,
  addScopnameToHtmlClassname,
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
  const langDefaultOptions = {
    multipleScopeVars: [],
    outputDir: "",
    // 默认取 multipleScopeVars[0].scopeName
    defaultScopeName: "",
    extract: true,
    themeLinkTagId: "theme-link-tag",
    // "head"||"head-prepend" || "body" ||"body-prepend"
    themeLinkTagInjectTo: "head",
    removeCssScopeName: false,
    customThemeCssFileName: null,
  };
  return {
    name: "vite-plugin-theme-preprocessor",
    enforce: "pre",

    config(conf, { command }) {
      buildCommand = command;
      // 在对应的预处理器配置添加 multipleScopeVars 属性

      const css = conf.css || {};
      const preprocessorOptions = css.preprocessorOptions || {};
      const allmultipleScopeVars = [];
      processorNames.forEach((lang) => {
        const langOptions = { ...langDefaultOptions, ...(options[lang] || {}) };
        browerPreprocessorOptions = langOptions;
        if (
          Array.isArray(langOptions.multipleScopeVars) &&
          langOptions.multipleScopeVars.length
        ) {
          preprocessorOptions[lang] = {
            ...(preprocessorOptions[lang] || {}),
            multipleScopeVars: langOptions.multipleScopeVars,
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
      const targetRsoleved = require
        .resolve(pack.name, {
          paths: [config.root],
        })
        .replace(/[\\/]index\.js$/, "");
      fsExtra.writeFileSync(
        `${targetRsoleved}/toBrowerEnvs.js`,
        `export const browerPreprocessorOptions = ${JSON.stringify(
          browerPreprocessorOptions
        )};\nexport const assetsDir="${
          config.build.assetsDir
        }";\nexport const buildCommand="${buildCommand}";
        `
      );
    },

    buildStart() {
      const targetRsoleved = require
        .resolve(pack.name, {
          paths: [config.root],
        })
        .replace(/[\\/]dist[\\/]index\.js$/, "");

      return Promise.all(
        processorNames.map((lang) => {
          const resolveName = lang === "scss" ? "sass" : lang;

          const resolved = require
            .resolve(resolveName, {
              paths: [config.root],
            })
            .replace(/\\/g, "/");

          const resolveDir = `${resolved.slice(
            0,
            resolved.indexOf(`/${resolveName}/`)
          )}/${resolveName}`;

          if (!fsExtra.existsSync(resolveDir)) {
            throw new Error(
              `Preprocessor dependency "${resolveName}" not found. Did you install it?`
            );
          }
          const substituteDir = `${targetRsoleved}/dist/substitute`;
          const substitutePreprocessorDir = `${substituteDir}/${resolveName}`;

          if (!fsExtra.existsSync(substitutePreprocessorDir)) {
            const funName = `get${
              resolveName.slice(0, 1).toUpperCase() + resolveName.slice(1)
            }`;

            fsExtra.mkdirSync(substitutePreprocessorDir);

            fsExtra.copySync(
              `${resolveDir}/package.json`,
              `${substitutePreprocessorDir}/package.json`
            );

            fsExtra.copySync(
              `${substituteDir}/preprocessor-substitute-options.js`,
              `${substitutePreprocessorDir}/preprocessor-substitute-options.js`
            );
            const mainFile = resolved
              .replace(resolveDir, "")
              .replace(/^\/+/g, "");

            fsExtra.writeFileSync(
              `${substitutePreprocessorDir}/${mainFile}`,
              `const nodePreprocessor = require("${pack.name}/original/${resolveName}/${mainFile}");
              const { ${funName} } =  require("@zougt/some-loader-utils");
              module.exports = ${funName}({
                implementation: nodePreprocessor,
              });
              `
            );

            if (fsExtra.existsSync(`${resolveDir}/bin`)) {
              fsExtra.readdirSync(`${resolveDir}/bin`).forEach((name) => {
                if (fsExtra.statSync(`${resolveDir}/bin/${name}`).isFile()) {
                  fsExtra.mkdirSync(`${substitutePreprocessorDir}/bin`);
                  fsExtra.writeFileSync(
                    `${substitutePreprocessorDir}/bin/${name}`,
                    `#!/usr/bin/env node\n"use strict";\n
                    require("${pack.name}/original/${resolveName}/bin/${name}");
                  `
                  );
                }
              });
            }
          }
          // 替换了处理器的标识

          const isSubstitute = fsExtra.existsSync(
            `${resolveDir}/preprocessor-substitute-options.js`
          );

          if (!isSubstitute) {
            // 替换处理器
            return fsExtra
              .move(resolveDir, `${targetRsoleved}/original/${resolveName}`)
              .then(() => fsExtra.copy(substitutePreprocessorDir, resolveDir));
          }

          return Promise.resolve();
        })
      );
    },

    generateBundle(opt, bundle) {
      if (buildCommand !== "build") {
        return;
      }
      // 在资产生成文件之前，从css内容中抽取multipleScopeVars对应的内容

      const themeMap = {};

      for (const filename in bundle) {
        if (/\.css$/.test(filename)) {
          let content = (
            bundle[filename].source ||
            bundle[filename].code ||
            ""
          ).toString();
          processorNames.forEach((lang) => {
            const langOptions = {
              ...langDefaultOptions,
              ...(options[lang] || {}),
            };

            if (!langOptions.extract) {
              return;
            }

            if (
              Array.isArray(langOptions.multipleScopeVars) &&
              langOptions.multipleScopeVars.length
            ) {
              const { css, themeCss } = extractThemeCss({
                css: content,
                multipleScopeVars: langOptions.multipleScopeVars,
                removeCssScopeName: langOptions.removeCssScopeName,
              });
              const langTheme = themeMap[lang] || {};
              Object.keys(themeCss).forEach((scopeName) => {
                langTheme[scopeName] = `${langTheme[scopeName] || ""}${
                  themeCss[scopeName]
                }`;
              });
              themeMap[lang] = langTheme;
              content = css;
            }
          });

          if (bundle[filename].source) {
            bundle[filename].source = content;
          }

          if (bundle[filename].code) {
            bundle[filename].code = content;
          }
        }
      }

      const fileContents = {};
      Object.keys(themeMap).forEach((lang) => {
        const langOptions = { ...langDefaultOptions, ...(options[lang] || {}) };

        if (!langOptions.extract) {
          return;
        }

        Object.keys(themeMap[lang]).forEach((scopeName) => {
          const name =
            (typeof langOptions.customThemeCssFileName === "function"
              ? langOptions.customThemeCssFileName(scopeName)
              : "") || scopeName;

          const filename = path.posix
            .join(
              langOptions.outputDir || config.build.assetsDir,
              `${name}.css`
            )
            .replace(/^[\\/]+/g, "");

          fileContents[filename] = `${fileContents[filename] || ""}${
            themeMap[lang][scopeName]
          }`;
        });
      });
      Object.keys(fileContents).forEach((fileName) => {
        this.emitFile({
          type: "asset",
          fileName,
          source: fileContents[fileName],
        });
      });
    },

    transformIndexHtml(html) {
      let newHtml = html;
      const tags = [];
      processorNames.forEach((lang) => {
        const langOptions = { ...langDefaultOptions, ...(options[lang] || {}) };

        if (
          Array.isArray(langOptions.multipleScopeVars) &&
          langOptions.multipleScopeVars.length
        ) {
          const defaultScopeName =
            langOptions.defaultScopeName ||
            langOptions.multipleScopeVars[0].scopeName;

          if (buildCommand !== "build" || !langOptions.removeCssScopeName) {
            newHtml = addScopnameToHtmlClassname(newHtml, defaultScopeName);
          }

          if (
            buildCommand === "build" &&
            langOptions.extract &&
            langOptions.themeLinkTagId
          ) {
            const filename =
              (typeof langOptions.customThemeCssFileName === "function"
                ? langOptions.customThemeCssFileName(defaultScopeName)
                : "") || defaultScopeName;
            const linkHref = `/${
              langOptions.outputDir || config.build.assetsDir
            }/${filename}.css`.replace(/\/+(?=\/)/g, "");
            const tag = {
              tag: "link",
              attrs: {
                href: linkHref,
                id: langOptions.themeLinkTagId,
              },
              injectTo: langOptions.themeLinkTagInjectTo,
            };

            if (
              tags.some(
                (item) =>
                  item.tag === tag.tag &&
                  item.attrs.href === tag.attrs.href &&
                  item.attrs.id === tag.attrs.id &&
                  item.injectTo === tag.injectTo
              )
            ) {
              return;
            }

            tags.push(tag);
          }
        }
      });
      return {
        html: newHtml,
        tags,
      };
    },
  };
}
/**
 *
 * @param {*} { langs: ['scss','less'] }
 * @returns
 */
export function resetStylePreprocessor(options = {}) {
  if (!Array.isArray(options.langs) || !options.langs.length) {
    return Promise.resolve();
  }
  const targetRsoleved = require
    .resolve(pack.name, {
      paths: [options.root || process.cwd()],
    })
    .replace(/[\\/]dist[\\/]index\.js$/, "");
  return Promise.all(
    options.langs.map((lang) => {
      const resolveName = lang === "scss" ? "sass" : lang;
      let isSubstitute = false;
      let resolveDir = "";
      try {
        const resolved = require
          .resolve(resolveName, {
            paths: [options.root || process.cwd()],
          })
          .replace(/\\/g, "/");

        resolveDir = `${resolved.slice(
          0,
          resolved.indexOf(`/${resolveName}/`)
        )}/${resolveName}`;
        isSubstitute = fsExtra.existsSync(
          `${resolveDir}/preprocessor-substitute-options.js`
        );
        // eslint-disable-next-line no-empty
      } catch (e) {}

      if (isSubstitute) {
        // 替换处理器
        return fsExtra
          .remove(resolveDir)
          .then(() =>
            fsExtra.move(
              `${targetRsoleved}/original/${resolveName}`,
              resolveDir
            )
          );
      }
      return Promise.resolve();
    })
  );
}
