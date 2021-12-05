import path from "path";

import fsExtra from "fs-extra";

import {
  extractThemeCss,
  createPulignParamsFile,
  getCurrentPackRequirePath,
  getThemeStyleContent,
  removeThemeFiles,
} from "@zougt/some-loader-utils";

import pack from "../package.json";

import { addExtractThemeLinkTag } from "./common/addExtractThemeLinkTag";

import { createSetCustomTheme } from "./common/createSetCustomTheme";

import { getModulesScopeGenerater } from "./common/getModulesScopeGenerater";

import { resetStylePreprocessor } from "./common/resetStylePreprocessor";

// eslint-disable-next-line import/no-unresolved
let preCustomThemeOutputPath = "";

/**
 * lang : "less" | "scss" | "sass"
 * @param {object} options : { [lang]:{ multipleScopeVars: [{scopeName:"theme-1",path: path.resolve('./vars.less')}], outputDir, defaultScopeName ,extract,removeCssScopeName,customThemeCssFileName,themeLinkTagId,themeLinkTagInjectTo } }
 * @param {object} [options.less]
 * @param {object} [options.scss]
 * @param {object} [options.sass]
 * @returns {object}
 */

export default function themePreprocessorPlugin(options = {}) {
  let config = {
    root: process.cwd(),
  };
  // @zougt/vite-plugin-theme-preprocessor 被 require() 时的实际路径
  const targetRsoleved = require
    .resolve(pack.name, {
      paths: [process.cwd()],
    })
    .replace(/[\\/]dist[\\/]index\.js$/, "").replace(/\\/g,'/');
  const customThemeOutputPath = `${targetRsoleved}/setCustomTheme.js`;
  let buildCommand;
  const processorNames = Object.keys(options);

  let defaultOptions = {
    outputDir: "",
    // multipleScopeVars:[{scopeName:"theme-default",path:""}],
    // 默认取 multipleScopeVars[0].scopeName
    defaultScopeName: "",
    // 强制将一些颜色值的样式作为主题样式
    includeStyleWithColors: [
      // {color:"#ffffff",inGradient:false}
    ],
    extract: true,
    themeLinkTagId: "theme-link-tag",
    // "head"||"head-prepend" || "body" ||"body-prepend"
    themeLinkTagInjectTo: "head",
    removeCssScopeName: false,
    customThemeCssFileName: null,
    // 以下是任意主题模式的参数 arbitraryMode:true 有效
    arbitraryMode: false,
    // 默认主题色，必填
    defaultPrimaryColor: "",
    // 输出切换主题色的方法文件
    customThemeOutputPath,
    // style标签的id
    styleTagId: "custom-theme-tagid",
    InjectDefaultStyleTagToHtml: true,
  };
  const allmultipleScopeVars = [];
  let cacheThemeStyleContent = "";
  const setCustomThemeCodeReplacer =
    "const setCustomTheme=function(options){window._setCustomTheme_=options;}";

  return {
    name: "vite-plugin-theme-preprocessor",
    enforce: "pre",
    api: {
      getOptions() {
        return defaultOptions;
      },
      getProcessorNames() {
        return processorNames;
      },
      getMultipleScopeVars() {
        return allmultipleScopeVars;
      },
    },
    config(conf, { command }) {
      buildCommand = command;
      // 在对应的预处理器配置添加 multipleScopeVars 属性

      const css = conf.css || {};
      const preprocessorOptions = css.preprocessorOptions || {};

      processorNames.forEach((lang) => {
        const langOptions = options[lang] || {};
        defaultOptions = { ...defaultOptions, ...langOptions };
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
              founded.path = Array.from(new Set(paths));
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

      return { ...conf, css };
    },

    configResolved(resolvedConfig) {
      // 存储最终解析的配置
      config = resolvedConfig;

      const browerPreprocessorOptions = {
        ...defaultOptions,
        multipleScopeVars: allmultipleScopeVars,
      };

      createPulignParamsFile({
        extract: buildCommand !== "build" ? false : defaultOptions.extract,
      });

      const packRoot = require
        .resolve(pack.name, {
          paths: [config.root],
        })
        .replace(/[\\/]index\.js$/, "").replace(/\\/g,'/');
      // 将一些参数打入到 toBrowerEnvs.js , 由brower-utils.js 获取
      fsExtra.writeFileSync(
        `${packRoot}/toBrowerEnvs.js`,
        `export const browerPreprocessorOptions = ${JSON.stringify(
          browerPreprocessorOptions
        )};\nexport const basePath="${
          config.base || ""
        }";\nexport const assetsDir="${
          config.build.assetsDir || ""
        }";\nexport const buildCommand="${buildCommand}";
        `
      );
      if (
        defaultOptions.arbitraryMode &&
        preCustomThemeOutputPath !== defaultOptions.customThemeOutputPath
      ) {
        preCustomThemeOutputPath = defaultOptions.customThemeOutputPath;
        return createSetCustomTheme({
          ...defaultOptions,
          buildCommand,
          cacheThemeStyleContent,
        }).then((result) => {
          if (result) {
            cacheThemeStyleContent = result.styleContent;
          }
        });
      }
      return null;
    },

    buildStart() {
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
          const originalDir = path.resolve(
            "node_modules/.zougtTheme/original"
          ) .replace(/\\/g, "/");
          if (
            !fsExtra.existsSync(resolveDir) &&
            !fsExtra.existsSync(`${originalDir}/${resolveName}`)
          ) {
            throw new Error(
              `Preprocessor dependency "${langName}" not found. Did you install it?`
            );
          }
          // substitute：替代品的源位置
          const substituteDir = `${targetRsoleved}/dist/substitute`;
          const substitutePreprocessorDir = `${substituteDir}/${resolveName}`;

          return resetStylePreprocessor({ langs: [langName] }).then(() => {
            // "getLess" || "getSass"
            const funName = `get${
              langName.slice(0, 1).toUpperCase() + langName.slice(1)
            }`;

            // 在substitute生成替代包
            const copyPreFiles = fsExtra.readdirSync(resolveDir) || [];
            copyPreFiles.forEach((name) => {
              if (name !== "node_modules" && name !== "bin") {
                fsExtra.copySync(
                  `${resolveDir}/${name}`,
                  `${substitutePreprocessorDir}/${name}`
                );
              }
            });
            fsExtra.copySync(
              `${substituteDir}/preprocessor-substitute-options.js`,
              `${substitutePreprocessorDir}/preprocessor-substitute-options.js`
            );

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
                  includeStyleWithColors:${JSON.stringify(
                    defaultOptions.includeStyleWithColors
                  )},
                  implementation: nodePreprocessor,
                });
                `
            );
            // 如果 源less中存在bin，生成一份替代品的bin
            // if (fsExtra.existsSync(`${resolveDir}/bin`)) {
            //   fsExtra.readdirSync(`${resolveDir}/bin`).forEach((name) => {
            //     if (fsExtra.statSync(`${resolveDir}/bin/${name}`).isFile()) {
            //       if (!fsExtra.existsSync(`${substitutePreprocessorDir}/bin`)) {
            //         fsExtra.mkdirSync(`${substitutePreprocessorDir}/bin`);
            //       }
            //       fsExtra.writeFileSync(
            //         `${substitutePreprocessorDir}/bin/${name}`,
            //         `#!/usr/bin/env node\n"use strict";\n
            //           require("${originalDir}/${resolveName}/bin/${name}");
            //         `
            //       );
            //     }
            //   });
            // }

            // 替换了处理器的标识

            const isSubstitute = fsExtra.existsSync(
              `${resolveDir}/preprocessor-substitute-options.js`
            );

            if (!isSubstitute) {
              // 用less的替代品替换 源 less
              const moveFiles = fsExtra.readdirSync(resolveDir) || [];
              moveFiles.forEach((name) => {
                if (name !== "node_modules" && name !== "bin") {
                  fsExtra.copySync(
                    `${resolveDir}/${name}`,
                    `${originalDir}/${resolveName}/${name}`
                  );
                }
              });
              const copyFiles = fsExtra.readdirSync(substitutePreprocessorDir);
              copyFiles.forEach((name) => {
                if (name !== "node_modules" && name !== "bin") {
                  fsExtra.copySync(
                    `${substitutePreprocessorDir}/${name}`,
                    `${resolveDir}/${name}`
                  );
                }
              });
            }
            return Promise.resolve();
          });
        })
      );
    },
    resolveId(id) {
      if (id === "@setCustomTheme") {
        return id;
      }
      return null;
    },
    load(id) {
      if (
        id === "@setCustomTheme" &&
        defaultOptions.arbitraryMode &&
        defaultOptions.customThemeOutputPath
      ) {
        if (buildCommand !== "build") {
          return `import { default as setCustomTheme } from "${defaultOptions.customThemeOutputPath}";
          export default setCustomTheme;
          import Color from "color";
          import.meta.hot.on('custom-theme-update', (data) => {
            setCustomTheme({...data,Color});
          })
        `;
        }
        return `${setCustomThemeCodeReplacer};export default setCustomTheme;`;
      }
      return null;
    },
    renderChunk(code) {
      if (
        defaultOptions.arbitraryMode &&
        code.includes(setCustomThemeCodeReplacer)
      ) {
        return createSetCustomTheme({
          ...defaultOptions,
          buildCommand,
          customThemeOutputPath: null,
          cacheThemeStyleContent: null,
        }).then((result) => {
          if (result) {
            return code.replace(
              setCustomThemeCodeReplacer,
              `\n${result.setCustomThemeConent}\n`
            );
          }
          return null;
        });
      }
      return null;
    },

    transformIndexHtml(html) {
      const { arbitraryMode, styleTagId, InjectDefaultStyleTagToHtml } =
        defaultOptions;
      if (arbitraryMode) {
        // 任意模式下，获取主题css生成一个setCustomTheme.js，并添加style tag到html
        const loaderRsoleved = getCurrentPackRequirePath();
        const dirName = "extractTheme";
        if (!fsExtra.existsSync(`${loaderRsoleved}/${dirName}`)) {
          return null;
        }
        const themeResult =
          buildCommand !== "build"
            ? createSetCustomTheme({
                ...defaultOptions,
                buildCommand,
                cacheThemeStyleContent,
              })
            : getThemeStyleContent();
        return themeResult.then((result) => {
          if (result) {
            const { styleContent } = result;
            cacheThemeStyleContent = styleContent;
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
          }
          return null;
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
              .join(outputDir || config.build.assetsDir, `${name}.css`)
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
  };
}

/**
 * 主题热更新插件
 * @returns object
 */

function themePreprocessorHmrPlugin() {
  let parentApi = null;
  let cacheThemeStyleContent = "";
  let buildCommand = "";
  const hotUpdateStyleFiles = new Set();
  const transformStyleFiles = new Set();
  let hotServer = null;
  let config = {};
  return {
    // 插件顺序必须post
    enforce: "post",
    name: "vite-plugin-theme-preprocessor-hmr",
    config(conf, { command }) {
      buildCommand = command;
    },
    configResolved(resolvedConfig) {
      // 存储最终解析的配置
      config = resolvedConfig;
    },
    buildStart() {
      const parentName = "vite-plugin-theme-preprocessor";
      const parentPlugin = config.plugins.find(
        (plugin) => plugin.name === parentName
      );
      if (!parentPlugin) {
        throw new Error(`This plugin depends on the "${parentName}" plugin.`);
      }

      parentApi = parentPlugin.api;
    },
    transform(code, id) {
      const defaultOptions = parentApi.getOptions();
      if (
        defaultOptions.arbitraryMode &&
        /\.(less|scss|sass)(\?.+)?/.test(id)
      ) {
        transformStyleFiles.add(id);
        if (
          hotUpdateStyleFiles.size &&
          hotUpdateStyleFiles.size <= transformStyleFiles.size
        ) {
          getThemeStyleContent();
          createSetCustomTheme({
            ...defaultOptions,
            buildCommand,
            cacheThemeStyleContent,
          }).then((result) => {
            if (result) {
              cacheThemeStyleContent = result.styleContent;
              hotServer.ws.send({
                type: "custom",
                event: "custom-theme-update",
                data: {
                  sourceThemeStyle: result.styleContent,
                  hybridValueMap: result.hybridValueMap,
                  otherValues: result.otherValues,
                  sourceColorMap: result.sourceColorMap,
                },
              });
            }
          });
        }
      }
    },
    handleHotUpdate({ file, server, modules }) {
      hotServer = server;
      const defaultOptions = parentApi.getOptions();
      const { arbitraryMode, customThemeOutputPath } = defaultOptions;

      if (!arbitraryMode) {
        return Promise.resolve();
      }

      hotUpdateStyleFiles.clear();
      transformStyleFiles.clear();
      if (
        parentApi
          .getMultipleScopeVars()
          .some(
            (item) =>
              (typeof item.path === "string" && file === item.path) ||
              (Array.isArray(item.path) && item.path.some((p) => p === file))
          )
      ) {
        removeThemeFiles();
        modules[0].importers.forEach((item) => {
          // console.log(item)
          if (item.id && /\.(less|scss|sass)(\?.+)?/.test(item.id)) {
            hotUpdateStyleFiles.add(item.id);
          }
        });
      } else {
        modules.forEach((item) => {
          if (item.id && /\.(less|scss|sass)(\?.+)?/.test(item.id)) {
            hotUpdateStyleFiles.add(item.id);
          }
        });
      }
      if (file === customThemeOutputPath) {
        return Promise.resolve([]);
      }
      return Promise.resolve();
    },
  };
}

export {
  themePreprocessorPlugin,
  themePreprocessorHmrPlugin,
  resetStylePreprocessor,
};
